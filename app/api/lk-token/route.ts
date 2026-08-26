import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createLiveKitToken, LiveKitRole } from '@/lib/livekit';
import { verifyAccess, verifyClassLessonAccess } from '@/lib/accessControl';
import { enforceClassCapacityAtomic } from '@/lib/classEntitlements';
import type { ClassroomRole } from '@/types';

const VALID_ROLES = new Set<LiveKitRole>(['participant', 'spectator']);

function mapMeetAccessRoleToSharedRole(role: string): string {
  if (role === 'owner') return 'host';
  if (role === 'presenter') return 'presenter';
  if (role === 'participant') return 'participant';
  return 'viewer';
}

/**
 * Retrieve LiveKit URL directly from process.env.
 * Bypasses getServerEnv() cache to avoid 'Env Desync' issues.
 */
function getLiveKitUrl(): string {
  const url = process.env.LIVEKIT_URL?.trim();
  if (!url) {
    throw new Error('LIVEKIT_URL is not configured. Check .env.local or Vercel env vars.');
  }
  return url;
}

export async function POST(request: Request) {
  // ── Auth Guard ───────────────────────────────────────────────────────────
  let session;
  try {
    session = await getServerSession(request);
  } catch {
    return NextResponse.json(
      { error: 'Please log in to join the meeting' },
      { status: 401 }
    );
  }

  if (!session) {
    return NextResponse.json(
      { error: 'Please log in to join the meeting' },
      { status: 401 }
    );
  }

  if (!session.userId) {
    return NextResponse.json(
      { error: 'Invalid session: missing userId' },
      { status: 401 }
    );
  }

  // ── Data Validation ──────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Meeting ID required' },
      { status: 400 }
    );
  }

  const roomId = String(payload?.roomId ?? payload?.room ?? '').trim();
  const requestedRole = String(payload?.role ?? 'participant').trim() as LiveKitRole;
  const username = String(payload?.username ?? payload?.name ?? '').trim();
  const domain = String(payload?.domain ?? 'meet').trim();
  const classroomId = String(payload?.classroomId ?? '').trim();
  const lessonId = String(payload?.lessonId ?? '').trim();

  if (domain === 'class' && (!classroomId || !lessonId)) {
    return NextResponse.json(
      { error: 'Classroom and lesson are required' },
      { status: 400 }
    );
  }

  if (domain !== 'class' && !roomId) {
    return NextResponse.json(
      { error: 'Meeting ID required' },
      { status: 400 }
    );
  }

  if (domain !== 'class' && !VALID_ROLES.has(requestedRole)) {
    return NextResponse.json(
      { error: 'Invalid role' },
      { status: 400 }
    );
  }

  if (domain !== 'meet' && domain !== 'class') {
    return NextResponse.json(
      { error: 'Invalid domain' },
      { status: 400 }
    );
  }

  let effectiveRoomId: string;
  let role: LiveKitRole;
  let classroomRoleForToken: ClassroomRole | undefined;
  let participantRoleForToken: string | undefined;

  if (domain === 'class') {
    // Class authorization is server-controlled — the client may not supply role/room.
    if (payload.role !== undefined || payload.roomId !== undefined || payload.room !== undefined) {
      return NextResponse.json({ error: 'Class authorization is server controlled' }, { status: 400 });
    }
    const classAccess = await verifyClassLessonAccess(session.userId, classroomId, lessonId);
    if (!classAccess.granted) {
      return NextResponse.json({ error: 'Access denied to this lesson' }, { status: 403 });
    }
    if (!classAccess.lesson || classAccess.lesson.status !== 'live') {
      return NextResponse.json({ error: 'Lesson is not live' }, { status: 409 });
    }
    if (!classAccess.lesson.livekit_room_id?.trim()) {
      return NextResponse.json({ error: 'Live lesson room is unavailable' }, { status: 409 });
    }

    // ── Server-side Class capacity enforcement ───────────────────────────────
    // The classroom owner's entitlement is resolved from the subscriptions DB.
    // Roles are counted from server-side enrollment data — never from the client.
    const classroom = classAccess.classroom;
    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    // Derive the canonical classroom role from the server-authoritative access result.
    // Owner is NOT an enrollment role — it is derived from access.source === 'owner'.
    if (classAccess.source === 'owner') {
      classroomRoleForToken = 'owner';
    } else {
      switch (classAccess.accessRole) {
        case 'instructor':
        case 'ta':
        case 'student':
        case 'auditor':
          classroomRoleForToken = classAccess.accessRole;
          break;
        case 'spectator':
        default:
          return NextResponse.json({ error: 'Access denied to this lesson' }, { status: 403 });
      }
    }

    const capacity = await enforceClassCapacityAtomic(
      classroom.id,
      classroom.owner_id,
      classroomRoleForToken
    );

    if (!capacity.allowed) {
      return NextResponse.json(
        { error: capacity.reason ?? 'Class capacity limit reached' },
        { status: 403 }
      );
    }

    effectiveRoomId = classAccess.lesson.livekit_room_id;
    role = classAccess.liveKitRole;
    participantRoleForToken = role;
  } else {
    let access;
    try {
      access = await verifyAccess('meet', session.userId, roomId);
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!access.granted) {
      return NextResponse.json({ error: 'Access denied to this room' }, { status: 403 });
    }
    effectiveRoomId = access.roomId;
    role = access.role === 'spectator' ? 'spectator' : requestedRole;
    participantRoleForToken = mapMeetAccessRoleToSharedRole(access.role);
  }

  // ── LiveKit URL ──────────────────────────────────────────────────────────
  const liveKitUrl = getLiveKitUrl();

  const displayName = username || session.email || `Participant-${session.userId.slice(0, 4)}`;

  // ── LiveKit Token Generation (isolated try/catch) ────────────────────────
  let token: string;
  try {
    token = await createLiveKitToken({
      identity: session.userId,
      name: displayName,
      room: effectiveRoomId,
      role,
      classroomRole: classroomRoleForToken,
      participantRole: participantRoleForToken,
    });
  } catch (err) {
    console.error('[LK_SERVER_ERROR] LiveKit token generation failed:', err);
    return NextResponse.json(
      { error: 'Unable to issue meeting token' },
      { status: 500 }
    );
  }

  return NextResponse.json({ token, url: liveKitUrl });
}
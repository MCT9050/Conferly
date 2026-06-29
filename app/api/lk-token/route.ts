import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createLiveKitToken, LiveKitRole } from '@/lib/livekit';
import { verifyAccess } from '@/lib/accessControl';

const VALID_ROLES = new Set<LiveKitRole>(['participant', 'spectator']);

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

  if (!roomId) {
    return NextResponse.json(
      { error: 'Meeting ID required' },
      { status: 400 }
    );
  }

  if (!VALID_ROLES.has(requestedRole)) {
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

  // ── Room Access Verification ─────────────────────────────────────────────
  let access;
  try {
    access = await verifyAccess(domain, session.userId, roomId);
  } catch {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  if (!access.granted) {
    return NextResponse.json(
      { error: 'Access denied to this room' },
      { status: 403 }
    );
  }

  // ── LiveKit URL ──────────────────────────────────────────────────────────
  const liveKitUrl = getLiveKitUrl();

  // For class domain, resolve the classroom slug to the actual LiveKit room
  let effectiveRoomId = access.roomId;
  if (domain === 'class') {
    const classroomId = access.roomId;
    const { createClient } = await import('@supabase/supabase-js');
    const { getServerEnv } = await import('@/lib/serverEnv');
    const env = getServerEnv();
    const serviceRoleKey =
      env.SUPABASE_SERVICE_ROLE_KEY ??
      (() => { throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in lk-token route'); })();
    const supabase = createClient(env.SUPABASE_URL, serviceRoleKey);
    const { data: activeLesson } = await supabase
      .from('classroom_lessons')
      .select('livekit_room_id')
      .eq('classroom_id', classroomId)
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .maybeSingle();
    effectiveRoomId = activeLesson?.livekit_room_id ?? classroomId;
  }

  const role = access.role === 'spectator' ? 'spectator' : requestedRole;
  const displayName = username || session.email || `Participant-${session.userId.slice(0, 4)}`;

  // ── LiveKit Token Generation (isolated try/catch) ────────────────────────
  let token: string;
  try {
    token = await createLiveKitToken({
      identity: session.userId,
      name: displayName,
      room: effectiveRoomId,
      role,
    });
  } catch (err) {
    console.error('[LK_SERVER_ERROR] LiveKit token generation failed:', err);
    console.error('[LK_SERVER_ERROR] Input:', { identity: session.userId, name: displayName, room: roomId, role });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }

  return NextResponse.json({ token, url: liveKitUrl });
}

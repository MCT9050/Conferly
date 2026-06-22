import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createLiveKitToken, LiveKitRole } from '@/lib/livekit';
import { verifyRoomAccess } from '@/lib/meetingAuth';

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
    session = await getServerSession();
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

  // ── Room Access Verification ─────────────────────────────────────────────
  let access;
  try {
    access = await verifyRoomAccess(session.userId, roomId);
  } catch {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  if (!access) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  // ── LiveKit URL ──────────────────────────────────────────────────────────
  const liveKitUrl = getLiveKitUrl();

  const role = access.accessRole === 'spectator' ? 'spectator' : requestedRole;
  const displayName = username || session.email || `Participant-${session.userId.slice(0, 4)}`;

  // ── LiveKit Token Generation (isolated try/catch) ────────────────────────
  let token: string;
  try {
    token = await createLiveKitToken({
      identity: session.userId,
      name: displayName,
      room: roomId,
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

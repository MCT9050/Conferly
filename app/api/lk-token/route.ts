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
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.userId) {
      return NextResponse.json({ error: 'Invalid session: missing userId' }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const roomId = String(payload?.roomId ?? '').trim();
    const requestedRole = String(payload?.role ?? 'participant').trim() as LiveKitRole;

    if (!roomId) {
      return NextResponse.json({ error: 'Missing roomId' }, { status: 400 });
    }

    if (!VALID_ROLES.has(requestedRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const access = await verifyRoomAccess(session.userId, roomId);
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const liveKitUrl = getLiveKitUrl();

    const role = access.accessRole === 'spectator' ? 'spectator' : requestedRole;
    const token = await createLiveKitToken({
      identity: session.userId,
      name: session.email ?? session.userId,
      room: roomId,
      role,
    });

    return NextResponse.json({ token, url: liveKitUrl });
  } catch (error) {
    console.error('LIVEKIT_TOKEN_CRASH:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

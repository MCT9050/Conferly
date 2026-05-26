import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createLiveKitToken, LiveKitRole } from '@/lib/livekit';
import { getServerEnv } from '@/lib/serverEnv';
import { verifyRoomAccess } from '@/lib/meetingAuth';

const VALID_ROLES = new Set<LiveKitRole>(['participant', 'spectator']);

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  const env = getServerEnv();
  if (!env.LIVEKIT_URL) {
    return NextResponse.json({ error: 'LiveKit is not configured on the server' }, { status: 500 });
  }

  const role = access.accessRole === 'spectator' ? 'spectator' : requestedRole;
  const token = await createLiveKitToken({
    identity: session.userId,
    name: session.email ?? session.userId,
    room: roomId,
    role,
  });

  return NextResponse.json({ token, url: env.LIVEKIT_URL });
}

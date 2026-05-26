import { AccessToken, VideoGrant } from 'livekit-server-sdk';
import { getServerEnv } from './serverEnv';

export type LiveKitRole = 'participant' | 'spectator';

export async function createLiveKitToken({
  identity,
  name,
  room,
  role,
}: {
  identity: string;
  name: string;
  room: string;
  role: LiveKitRole;
}): Promise<string> {
  const env = getServerEnv();
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    throw new Error('Missing LiveKit credentials: LIVEKIT_API_KEY and LIVEKIT_API_SECRET are required');
  }

  const grant: VideoGrant = {
    roomJoin: true,
    room,
    canSubscribe: true,
    canPublish: role === 'participant',
    canPublishData: role === 'participant',
  };

  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity,
    name,
    metadata: JSON.stringify({ role }),
    attributes: { role },
  });

  token.addGrant(grant);
  return await token.toJwt();
}

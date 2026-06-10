import { AccessToken, VideoGrant } from 'livekit-server-sdk';

export type LiveKitRole = 'participant' | 'spectator';

/**
 * Retrieve LiveKit credentials directly from process.env.
 * Bypasses getServerEnv() cache to avoid 'Env Desync' issues
 * where the cached environment snapshot may return empty strings.
 */
function getLiveKitCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();

  if (!apiKey || !apiSecret) {
    throw new Error(
      `Missing LiveKit credentials: LIVEKIT_API_KEY=${apiKey ? 'present' : 'missing'}, LIVEKIT_API_SECRET=${apiSecret ? 'present' : 'missing'}. Check .env.local or Vercel env vars.`
    );
  }

  return { apiKey, apiSecret };
}

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
  if (!identity || !name || !room) {
    throw new Error(
      `createLiveKitToken called with invalid params: identity=${JSON.stringify(identity)}, name=${JSON.stringify(name)}, room=${JSON.stringify(room)}`
    );
  }

  const { apiKey, apiSecret } = getLiveKitCredentials();

  const grant: VideoGrant = {
    roomJoin: true,
    room,
    canSubscribe: true,
    canPublish: role === 'participant',
    canPublishData: role === 'participant',
  };

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name,
    metadata: JSON.stringify({ role }),
    attributes: { role },
  });

  token.addGrant(grant);
  const jwt = await token.toJwt();

  return jwt;
}

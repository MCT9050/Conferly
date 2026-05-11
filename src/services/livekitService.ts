/**
 * LiveKit Token Generation Service
 * Generates secure room access tokens for video conferencing.
 * @module livekitService
 */
import { AccessToken, VideoGrant } from 'livekit-server-sdk';

/**
 * LiveKit credentials from environment
 */
interface LiveKitCredentials {
  apiKey: string;
  apiSecret: string;
  url: string;
}

/**
 * Get LiveKit credentials from environment
 */
function getCredentials(): LiveKitCredentials | null {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !url) {
    console.warn('[livekit] Missing credentials in environment');
    return null;
  }

  return { apiKey, apiSecret, url };
}

/**
 * Token generation options
 */
export interface TokenOptions {
  roomId: string;
  identity: string;
  name?: string;
  metadata?: string;
  isHost?: boolean;
}

/**
 * Generate a room access token
 * @returns Token string or null if credentials missing
 */
export function generateRoomToken(options: TokenOptions): { token: string; url: string } | null {
  const creds = getCredentials();
  if (!creds) {
    return null;
  }

  const { roomId, identity, name, metadata, isHost } = options;

  // Create access token with video permissions
  const token = new AccessToken(creds.apiKey, creds.apiSecret, {
    identity,
    name: name || identity,
    metadata,
  });

  // Grant permissions for video, audio, and screen sharing
  const grant = new VideoGrant({
    room: roomId,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // Screen sharing is enabled via canPublish when video is enabled
    hidden: false,
    recorder: false,
  });

  // Add host permissions if applicable
  if (isHost) {
    grant.canDeleteParticipants = true;
    grant.canMuteParticipants = true;
    grant.roomAdmin = true;
  }

  token.grant = grant;

  // Generate JWT token
  const tokenString = token.toJwt();

  return { token: tokenString, url: creds.url };
}

/**
 * Validate that LiveKit is configured
 */
export function isLiveKitConfigured(): boolean {
  return getCredentials() !== null;
}

/**
 * Get the LiveKit server URL
 */
export function getLiveKitUrl(): string | null {
  const creds = getCredentials();
  return creds?.url || null;
}

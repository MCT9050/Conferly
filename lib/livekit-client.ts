/**
 * LiveKit Client Lazy Loader
 * 
 * Defers loading of livekit-client until explicitly needed.
 * This saves ~200-250 KB from the initial bundle, deferring it to
 * when a user actually initiates a real-time call session.
 */

let liveKitModule: typeof import('livekit-client') | null = null;

/**
 * Lazy-load the LiveKit module on first access.
 * Subsequent calls return the cached module.
 */
export async function getLiveKitModule() {
  if (!liveKitModule) {
    // Dynamic import - deferred until explicitly called
    liveKitModule = await import('livekit-client');
  }
  return liveKitModule;
}

/**
 * Get Room class from lazily-loaded LiveKit module
 */
export async function getRoom() {
  const { Room } = await getLiveKitModule();
  return Room;
}

/**
 * Get Track enum from lazily-loaded LiveKit module
 */
export async function getTrack() {
  const { Track } = await getLiveKitModule();
  return Track;
}

/**
 * Create a new Room instance with lazy-loaded LiveKit
 */
export async function createLiveKitRoom() {
  const { Room } = await getLiveKitModule();
  return new Room();
}

/**
 * Get RoomEvent enum for type-safe event handling
 */
export async function getRoomEvent() {
  const { RoomEvent } = await getLiveKitModule();
  return RoomEvent;
}

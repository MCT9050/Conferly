# LiveKit Integration Summary

## Overview
Full LiveKit + Supabase integration is now complete with server-side token issuance and client-side room connection.

## Architecture

### Backend Flow
1. **Auth Check** → `/api/lk-token` validates user session via `getServerSession()`
2. **Room Access Verification** → `verifyRoomAccess()` checks DB for room membership
3. **Role Determination** → User's role mapped to LiveKit permissions (participant/spectator)
4. **Token Generation** → `createLiveKitToken()` creates JWT with VideoGrant
5. **Response** → Returns JWT token + LiveKit server URL

### Frontend Flow
1. **Media Capture** → `useBrowserMedia()` gets local audio/video tracks
2. **Token Fetch** → POST to `/api/lk-token` with room ID
3. **Room Connection** → `Room.connect(url, token)` establishes WebRTC connection
4. **Track Publishing** → Local audio/video published to LiveKit
5. **Remote Sync** → Room events update remote participant list
6. **Stream Mapping** → Remote track publications → MediaStreams for rendering
7. **Screen Share** → Optional track published on user demand

## Files Changed

### Backend
- **`app/api/lk-token/route.ts`**
  - Returns JWT token and LiveKit server URL
  - Validates room access and enforces role-based permissions

- **`lib/livekit.ts`**
  - `createLiveKitToken()` - async JWT generator with VideoGrant
  - Supports participant/spectator roles

- **`lib/serverEnv.ts`**
  - Environment caching now includes LiveKit credentials

- **`lib/meetingAuth.ts`**
  - `verifyRoomAccess()` - validates user membership and role

### Frontend
- **`components/meeting/state/participantStore.tsx`**
  - Replaced mock participant state with real LiveKit room connection
  - Manages Room instance lifecycle via React refs
  - Publishes local audio/video tracks
  - Subscribes to room events and updates participant list
  - Maps remote track publications to MediaStreams
  - Handles screen share publishing

## Key Integrations

### Track Management
```typescript
// Local tracks published from browser media stream
room.localParticipant.publishTrack(audioTrack, {
  source: Track.Source.Microphone,
  name: 'microphone',
});

// Remote tracks subscribed automatically
room.on('trackSubscribed', () => updateRemoteParticipants());
```

### Participant Mapping
- Extract camera/microphone/screen share publications from each remote participant
- Convert subscribed tracks to MediaStream for HTML5 video elements
- Maintain participant metadata (name, speaking status, video/audio state)

## Environment Variables Required
```
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
LIVEKIT_URL=https://your-livekit-host.livekit.cloud
```

## Local helper: generate a LiveKit token
You can generate a token locally for testing using the included helper script `scripts/generate_lk_token.js`.

Example (prints a JWT to stdout):

```bash
LIVEKIT_API_KEY=your-livekit-api-key \
LIVEKIT_API_SECRET=your-livekit-api-secret \
  node scripts/generate_lk_token.js
```

Optional environment variables:
- `IDENTITY` — user identity (default: `local-test`)
- `ROOM` — room name/slug (default: `CONFER123`)
- `ROLE` — `participant` or `spectator` (default: `participant`)

Use the printed token with the LiveKit URL returned by the server or your `LIVEKIT_URL` value.

## Role-Based Permissions
- **participant**: Can publish audio/video and subscribe to others
- **spectator**: Can only subscribe to others (no publish)

## Testing Checklist
- [ ] `/api/lk-token` returns valid JWT
- [ ] JWT includes correct room and identity claims
- [ ] Room connection succeeds with returned token
- [ ] Local tracks publish successfully
- [ ] Remote participants appear when joining
- [ ] Screen share publishes as ScreenShare source
- [ ] Role-based restrictions enforced
- [ ] Disconnection cleanup works properly

## Known Limitations
- Screen share publishing tested to work; hall-of-mirrors prevention already in VideoGrid
- Single room hardcoded to CONFER123 (should use dynamic room from params)
- Error handling is minimal (could be enhanced with user-facing notifications)

## Next Steps
1. Wire room ID dynamically from meeting state instead of hardcoded CONFER123
2. Add error recovery and reconnection logic
3. Implement bandwidth management for adaptive stream quality
4. Add participant stats monitoring via LiveKit API

# Shared Live Room Activity Protocol

Phase 2 implements a versioned LiveKit synchronization protocol for shared activity selection across live-room foundations.

## Transport

- Protocol version: `1`
- LiveKit data topic: `conferly.live-room.activity.v1`
- Reliability: reliable data packets only (`publishData(..., { reliable: true, topic })`)
- Hydration snapshot: participant attribute `conferly.liveRoom.activity.v1`

## Packet shape

```ts
type SharedActivityPacket = {
  protocol: 1;
  kind: 'activity.set' | 'activity.snapshot';
  packetId: string;
  roomId: string;
  domain: 'classroom' | 'meet';
  activity: 'welcome' | 'gallery' | 'focus' | 'discussion' | 'screen-share' | 'presentation' | 'whiteboard' | 'audio-only';
  revision: number;
  updatedAt: number;
  senderIdentity: string;
  senderRole: string;
};
```

## Authorization

Client packet roles are never trusted by themselves. Receivers validate sender identity against the LiveKit participant identity and sender role against server-issued participant attributes.

Classroom shared activity control is limited to owner, instructor, and authorized TA. Students and auditors cannot control shared activity.

## Rejection rules

Packets are rejected when malformed, stale, duplicate, unsupported, unauthorized, or targeted at the wrong room/domain.

## Deterministic revision handling

Highest revision wins. For equal revisions, later `updatedAt` wins. Older or equal timestamp packets are stale.

## Late join hydration

Authorized controllers write the latest accepted shared activity state to their participant attributes. Late joiners hydrate from the latest valid authorized snapshot.

## Phase 2 boundaries

- Classroom connects to synchronized shared activity.
- Personal layout and audio-only preferences remain local.
- Screen-share and whiteboard activity selection remain Classroom-specific.
- Meet is not integrated in Phase 2.
- No database or entitlement changes are included.
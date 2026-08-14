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
  activity: 'welcome' | 'gallery' | 'focus' | 'discussion' | 'screen-share' | 'presentation' | 'whiteboard';
  revision: number;
  updatedAt: number;
  senderIdentity: string;
  senderRole: string;
};
```

`audio-only` is intentionally excluded from the shared packet and snapshot vocabulary. Audio-only remains a local media preference or local Classroom UI state only.

## Authorization

Client packet roles are never trusted by themselves. Receivers validate sender identity against the LiveKit participant identity and sender role against server-issued participant attributes.

LiveKit currently exposes own-metadata/attribute updates to the participant that owns the token. The token grant therefore enables `canUpdateOwnMetadata` for connected participants, but that is not the authority boundary. Receiver-side validation against the authoritative participant identity plus the server-issued role attributes is the security boundary.

Classroom shared activity control is limited to owner, instructor, and authorized TA. Students and auditors cannot control shared activity.

## Rejection rules

Packets and snapshots are rejected when malformed, stale, duplicate, unsupported, unauthorized, or targeted at the wrong room/domain.

Malformed or unsupported activity values such as a shared `audio-only` payload are rejected and must never override local media or layout preferences.

## Deterministic revision handling

Conflict resolution is deterministic and uses this exact ordering:

1. Higher revision wins.
2. If revisions are equal, higher `updatedAt` wins.
3. If revision and `updatedAt` are equal, lexically greater stable `packetId` wins.
4. An identical `packetId` is a duplicate and is ignored.

Arrival order is never used as a tie-break.

## Late join hydration

Authorized controllers write the latest accepted shared activity state to their participant attributes. Late joiners hydrate from the newest valid authorized snapshot only after validating the snapshot owner's participant identity and server-issued role.

## Phase 2 boundaries

- Classroom connects to synchronized shared activity.
- Personal layout and audio-only preferences remain local.
- Screen-share and whiteboard activity selection remain Classroom-specific.
- Meet is not integrated in Phase 2.
- No database or entitlement changes are included.
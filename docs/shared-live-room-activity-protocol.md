# Shared Live-Room Activity Protocol Design

Status: design only for Phase 2.

**Synchronization: NOT IMPLEMENTED IN PHASE 1.**

**Late-join hydration: NOT IMPLEMENTED IN PHASE 1.**

## Protocol envelope

- `protocolVersion`: `shared-live-room-activity.v1`.
- `roomIdentity`: stable LiveKit room/session identifier issued by the server.
- `activity`: one of `welcome`, `gallery`, `focus`, `discussion`, `screen-share`, `presentation`, or `whiteboard`.
- `sequence`: monotonic room-scoped integer/version. Receivers reject stale or duplicate events with `sequence <= lastAcceptedSequence`.
- `actorIdentity`: LiveKit participant identity of the actor requesting the change.
- `trustedActorRoleSource`: server-issued LiveKit metadata/attributes or server-side session state. A role written inside a client packet never authorizes the packet.
- `selectedPresenterIdentity`: optional participant identity for focus/presentation.
- `screenSharePublicationIdentity`: optional publication/track identity for active screen share.
- `updatedAt`: server timestamp for observability, not the primary ordering source.

## Update validation

The server-authoritative boundary validates every requested activity change before broadcast. Client-declared roles are advisory only and must be ignored for authorization. The trusted role source is server-issued LiveKit metadata/attributes derived from existing Classroom or future Meet authorization decisions.

Receivers apply only events with the expected protocol version and a newer sequence than the last accepted event for the room. Invalid, stale, out-of-order, unauthorized, or unknown-activity events are rejected without changing local activity.

## Two-teacher conflict handling

For Classroom, owner/instructor/TA changes that arrive concurrently are serialized by the server sequence. If two authorized teachers request conflicting activities before either observes the other's result, the lower server-assigned sequence wins first and the higher sequence becomes the final state. If a deterministic tie-break is required before sequence assignment, compare `(serverReceivedAt, actorIdentity)` ascending.

## Snapshot protocol

- Snapshot request: `{ protocolVersion, roomIdentity, requesterIdentity, requesterKnownSequence }`.
- Snapshot response: `{ protocolVersion, roomIdentity, activity, sequence, selectedPresenterIdentity?, screenSharePublicationIdentity?, updatedAt }`.
- A late joiner requests a snapshot after LiveKit connection and trusted metadata hydration. The response is applied only if its sequence is newer than local state.

## Session reset

A new room/session identity resets accepted sequence to zero and falls back to `gallery` after join. Prejoin may display `welcome`, but `welcome` is not the normal post-join Classroom activity.

## Classroom permissions

- `owner`, `instructor`, and `ta`: may request `gallery`, `focus`, `discussion`, `screen-share`, `presentation`, and Classroom-only `whiteboard`.
- `student`: may use local personal layout and media controls when allowed, but may not authoritatively change shared activity unless a later phase grants a specific classroom tool permission.
- `auditor`: spectator only; cannot publish or request shared activity changes.
- Whiteboard remains Classroom-only and optional.

## Future Meet permissions

Meet may map owner/presenter/co-host to authorized activity actors and participant/spectator to restricted actors. Meet must not receive whiteboard activity unless separately approved. Existing notes, chat, transcript, recording, presentation, screen share, and AI semantics remain domain-owned.

## Transport recommendation

Use a LiveKit data channel or server-mediated room event channel with server-side validation and server-assigned sequence. Client packets request changes; validated server broadcasts establish authority.
import { test, expect } from '@playwright/test';
import {
  LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION,
  LIVE_ROOM_ACTIVITY_TOPIC,
  acceptSharedActivityPacket,
  acceptSharedActivitySnapshot,
  canControlSharedActivity,
  compareSharedActivityStatePriority,
  createSharedActivityPacket,
  createSharedActivityState,
  decodeSharedActivityPacket,
  encodeSharedActivityPacket,
  selectAuthorizedSharedActivitySnapshot,
} from '@/lib/liveRoomActivitySync';

test.describe('shared live-room activity synchronization protocol', () => {
  const current = createSharedActivityState({
    roomId: 'lesson-1',
    domain: 'classroom',
    activity: 'gallery',
    revision: 1,
    updatedAt: 100,
    senderIdentity: 'teacher-1',
    senderRole: 'owner',
  });

  test('encodes versioned reliable topic packets', () => {
    const packet = createSharedActivityPacket({
      kind: 'activity.set', roomId: 'lesson-1', domain: 'classroom', activity: 'discussion', revision: 2, updatedAt: 200, senderIdentity: 'teacher-1', senderRole: 'owner', packetId: 'packet-1',
    });
    expect(packet.protocol).toBe(LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION);
    expect(LIVE_ROOM_ACTIVITY_TOPIC).toBe('conferly.live-room.activity.v1');
    expect(decodeSharedActivityPacket(encodeSharedActivityPacket(packet))).toEqual(packet);
  });

  test('accepts authorized owner/instructor/ta revisions', () => {
    for (const senderRole of ['owner', 'instructor', 'ta'] as const) {
      const packet = createSharedActivityPacket({ kind: 'activity.set', roomId: 'lesson-1', domain: 'classroom', activity: 'discussion', revision: 2, updatedAt: 200, senderIdentity: `${senderRole}-1`, senderRole, packetId: `${senderRole}-packet` });
      const accepted = acceptSharedActivityPacket({ packet, current, topic: LIVE_ROOM_ACTIVITY_TOPIC, participantIdentity: `${senderRole}-1`, participantRole: senderRole, seenPacketIds: new Set() });
      expect(accepted.accepted).toBe(true);
    }
  });

  test('rejects malformed unsupported wrong-room duplicate stale and unauthorized packets', () => {
    const valid = createSharedActivityPacket({ kind: 'activity.set', roomId: 'lesson-1', domain: 'classroom', activity: 'discussion', revision: 2, updatedAt: 200, senderIdentity: 'teacher-1', senderRole: 'owner', packetId: 'packet-1' });
    expect(acceptSharedActivityPacket({ packet: null, current, topic: LIVE_ROOM_ACTIVITY_TOPIC, seenPacketIds: new Set() })).toEqual({ accepted: false, reason: 'malformed' });
    expect(acceptSharedActivityPacket({ packet: { ...valid, protocol: 99 as 1 }, current, topic: LIVE_ROOM_ACTIVITY_TOPIC, seenPacketIds: new Set() })).toEqual({ accepted: false, reason: 'unsupported' });
    expect(acceptSharedActivityPacket({ packet: { ...valid, roomId: 'other' }, current, topic: LIVE_ROOM_ACTIVITY_TOPIC, seenPacketIds: new Set() })).toEqual({ accepted: false, reason: 'wrong-room' });
    expect(acceptSharedActivityPacket({ packet: valid, current, topic: LIVE_ROOM_ACTIVITY_TOPIC, seenPacketIds: new Set(['packet-1']) })).toEqual({ accepted: false, reason: 'duplicate' });
    expect(acceptSharedActivityPacket({ packet: { ...valid, revision: 1, updatedAt: 99, packetId: 'packet-0' }, current, topic: LIVE_ROOM_ACTIVITY_TOPIC, seenPacketIds: new Set() })).toEqual({ accepted: false, reason: 'stale' });
    expect(acceptSharedActivityPacket({ packet: { ...valid, senderRole: 'student' }, current, topic: LIVE_ROOM_ACTIVITY_TOPIC, participantIdentity: 'teacher-1', participantRole: 'student', seenPacketIds: new Set() })).toEqual({ accepted: false, reason: 'unauthorized' });
  });

  test('rejects shared audio-only packets as malformed and keeps local audio-only preference local', () => {
    const localAudioOnlyPreference = true;
    const malformedAudioOnlyPayload = {
      protocol: LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION,
      kind: 'activity.set',
      packetId: 'audio-only-packet',
      roomId: 'lesson-1',
      domain: 'classroom',
      activity: 'audio-only',
      revision: 2,
      updatedAt: 200,
      senderIdentity: 'teacher-1',
      senderRole: 'owner',
    };

    expect(decodeSharedActivityPacket(encodeSharedActivityPacket(malformedAudioOnlyPayload as never))).toBeNull();

    const acceptedSharedUpdate = acceptSharedActivityPacket({
      packet: createSharedActivityPacket({
        kind: 'activity.set',
        roomId: 'lesson-1',
        domain: 'classroom',
        activity: 'discussion',
        revision: 2,
        updatedAt: 210,
        senderIdentity: 'teacher-1',
        senderRole: 'owner',
        packetId: 'packet-2',
      }),
      current,
      topic: LIVE_ROOM_ACTIVITY_TOPIC,
      participantIdentity: 'teacher-1',
      participantRole: 'owner',
      seenPacketIds: new Set(),
    });

    expect(acceptedSharedUpdate.accepted).toBe(true);
    expect(localAudioOnlyPreference).toBe(true);
  });

  test('rejects claimed teacher role when participant metadata identifies a student', () => {
    const spoofedPacket = createSharedActivityPacket({
      kind: 'activity.set',
      roomId: 'lesson-1',
      domain: 'classroom',
      activity: 'discussion',
      revision: 2,
      updatedAt: 200,
      senderIdentity: 'student-1',
      senderRole: 'owner',
      packetId: 'spoofed-teacher-packet',
    });

    expect(acceptSharedActivityPacket({
      packet: spoofedPacket,
      current,
      topic: LIVE_ROOM_ACTIVITY_TOPIC,
      participantIdentity: 'student-1',
      participantRole: 'student',
      seenPacketIds: new Set(),
    })).toEqual({ accepted: false, reason: 'unauthorized' });
  });

  test('applies deterministic ordering: revision, updatedAt, lexical packetId, duplicate packetId', () => {
    const base = createSharedActivityState({
      roomId: 'lesson-1',
      domain: 'classroom',
      activity: 'gallery',
      revision: 3,
      updatedAt: 300,
      senderIdentity: 'teacher-1',
      senderRole: 'owner',
      packetId: 'packet-a',
    });

    expect(compareSharedActivityStatePriority({ revision: 4, updatedAt: 100, packetId: 'packet-z' }, base)).toBeGreaterThan(0);
    expect(compareSharedActivityStatePriority({ revision: 3, updatedAt: 301, packetId: 'packet-b' }, base)).toBeGreaterThan(0);
    expect(compareSharedActivityStatePriority({ revision: 3, updatedAt: 300, packetId: 'packet-z' }, base)).toBeGreaterThan(0);
    expect(compareSharedActivityStatePriority({ revision: 3, updatedAt: 300, packetId: 'packet-a' }, base)).toBe(0);
    expect(compareSharedActivityStatePriority({ revision: 3, updatedAt: 300, packetId: 'packet-0' }, base)).toBeLessThan(0);
  });

  test('late joiner selects newest authorized snapshot and ignores unauthorized, wrong-room, and wrong-domain snapshots', () => {
    const selected = selectAuthorizedSharedActivitySnapshot({
      current,
      snapshots: [
        {
          snapshot: createSharedActivityState({ roomId: 'lesson-1', domain: 'classroom', activity: 'discussion', revision: 2, updatedAt: 200, senderIdentity: 'student-1', senderRole: 'student', packetId: 'student-packet' }),
          participantIdentity: 'student-1',
          participantRole: 'student',
        },
        {
          snapshot: createSharedActivityState({ roomId: 'lesson-1', domain: 'classroom', activity: 'presentation', revision: 2, updatedAt: 220, senderIdentity: 'auditor-1', senderRole: 'auditor', packetId: 'auditor-packet' }),
          participantIdentity: 'auditor-1',
          participantRole: 'auditor',
        },
        {
          snapshot: createSharedActivityState({ roomId: 'other-room', domain: 'classroom', activity: 'discussion', revision: 9, updatedAt: 999, senderIdentity: 'teacher-2', senderRole: 'owner', packetId: 'wrong-room' }),
          participantIdentity: 'teacher-2',
          participantRole: 'owner',
        },
        {
          snapshot: createSharedActivityState({ roomId: 'lesson-1', domain: 'meet', activity: 'presentation', revision: 9, updatedAt: 999, senderIdentity: 'teacher-3', senderRole: 'host', packetId: 'wrong-domain' }),
          participantIdentity: 'teacher-3',
          participantRole: 'host',
        },
        {
          snapshot: createSharedActivityState({ roomId: 'lesson-1', domain: 'classroom', activity: 'discussion', revision: 2, updatedAt: 250, senderIdentity: 'teacher-2', senderRole: 'owner', packetId: 'teacher-z' }),
          participantIdentity: 'teacher-2',
          participantRole: 'owner',
        },
        {
          snapshot: createSharedActivityState({ roomId: 'lesson-1', domain: 'classroom', activity: 'whiteboard', revision: 2, updatedAt: 250, senderIdentity: 'teacher-4', senderRole: 'owner', packetId: 'teacher-zz' }),
          participantIdentity: 'teacher-4',
          participantRole: 'owner',
        },
      ],
    });

    expect(selected).not.toBeNull();
    expect(selected?.activity).toBe('whiteboard');
    expect(selected?.packetId).toBe('teacher-zz');
  });

  test('rejects unauthorized, wrong-room, and wrong-domain snapshots directly', () => {
    expect(acceptSharedActivitySnapshot({
      snapshot: createSharedActivityState({
        roomId: 'lesson-1',
        domain: 'classroom',
        activity: 'discussion',
        revision: 2,
        updatedAt: 200,
        senderIdentity: 'auditor-1',
        senderRole: 'auditor',
        packetId: 'auditor-direct',
      }),
      current,
      participantIdentity: 'auditor-1',
      participantRole: 'auditor',
    })).toEqual({ accepted: false, reason: 'unauthorized' });

    expect(acceptSharedActivitySnapshot({
      snapshot: createSharedActivityState({
        roomId: 'lesson-2',
        domain: 'classroom',
        activity: 'discussion',
        revision: 2,
        updatedAt: 200,
        senderIdentity: 'teacher-2',
        senderRole: 'owner',
        packetId: 'wrong-room-direct',
      }),
      current,
      participantIdentity: 'teacher-2',
      participantRole: 'owner',
    })).toEqual({ accepted: false, reason: 'wrong-room' });

    expect(acceptSharedActivitySnapshot({
      snapshot: createSharedActivityState({
        roomId: 'lesson-1',
        domain: 'meet',
        activity: 'presentation',
        revision: 2,
        updatedAt: 200,
        senderIdentity: 'teacher-3',
        senderRole: 'host',
        packetId: 'wrong-domain-direct',
      }),
      current,
      participantIdentity: 'teacher-3',
      participantRole: 'host',
    })).toEqual({ accepted: false, reason: 'wrong-room' });
  });

  test('packet and attribute snapshot converge to the same accepted state', () => {
    const candidate = createSharedActivityPacket({
      kind: 'activity.set',
      roomId: 'lesson-1',
      domain: 'classroom',
      activity: 'presentation',
      revision: 2,
      updatedAt: 240,
      senderIdentity: 'teacher-1',
      senderRole: 'owner',
      packetId: 'packet-converged',
    });

    const packetResult = acceptSharedActivityPacket({
      packet: candidate,
      current,
      topic: LIVE_ROOM_ACTIVITY_TOPIC,
      participantIdentity: 'teacher-1',
      participantRole: 'owner',
      seenPacketIds: new Set(),
    });

    const snapshotResult = acceptSharedActivitySnapshot({
      snapshot: createSharedActivityState(candidate),
      current,
      participantIdentity: 'teacher-1',
      participantRole: 'owner',
    });

    expect(packetResult).toEqual(snapshotResult);
    expect(packetResult.accepted).toBe(true);
  });

  test('student and auditor cannot control Classroom activity', () => {
    expect(canControlSharedActivity('classroom', 'owner')).toBe(true);
    expect(canControlSharedActivity('classroom', 'instructor')).toBe(true);
    expect(canControlSharedActivity('classroom', 'ta')).toBe(true);
    expect(canControlSharedActivity('classroom', 'student')).toBe(false);
    expect(canControlSharedActivity('classroom', 'auditor')).toBe(false);
  });

  test('Meet only allows host and presenter to control shared activity', () => {
    expect(canControlSharedActivity('meet', 'host')).toBe(true);
    expect(canControlSharedActivity('meet', 'presenter')).toBe(true);
    expect(canControlSharedActivity('meet', 'participant')).toBe(false);
    expect(canControlSharedActivity('meet', 'viewer')).toBe(false);
    expect(canControlSharedActivity('meet', 'co-host')).toBe(false);
  });

  test('Meet rejects whiteboard packets and snapshots', () => {
    const meetCurrent = createSharedActivityState({
      roomId: 'meeting-1',
      domain: 'meet',
      activity: 'gallery',
      revision: 1,
      updatedAt: 100,
      senderIdentity: 'host-1',
      senderRole: 'host',
    });

    const whiteboardPacket = createSharedActivityPacket({
      kind: 'activity.set',
      roomId: 'meeting-1',
      domain: 'meet',
      activity: 'whiteboard',
      revision: 2,
      updatedAt: 200,
      senderIdentity: 'host-1',
      senderRole: 'host',
      packetId: 'meet-whiteboard-packet',
    });

    expect(whiteboardPacket.activity).toBe('gallery');

    expect(acceptSharedActivityPacket({
      packet: { ...whiteboardPacket, activity: 'whiteboard' },
      current: meetCurrent,
      topic: LIVE_ROOM_ACTIVITY_TOPIC,
      participantIdentity: 'host-1',
      participantRole: 'host',
      seenPacketIds: new Set(),
    })).toEqual({ accepted: false, reason: 'unsupported' });

    expect(acceptSharedActivitySnapshot({
      snapshot: {
        ...createSharedActivityState({
          roomId: 'meeting-1',
          domain: 'meet',
          activity: 'whiteboard',
          revision: 2,
          updatedAt: 200,
          senderIdentity: 'host-1',
          senderRole: 'host',
          packetId: 'meet-whiteboard-snapshot',
        }),
        activity: 'whiteboard',
      },
      current: meetCurrent,
      participantIdentity: 'host-1',
      participantRole: 'host',
    })).toEqual({ accepted: false, reason: 'unsupported' });
  });

  test('Meet rejects claimed host role when server-issued metadata says participant', () => {
    const meetCurrent = createSharedActivityState({
      roomId: 'meeting-1',
      domain: 'meet',
      activity: 'gallery',
      revision: 1,
      updatedAt: 100,
      senderIdentity: 'host-1',
      senderRole: 'host',
    });

    const spoofedPacket = createSharedActivityPacket({
      kind: 'activity.set',
      roomId: 'meeting-1',
      domain: 'meet',
      activity: 'discussion',
      revision: 2,
      updatedAt: 200,
      senderIdentity: 'participant-1',
      senderRole: 'host',
      packetId: 'meet-spoofed-host',
    });

    expect(acceptSharedActivityPacket({
      packet: spoofedPacket,
      current: meetCurrent,
      topic: LIVE_ROOM_ACTIVITY_TOPIC,
      participantIdentity: 'participant-1',
      participantRole: 'participant',
      seenPacketIds: new Set(),
    })).toEqual({ accepted: false, reason: 'unauthorized' });
  });
});
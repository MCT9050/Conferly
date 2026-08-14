import { test, expect } from '@playwright/test';
import {
  LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION,
  LIVE_ROOM_ACTIVITY_TOPIC,
  acceptSharedActivityPacket,
  canControlSharedActivity,
  createSharedActivityPacket,
  createSharedActivityState,
  decodeSharedActivityPacket,
  encodeSharedActivityPacket,
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
    expect(acceptSharedActivityPacket({ packet: { ...valid, revision: 1, updatedAt: 100 }, current, topic: LIVE_ROOM_ACTIVITY_TOPIC, seenPacketIds: new Set() })).toEqual({ accepted: false, reason: 'stale' });
    expect(acceptSharedActivityPacket({ packet: { ...valid, senderRole: 'student' }, current, topic: LIVE_ROOM_ACTIVITY_TOPIC, participantIdentity: 'teacher-1', participantRole: 'student', seenPacketIds: new Set() })).toEqual({ accepted: false, reason: 'unauthorized' });
  });

  test('student and auditor cannot control Classroom activity', () => {
    expect(canControlSharedActivity('classroom', 'owner')).toBe(true);
    expect(canControlSharedActivity('classroom', 'instructor')).toBe(true);
    expect(canControlSharedActivity('classroom', 'ta')).toBe(true);
    expect(canControlSharedActivity('classroom', 'student')).toBe(false);
    expect(canControlSharedActivity('classroom', 'auditor')).toBe(false);
  });
});
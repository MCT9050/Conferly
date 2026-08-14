import type { ClassroomRole } from '@/types';

export const LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION = 1 as const;
export const LIVE_ROOM_ACTIVITY_TOPIC = 'conferly.live-room.activity.v1' as const;
export const LIVE_ROOM_ACTIVITY_ATTRIBUTE = 'conferly.liveRoom.activity.v1' as const;

export type SharedLiveRoomDomain = 'classroom' | 'meet';
export type SharedLiveRoomActivity = 'welcome' | 'gallery' | 'focus' | 'discussion' | 'screen-share' | 'presentation' | 'whiteboard' | 'audio-only';
export type SharedLiveRoomRole = ClassroomRole | 'host' | 'co-host' | 'presenter' | 'participant' | 'auditor' | 'viewer';
export type SharedLiveRoomPacketKind = 'activity.set' | 'activity.snapshot';

export type SharedActivityState = {
  protocol: typeof LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION;
  roomId: string;
  domain: SharedLiveRoomDomain;
  activity: SharedLiveRoomActivity;
  revision: number;
  updatedAt: number;
  senderIdentity: string;
  senderRole: SharedLiveRoomRole;
};

export type SharedActivityPacket = SharedActivityState & {
  kind: SharedLiveRoomPacketKind;
  packetId: string;
};

export type SharedActivityRejectReason =
  | 'malformed'
  | 'unsupported'
  | 'wrong-room'
  | 'unauthorized'
  | 'stale'
  | 'duplicate';

export type SharedActivityAcceptResult =
  | { accepted: true; state: SharedActivityState }
  | { accepted: false; reason: SharedActivityRejectReason };

export const SHARED_CLASSROOM_CONTROL_ROLES = new Set<SharedLiveRoomRole>(['owner', 'instructor', 'ta']);

const ACTIVITIES = new Set<SharedLiveRoomActivity>([
  'welcome',
  'gallery',
  'focus',
  'discussion',
  'screen-share',
  'presentation',
  'whiteboard',
  'audio-only',
]);

const CLASSROOM_ACTIVITIES = new Set<SharedLiveRoomActivity>([
  'welcome',
  'gallery',
  'focus',
  'discussion',
  'screen-share',
  'presentation',
  'whiteboard',
]);

export function canControlSharedClassroomActivity(role: SharedLiveRoomRole | null | undefined): boolean {
  return Boolean(role && SHARED_CLASSROOM_CONTROL_ROLES.has(role));
}

export function canControlSharedActivity(domain: SharedLiveRoomDomain, role: SharedLiveRoomRole | null | undefined): boolean {
  if (domain === 'classroom') return canControlSharedClassroomActivity(role);
  return role === 'host' || role === 'co-host' || role === 'presenter';
}

export function normalizeSharedClassroomActivity(activity: SharedLiveRoomActivity): SharedLiveRoomActivity {
  if (activity === 'focus') return 'focus';
  if (activity === 'audio-only') return 'gallery';
  return CLASSROOM_ACTIVITIES.has(activity) ? activity : 'gallery';
}

export function createSharedActivityState(input: Omit<SharedActivityState, 'protocol' | 'updatedAt'> & { updatedAt?: number }): SharedActivityState {
  return {
    protocol: LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION,
    roomId: input.roomId,
    domain: input.domain,
    activity: input.domain === 'classroom' ? normalizeSharedClassroomActivity(input.activity) : input.activity,
    revision: Math.max(0, Math.trunc(input.revision)),
    updatedAt: input.updatedAt ?? Date.now(),
    senderIdentity: input.senderIdentity,
    senderRole: input.senderRole,
  };
}

export function createSharedActivityPacket(input: Omit<SharedActivityPacket, 'protocol' | 'updatedAt' | 'packetId'> & { updatedAt?: number; packetId?: string }): SharedActivityPacket {
  const state = createSharedActivityState(input);
  return {
    ...state,
    kind: input.kind,
    packetId: input.packetId ?? `${state.roomId}:${state.revision}:${state.senderIdentity}:${state.updatedAt}`,
  };
}

export function encodeSharedActivityPacket(packet: SharedActivityPacket): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(packet));
}

export function decodeSharedActivityPacket(payload: Uint8Array): SharedActivityPacket | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload)) as Partial<SharedActivityPacket>;
    if (parsed.protocol !== LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION) return null;
    if (parsed.kind !== 'activity.set' && parsed.kind !== 'activity.snapshot') return null;
    if (typeof parsed.packetId !== 'string' || !parsed.packetId) return null;
    if (typeof parsed.roomId !== 'string' || !parsed.roomId) return null;
    if (parsed.domain !== 'classroom' && parsed.domain !== 'meet') return null;
    if (typeof parsed.activity !== 'string' || !ACTIVITIES.has(parsed.activity as SharedLiveRoomActivity)) return null;
    if (typeof parsed.revision !== 'number' || !Number.isFinite(parsed.revision)) return null;
    if (typeof parsed.updatedAt !== 'number' || !Number.isFinite(parsed.updatedAt)) return null;
    if (typeof parsed.senderIdentity !== 'string' || !parsed.senderIdentity) return null;
    if (typeof parsed.senderRole !== 'string' || !parsed.senderRole) return null;
    return parsed as SharedActivityPacket;
  } catch {
    return null;
  }
}

export function encodeSharedActivityAttribute(state: SharedActivityState): string {
  return JSON.stringify(state);
}

export function decodeSharedActivityAttribute(value: string | undefined): SharedActivityState | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as SharedActivityState;
    if (parsed.protocol !== LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION) return null;
    if (!parsed.roomId || !ACTIVITIES.has(parsed.activity)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function acceptSharedActivityPacket(params: {
  packet: SharedActivityPacket | null;
  current: SharedActivityState;
  topic?: string;
  participantIdentity?: string;
  participantRole?: SharedLiveRoomRole | null;
  seenPacketIds: ReadonlySet<string>;
}): SharedActivityAcceptResult {
  const { packet, current, topic, participantIdentity, participantRole, seenPacketIds } = params;
  if (topic !== undefined && topic !== LIVE_ROOM_ACTIVITY_TOPIC) return { accepted: false, reason: 'malformed' };
  if (!packet) return { accepted: false, reason: 'malformed' };
  if (packet.protocol !== LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION) return { accepted: false, reason: 'unsupported' };
  if (packet.roomId !== current.roomId || packet.domain !== current.domain) return { accepted: false, reason: 'wrong-room' };
  if (seenPacketIds.has(packet.packetId)) return { accepted: false, reason: 'duplicate' };
  if (participantIdentity && packet.senderIdentity !== participantIdentity) return { accepted: false, reason: 'unauthorized' };
  if (participantRole && packet.senderRole !== participantRole) return { accepted: false, reason: 'unauthorized' };
  if (!canControlSharedActivity(current.domain, packet.senderRole)) return { accepted: false, reason: 'unauthorized' };
  if (packet.revision < current.revision) return { accepted: false, reason: 'stale' };
  if (packet.revision === current.revision && packet.updatedAt <= current.updatedAt) return { accepted: false, reason: 'stale' };
  return { accepted: true, state: createSharedActivityState(packet) };
}
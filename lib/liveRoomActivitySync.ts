import type { ClassroomRole } from '@/types';

export const LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION = 1 as const;
export const LIVE_ROOM_ACTIVITY_TOPIC = 'conferly.live-room.activity.v1' as const;
export const LIVE_ROOM_ACTIVITY_ATTRIBUTE = 'conferly.liveRoom.activity.v1' as const;

export type SharedLiveRoomDomain = 'classroom' | 'meet';
export type SharedLiveRoomActivity = 'welcome' | 'gallery' | 'focus' | 'discussion' | 'screen-share' | 'presentation' | 'whiteboard';
export type SharedLiveRoomRole = ClassroomRole | 'host' | 'co-host' | 'presenter' | 'participant' | 'auditor' | 'viewer';
export type SharedLiveRoomPacketKind = 'activity.set' | 'activity.snapshot';

export type SharedActivityState = {
  protocol: typeof LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION;
  packetId: string;
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
  return CLASSROOM_ACTIVITIES.has(activity) ? activity : 'gallery';
}

export function createSharedActivityState(input: Omit<SharedActivityState, 'protocol' | 'updatedAt' | 'packetId'> & { updatedAt?: number; packetId?: string }): SharedActivityState {
  const updatedAt = input.updatedAt ?? Date.now();
  const revision = Math.max(0, Math.trunc(input.revision));
  return {
    protocol: LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION,
    packetId: input.packetId ?? `${input.roomId}:${revision}:${input.senderIdentity}:${updatedAt}`,
    roomId: input.roomId,
    domain: input.domain,
    activity: input.domain === 'classroom' ? normalizeSharedClassroomActivity(input.activity) : input.activity,
    revision,
    updatedAt,
    senderIdentity: input.senderIdentity,
    senderRole: input.senderRole,
  };
}

export function createSharedActivityPacket(input: Omit<SharedActivityPacket, 'protocol' | 'updatedAt' | 'packetId'> & { updatedAt?: number; packetId?: string }): SharedActivityPacket {
  const state = createSharedActivityState(input);
  return {
    ...state,
    kind: input.kind,
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
    if (!parsed.packetId || !parsed.roomId || !ACTIVITIES.has(parsed.activity)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function compareSharedActivityStatePriority(candidate: Pick<SharedActivityState, 'revision' | 'updatedAt' | 'packetId'>, current: Pick<SharedActivityState, 'revision' | 'updatedAt' | 'packetId'>): number {
  if (candidate.packetId === current.packetId) return 0;
  if (candidate.revision !== current.revision) return candidate.revision > current.revision ? 1 : -1;
  if (candidate.updatedAt !== current.updatedAt) return candidate.updatedAt > current.updatedAt ? 1 : -1;
  return candidate.packetId.localeCompare(current.packetId);
}

function validateSharedActivityState(params: {
  state: SharedActivityState | null;
  current: SharedActivityState;
  participantIdentity?: string;
  participantRole?: SharedLiveRoomRole | null;
}): SharedActivityAcceptResult {
  const { state, current, participantIdentity, participantRole } = params;
  if (!state) return { accepted: false, reason: 'malformed' };
  if (state.protocol !== LIVE_ROOM_ACTIVITY_PROTOCOL_VERSION) return { accepted: false, reason: 'unsupported' };
  if (state.roomId !== current.roomId || state.domain !== current.domain) return { accepted: false, reason: 'wrong-room' };
  if (participantIdentity && state.senderIdentity !== participantIdentity) return { accepted: false, reason: 'unauthorized' };
  if (participantRole && state.senderRole !== participantRole) return { accepted: false, reason: 'unauthorized' };
  if (!canControlSharedActivity(current.domain, state.senderRole)) return { accepted: false, reason: 'unauthorized' };
  return { accepted: true, state };
}

export function acceptSharedActivitySnapshot(params: {
  snapshot: SharedActivityState | null;
  current: SharedActivityState;
  participantIdentity?: string;
  participantRole?: SharedLiveRoomRole | null;
}): SharedActivityAcceptResult {
  const validated = validateSharedActivityState({
    state: params.snapshot,
    current: params.current,
    participantIdentity: params.participantIdentity,
    participantRole: params.participantRole,
  });
  if (!validated.accepted) return validated;
  const comparison = compareSharedActivityStatePriority(validated.state, params.current);
  if (comparison === 0) return { accepted: false, reason: 'duplicate' };
  if (comparison < 0) return { accepted: false, reason: 'stale' };
  return { accepted: true, state: createSharedActivityState(validated.state) };
}

export function selectAuthorizedSharedActivitySnapshot(params: {
  current: SharedActivityState;
  snapshots: Array<{
    snapshot: SharedActivityState | null;
    participantIdentity?: string;
    participantRole?: SharedLiveRoomRole | null;
  }>;
}): SharedActivityState | null {
  const { current, snapshots } = params;
  let selected: SharedActivityState | null = null;
  for (const candidate of snapshots) {
    const base = selected ?? current;
    const accepted = acceptSharedActivitySnapshot({
      snapshot: candidate.snapshot,
      current: base,
      participantIdentity: candidate.participantIdentity,
      participantRole: candidate.participantRole,
    });
    if (accepted.accepted) {
      selected = accepted.state;
    }
  }
  return selected;
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
  const validated = validateSharedActivityState({ state: packet, current, participantIdentity, participantRole });
  if (!validated.accepted) return validated;
  const acceptedPacket = validated.state as SharedActivityPacket;
  if (seenPacketIds.has(acceptedPacket.packetId)) return { accepted: false, reason: 'duplicate' };
  const comparison = compareSharedActivityStatePriority(acceptedPacket, current);
  if (comparison === 0) return { accepted: false, reason: 'duplicate' };
  if (comparison < 0) return { accepted: false, reason: 'stale' };
  return { accepted: true, state: createSharedActivityState(validated.state) };
}
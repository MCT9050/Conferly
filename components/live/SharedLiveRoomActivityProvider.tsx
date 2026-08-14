'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DataPacket_Kind, RoomEvent, type Participant, type Room } from 'livekit-client';
import {
  LIVE_ROOM_ACTIVITY_ATTRIBUTE,
  LIVE_ROOM_ACTIVITY_TOPIC,
  acceptSharedActivityPacket,
  canControlSharedActivity,
  createSharedActivityPacket,
  createSharedActivityState,
  decodeSharedActivityAttribute,
  decodeSharedActivityPacket,
  encodeSharedActivityAttribute,
  encodeSharedActivityPacket,
  type SharedActivityRejectReason,
  type SharedActivityState,
  type SharedLiveRoomActivity,
  type SharedLiveRoomDomain,
  type SharedLiveRoomRole,
} from '@/lib/liveRoomActivitySync';

type Rejection = { reason: SharedActivityRejectReason; at: number };

type SharedLiveRoomActivityContextValue = {
  activity: SharedLiveRoomActivity;
  state: SharedActivityState;
  canControl: boolean;
  lastRejection: Rejection | null;
  setActivity: (activity: SharedLiveRoomActivity) => Promise<boolean>;
};

const SharedLiveRoomActivityContext = createContext<SharedLiveRoomActivityContextValue | null>(null);

type ProviderProps = {
  children: React.ReactNode;
  room: Room | null;
  roomId: string;
  domain: SharedLiveRoomDomain;
  localRole: SharedLiveRoomRole;
  initialActivity?: SharedLiveRoomActivity;
};

function participantRole(participant: Participant | undefined): SharedLiveRoomRole | null {
  const attributes = participant?.attributes as Record<string, string> | undefined;
  return (attributes?.classroomRole || attributes?.role || null) as SharedLiveRoomRole | null;
}

export function SharedLiveRoomActivityProvider({ children, room, roomId, domain, localRole, initialActivity = 'gallery' }: ProviderProps) {
  const initialState = useMemo(() => createSharedActivityState({ roomId, domain, activity: initialActivity, revision: 0, senderIdentity: 'server', senderRole: localRole }), [domain, initialActivity, localRole, roomId]);
  const [state, setState] = useState<SharedActivityState>(initialState);
  const [lastRejection, setLastRejection] = useState<Rejection | null>(null);
  const seenPacketIds = useRef<Set<string>>(new Set());

  useEffect(() => setState((current) => current.roomId === roomId && current.domain === domain ? current : initialState), [domain, initialState, roomId]);

  const applyState = useCallback((next: SharedActivityState) => {
    setState((current) => {
      if (next.revision < current.revision) return current;
      if (next.revision === current.revision && next.updatedAt <= current.updatedAt) return current;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!room) return;
    const hydrateFromAttributes = () => {
      for (const participant of [room.localParticipant, ...Array.from(room.remoteParticipants.values())]) {
        const snapshot = decodeSharedActivityAttribute((participant.attributes as Record<string, string> | undefined)?.[LIVE_ROOM_ACTIVITY_ATTRIBUTE]);
        if (snapshot && snapshot.roomId === roomId && snapshot.domain === domain && canControlSharedActivity(domain, snapshot.senderRole)) applyState(snapshot);
      }
    };
    const onData = (payload: Uint8Array, participant?: Participant, kind?: DataPacket_Kind, topic?: string) => {
      if (kind !== undefined && kind !== DataPacket_Kind.RELIABLE) return;
      const packet = decodeSharedActivityPacket(payload);
      const result = acceptSharedActivityPacket({ packet, current: state, topic, participantIdentity: participant?.identity, participantRole: participantRole(participant), seenPacketIds: seenPacketIds.current });
      if (!result.accepted) {
        setLastRejection({ reason: result.reason, at: Date.now() });
        return;
      }
      seenPacketIds.current.add(packet!.packetId);
      applyState(result.state);
    };
    const onAttributesChanged = () => hydrateFromAttributes();
    hydrateFromAttributes();
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.ParticipantAttributesChanged, onAttributesChanged);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantAttributesChanged, onAttributesChanged);
    };
  }, [applyState, domain, room, roomId, state]);

  const setActivity = useCallback(async (activity: SharedLiveRoomActivity) => {
    if (!room || !canControlSharedActivity(domain, localRole)) {
      setLastRejection({ reason: 'unauthorized', at: Date.now() });
      return false;
    }
    const next = createSharedActivityPacket({ kind: 'activity.set', roomId, domain, activity, revision: state.revision + 1, senderIdentity: room.localParticipant.identity, senderRole: localRole });
    await room.localParticipant.setAttributes({ [LIVE_ROOM_ACTIVITY_ATTRIBUTE]: encodeSharedActivityAttribute(next) });
    await room.localParticipant.publishData(encodeSharedActivityPacket(next), { reliable: true, topic: LIVE_ROOM_ACTIVITY_TOPIC });
    seenPacketIds.current.add(next.packetId);
    applyState(next);
    return true;
  }, [applyState, domain, localRole, room, roomId, state.revision]);

  const value = useMemo(() => ({ activity: state.activity, state, canControl: canControlSharedActivity(domain, localRole), lastRejection, setActivity }), [domain, lastRejection, localRole, setActivity, state]);
  return <SharedLiveRoomActivityContext.Provider value={value}>{children}</SharedLiveRoomActivityContext.Provider>;
}

export function useSharedLiveRoomActivity() {
  const value = useContext(SharedLiveRoomActivityContext);
  if (!value) throw new Error('useSharedLiveRoomActivity must be used inside SharedLiveRoomActivityProvider');
  return value;
}
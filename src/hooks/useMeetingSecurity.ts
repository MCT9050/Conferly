import { useState, useCallback } from 'react';
import type { MeetingSecurity, WaitingRoomEntry, PlanLimits } from '../types';

export function useMeetingSecurity(userId: string, limits: PlanLimits) {
  const [security, setSecurity] = useState<MeetingSecurity>({
    password: null,
    isLocked: false,
    waitingRoomEnabled: false,
    waitingRoom: [],
    e2eEnabled: true,
    hostId: userId,
  });

  const setPassword = useCallback((pwd: string | null) => {
    if (!limits.meetingPassword) return;
    setSecurity(prev => ({ ...prev, password: pwd?.trim() || null }));
  }, [limits.meetingPassword]);

  const toggleLock = useCallback(() => {
    if (!limits.meetingLock) return;
    setSecurity(prev => ({ ...prev, isLocked: !prev.isLocked }));
  }, [limits.meetingLock]);

  const toggleWaitingRoom = useCallback(() => {
    if (!limits.waitingRoom) return;
    setSecurity(prev => ({ ...prev, waitingRoomEnabled: !prev.waitingRoomEnabled }));
  }, [limits.waitingRoom]);

  const admitFromWaitingRoom = useCallback((entryId: string) => {
    setSecurity(prev => ({
      ...prev,
      waitingRoom: prev.waitingRoom.filter(e => e.id !== entryId),
    }));
  }, []);

  const denyFromWaitingRoom = useCallback((entryId: string) => {
    setSecurity(prev => ({
      ...prev,
      waitingRoom: prev.waitingRoom.filter(e => e.id !== entryId),
    }));
  }, []);

  const addToWaitingRoom = useCallback((entry: WaitingRoomEntry) => {
    setSecurity(prev => ({
      ...prev,
      waitingRoom: [...prev.waitingRoom, entry],
    }));
  }, []);

  const verifyPassword = useCallback((input: string): boolean => {
    if (!security.password) return true;
    return input === security.password;
  }, [security.password]);

  const isHost = userId === security.hostId;

  return {
    security,
    isHost,
    setPassword,
    toggleLock,
    toggleWaitingRoom,
    admitFromWaitingRoom,
    denyFromWaitingRoom,
    addToWaitingRoom,
    verifyPassword,
  };
}

"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

type MeetingRoomValue = {
  roomId: string;
  participantCap: string;
  latencyTarget: string;
};

const MeetingRoomContext = createContext<MeetingRoomValue | null>(null);

export function MeetingRoomProvider({ children, roomId = '—', participantCap = '16 people' }: { children: ReactNode; roomId?: string; participantCap?: string }) {
  const value = useMemo(
    () => ({
      roomId,
      participantCap,
      latencyTarget: '<100ms',
    }), [roomId, participantCap]
  );

  return <MeetingRoomContext.Provider value={value}>{children}</MeetingRoomContext.Provider>;
}

export function useMeetingRoom() {
  const context = useContext(MeetingRoomContext);
  if (!context) {
    throw new Error('useMeetingRoom must be used within MeetingRoomProvider');
  }
  return context;
}
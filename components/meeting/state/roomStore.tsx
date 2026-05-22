"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

const MeetingRoomContext = createContext<{
  roomId: string;
  participantCap: string;
  latencyTarget: string;
} | null>(null);

export function MeetingRoomProvider({ children }: { children: ReactNode }) {
  const value = useMemo(
    () => ({
      roomId: 'CONFER123',
      participantCap: '16 people',
      latencyTarget: '<100ms',
    }), []
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

"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { useMeetingPresentationState } from '../../../hooks/useMeetingPresentation';

const MeetingPresentationContext = createContext<ReturnType<typeof useMeetingPresentationState> | null>(null);

export function MeetingPresentationProvider({ children }: { children: ReactNode }) {
  const presentation = useMeetingPresentationState();
  const value = useMemo(() => presentation, [presentation]);

  return <MeetingPresentationContext.Provider value={value}>{children}</MeetingPresentationContext.Provider>;
}

export function useMeetingPresentation() {
  const context = useContext(MeetingPresentationContext);
  if (!context) {
    throw new Error('useMeetingPresentation must be used within MeetingPresentationProvider');
  }
  return context;
}

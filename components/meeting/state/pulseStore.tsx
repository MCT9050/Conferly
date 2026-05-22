"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useMeetingTranscript } from './transcriptStore';

type MeetingPulseContextValue = {
  pulseSummary: string[];
  isPulseLoading: boolean;
  pulseTopics: string[];
  generatePulse: () => void;
};

const MeetingPulseContext = createContext<MeetingPulseContextValue | null>(null);

export function MeetingPulseProvider({ children }: { children: ReactNode }) {
  const transcriptState = useMeetingTranscript();
  const [pulseSummary, setPulseSummary] = useState<string[]>([]);
  const [pulseTopics, setPulseTopics] = useState<string[]>([]);
  const [isPulseLoading, setIsPulseLoading] = useState(false);

  const generatePulse = useCallback(() => {
    const finalEntries = transcriptState.transcript.filter(entry => entry.isFinal);
    if (finalEntries.length === 0) {
      setPulseSummary(['No transcript available yet.']);
      setPulseTopics([]);
      return;
    }

    setIsPulseLoading(true);
    const controller = new AbortController();
    
    const timeout = window.setTimeout(() => {
      if (!controller.signal.aborted) {
        setPulseSummary([
          'Presented meeting goals and agenda updates.',
          'Highlighted inclusive translation flows for SA languages.',
          'Reviewed security and participant experience settings.',
        ]);
        setPulseTopics(['translation', 'security', 'collaboration']);
        setIsPulseLoading(false);
      }
    }, 800);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [transcriptState.transcript]);

  const value = useMemo(
    () => ({ pulseSummary, isPulseLoading, pulseTopics, generatePulse }),
    [pulseSummary, isPulseLoading, pulseTopics, generatePulse]
  );

  return <MeetingPulseContext.Provider value={value}>{children}</MeetingPulseContext.Provider>;
}

export function useMeetingPulse() {
  const context = useContext(MeetingPulseContext);
  if (!context) {
    throw new Error('useMeetingPulse must be used within MeetingPulseProvider');
  }
  return context;
}

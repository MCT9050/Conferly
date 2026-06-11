"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState, useRef } from 'react';
import { useMeetingTranscript } from './transcriptStore';
import { summarizeAction } from '../../../app/actions/ai-actions';

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
  const abortRef = useRef<AbortController | null>(null);

  const generatePulse = useCallback(() => {
    const finalEntries = transcriptState.transcript.filter(entry => entry.isFinal);
    if (finalEntries.length === 0) {
      setPulseSummary(['No transcript available yet.']);
      setPulseTopics([]);
      return;
    }

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsPulseLoading(true);

    // Build the full transcript text for summarization
    const fullText = finalEntries
      .map(e => `[${e.speaker}]: ${e.text}`)
      .join('\n');

    summarizeAction(fullText)
      .then((response) => {
        if (!controller.signal.aborted) {
          // extract text from AIActionResponse
          const summary = response.status === "OK" ? response.data : "Summary unavailable.";
          // Split the summary into bullet points by sentence boundaries
          const bullets = summary
            .split(/(?<=[.!?])\s+/)
            .filter(s => s.trim().length > 0)
            .map(s => s.trim());
          setPulseSummary(bullets.length > 0 ? bullets : [summary]);
          setPulseTopics([]); // Topics are not extracted by bart-large-cnn
          setIsPulseLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error('AI Pulse summarization failed:', err);
          setPulseSummary(['Could not generate summary. The AI service may be unavailable.']);
          setPulseTopics([]);
          setIsPulseLoading(false);
        }
      });
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

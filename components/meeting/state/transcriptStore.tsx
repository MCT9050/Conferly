"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSpeechTranscript } from '../../../hooks/useSpeechTranscript';
import { trackEvent } from '../../../lib/monitoring';

type MeetingTranscriptContextValue = {
  transcript: ReturnType<typeof useSpeechTranscript>['transcript'];
  interimText: string;
  isListening: boolean;
  isSpeechSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
} | null;

const MeetingTranscriptContext = createContext<MeetingTranscriptContextValue | null>(null);

export function MeetingTranscriptProvider({ children }: { children: ReactNode }) {
  // All hooks at the top, unconditional, in fixed order — Rules of Hooks compliant
  const [isClient, setIsClient] = useState(false);
  const transcriptState = useSpeechTranscript();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Monitoring: track transcript size — always called, never conditional
  useEffect(() => {
    trackEvent({
      type: 'custom',
      name: 'transcript_size',
      data: { size: transcriptState.transcript.length },
      timestamp: Date.now(),
    });
  }, [transcriptState.transcript.length]);

  useEffect(() => {
    trackEvent({
      type: 'custom',
      name: 'speech_listening',
      data: { isListening: transcriptState.isListening },
      timestamp: Date.now(),
    });
  }, [transcriptState.isListening]);

  // No early return! All hooks have been called. Conditional data is passed
  // through the Provider value (and memoized for stable references).
  const value = useMemo(
    () =>
      isClient
        ? {
            transcript: transcriptState.transcript,
            interimText: transcriptState.interimText,
            isListening: transcriptState.isListening,
            isSpeechSupported: transcriptState.isSpeechSupported,
            startListening: transcriptState.startListening,
            stopListening: transcriptState.stopListening,
          }
        : null,
    [
      isClient,
      transcriptState.transcript,
      transcriptState.interimText,
      transcriptState.isListening,
      transcriptState.isSpeechSupported,
      transcriptState.startListening,
      transcriptState.stopListening,
    ],
  );

  return <MeetingTranscriptContext.Provider value={value}>{children}</MeetingTranscriptContext.Provider>;
}

export function useMeetingTranscript() {
  const context = useContext(MeetingTranscriptContext);
  if (!context) {
    // Server-side fallback: speech recognition not available
    return {
      transcript: [],
      interimText: '',
      isListening: false,
      isSpeechSupported: false,
      startListening: async () => {},
      stopListening: () => {},
    };
  }
  return context;
}

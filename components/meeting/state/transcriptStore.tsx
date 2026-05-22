"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
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
  const [isClient, setIsClient] = useState(false);
  const transcriptState = useSpeechTranscript();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // On server: provide null (speech recognition not available server-side)
  // On client: provide real transcript state after hydration
  if (!isClient) {
    return <MeetingTranscriptContext.Provider value={null}>{children}</MeetingTranscriptContext.Provider>;
  }

  // Monitoring: track transcript size and listening state
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

  const value = {
    transcript: transcriptState.transcript,
    interimText: transcriptState.interimText,
    isListening: transcriptState.isListening,
    isSpeechSupported: transcriptState.isSpeechSupported,
    startListening: transcriptState.startListening,
    stopListening: transcriptState.stopListening,
  };

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

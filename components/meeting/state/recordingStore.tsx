"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { useMeetingMedia } from './mediaStore';
import { useMeetingRecording } from '../../../hooks/useMeetingRecording';
import { useEffect } from 'react';
import { trackEvent } from '../../../lib/monitoring';

const MeetingRecordingContext = createContext<ReturnType<typeof useMeetingRecording> | null>(null);

export function MeetingRecordingProvider({ children }: { children: ReactNode }) {
  const media = useMeetingMedia();
  const recording = useMeetingRecording(media.stream);

  // Monitoring: track recording state changes (stabilized - only depend on isRecording, not entire object)
  useEffect(() => {
    trackEvent({
      type: 'custom',
      name: 'recording_state',
      data: { isRecording: recording?.isRecording },
      timestamp: Date.now(),
    });
     
  }, [recording?.isRecording]);

  const value = useMemo(() => recording, [recording]);

  return <MeetingRecordingContext.Provider value={value}>{children}</MeetingRecordingContext.Provider>;
}

export function useMeetingRecordingState() {
  const context = useContext(MeetingRecordingContext);
  if (!context) {
    throw new Error('useMeetingRecordingState must be used within MeetingRecordingProvider');
  }
  return context;
}

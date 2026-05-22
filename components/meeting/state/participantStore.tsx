"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Participant } from '../../../types';
import { useMeetingMedia } from './mediaStore';
import { trackEvent } from '../../../lib/monitoring';

type MeetingParticipantContextValue = {
  participants: Participant[];
  participantCount: number;
};

const MeetingParticipantContext = createContext<MeetingParticipantContextValue | null>(null);

const initialRemoteParticipants: Participant[] = [
  { id: 'peer-1', name: 'Anele', avatar: 'AN', stream: null, isSpeaking: true, isVideoOn: true, isMuted: false, audioLevel: 0.08 },
  { id: 'peer-2', name: 'Sipho', avatar: 'SN', stream: null, isSpeaking: false, isVideoOn: true, isMuted: false, audioLevel: 0.02 },
];

export function MeetingParticipantProvider({ children }: { children: ReactNode }) {
  const media = useMeetingMedia();
  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>(initialRemoteParticipants);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemoteParticipants(current => current.map(participant => ({
        ...participant,
        audioLevel: Math.min(0.24, Math.max(0, participant.audioLevel + (Math.random() - 0.45) * 0.05)),
        isSpeaking: Math.random() > 0.68,
      })));
    }, 1800);

    return () => window.clearInterval(interval);
  }, []);

  const participants = useMemo(() => {
    const selfParticipant: Participant = {
      id: 'self',
      name: 'You',
      avatar: 'YO',
      stream: media.stream,
      isSpeaking: false,
      isVideoOn: media.isVideoOn,
      isMuted: media.isMuted,
      audioLevel: media.isMuted ? 0 : 0.04,
    };

    return [selfParticipant, ...remoteParticipants];
  }, [media.stream, media.isMuted, media.isVideoOn, remoteParticipants]);


  // Monitoring: track participant count changes
  useEffect(() => {
    trackEvent({
      type: 'custom',
      name: 'participant_count',
      data: { count: participants.length },
      timestamp: Date.now(),
    });
  }, [participants.length]);

  const value = useMemo(
    () => ({ participants, participantCount: participants.length }),
    [participants]
  );

  return <MeetingParticipantContext.Provider value={value}>{children}</MeetingParticipantContext.Provider>;
}

export function useMeetingParticipants() {
  const context = useContext(MeetingParticipantContext);
  if (!context) {
    throw new Error('useMeetingParticipants must be used within MeetingParticipantProvider');
  }
  return context;
}

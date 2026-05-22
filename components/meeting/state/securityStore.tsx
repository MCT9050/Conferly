"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MeetingSecurity, PlanLimits } from '../../../types';

const defaultPlanLimits: PlanLimits = {
  maxParticipants: 16,
  maxDurationMinutes: 120,
  recording: true,
  transcription: true,
  aiPulse: true,
  waitingRoom: true,
  meetingPassword: true,
  meetingLock: true,
  cloudStorage: true,
  customBranding: false,
  sso: false,
  analytics: false,
  adminDashboard: false,
  prioritySupport: false,
  storageLimitGb: 10,
};

const MeetingSecurityContext = createContext<{
  security: MeetingSecurity;
  isHost: boolean;
  limits: PlanLimits;
  planTier: 'trial' | 'pro' | 'business' | 'enterprise';
  onSetPassword: (pwd: string | null) => void;
  onToggleLock: () => void;
  onToggleWaitingRoom: () => void;
  onAdmit: (id: string) => void;
  onDeny: (id: string) => void;
  onOpenPricing: () => void;
} | null>(null);

export function MeetingSecurityProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [security, setSecurity] = useState<MeetingSecurity>({
    password: null,
    isLocked: false,
    waitingRoomEnabled: false,
    waitingRoom: [],
  });

  const onSetPassword = useCallback((pwd: string | null) => {
    setSecurity(current => ({ ...current, password: pwd }));
  }, []);

  const onToggleLock = useCallback(() => {
    setSecurity(current => ({ ...current, isLocked: !current.isLocked }));
  }, []);

  const onToggleWaitingRoom = useCallback(() => {
    setSecurity(current => ({ ...current, waitingRoomEnabled: !current.waitingRoomEnabled }));
  }, []);

  const onAdmit = useCallback((id: string) => {
    setSecurity(current => ({
      ...current,
      waitingRoom: current.waitingRoom.filter(entry => entry.id !== id),
    }));
  }, []);

  const onDeny = useCallback((id: string) => {
    setSecurity(current => ({
      ...current,
      waitingRoom: current.waitingRoom.filter(entry => entry.id !== id),
    }));
  }, []);

  const onOpenPricing = useCallback(() => {
    router.push('/pricing');
  }, [router]);

  const value = useMemo(
    () => ({
      security,
      isHost: true,
      limits: defaultPlanLimits,
      planTier: 'trial' as const,
      onSetPassword,
      onToggleLock,
      onToggleWaitingRoom,
      onAdmit,
      onDeny,
      onOpenPricing,
    }),
    [security, onSetPassword, onToggleLock, onToggleWaitingRoom, onAdmit, onDeny, onOpenPricing]
  );

  return <MeetingSecurityContext.Provider value={value}>{children}</MeetingSecurityContext.Provider>;
}

export function useMeetingSecurity() {
  const context = useContext(MeetingSecurityContext);
  if (!context) {
    throw new Error('useMeetingSecurity must be used within MeetingSecurityProvider');
  }
  return context;
}

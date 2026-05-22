"use client";

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Reaction, SidebarTab } from '../../../types';

type MeetingUiContextValue = {
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  sidebarTab: SidebarTab;
  setSidebarTab: (value: SidebarTab) => void;
  handRaised: boolean;
  toggleHandRaise: () => void;
  reactions: Reaction[];
  addReaction: (emoji: string) => void;
  meetingDuration: number;
};

const MeetingUiContext = createContext<MeetingUiContextValue | null>(null);

export function MeetingUiProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [handRaised, setHandRaised] = useState(false);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [meetingDuration, setMeetingDuration] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMeetingDuration(current => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const toggleHandRaise = useCallback(() => {
    setHandRaised(current => !current);
  }, []);

  const addReaction = useCallback((emoji: string) => {
    const reaction: Reaction = { id: Math.random().toString(36).slice(2, 10), emoji };
    setReactions(current => [...current, reaction]);
    window.setTimeout(() => {
      setReactions(current => current.filter(item => item.id !== reaction.id));
    }, 2400);
  }, []);

  const value = useMemo(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      sidebarTab,
      setSidebarTab,
      handRaised,
      toggleHandRaise,
      reactions,
      addReaction,
      meetingDuration,
    }),
    [sidebarOpen, sidebarTab, handRaised, reactions, meetingDuration, toggleHandRaise, addReaction]
  );

  return <MeetingUiContext.Provider value={value}>{children}</MeetingUiContext.Provider>;
}

export function useMeetingUi() {
  const context = useContext(MeetingUiContext);
  if (!context) {
    throw new Error('useMeetingUi must be used within MeetingUiProvider');
  }
  return context;
}

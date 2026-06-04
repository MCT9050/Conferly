"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useBrowserMedia } from '../../../hooks/useBrowserMedia';
import { trackEvent } from '../../../lib/monitoring';

type MeetingMediaContextValue = ReturnType<typeof useBrowserMedia> | null;
const MeetingMediaContext = createContext<MeetingMediaContextValue | null>(null);

export function MeetingMediaProvider({ children }: { children: ReactNode }) {
  // All hooks at the top, unconditional, in fixed order — Rules of Hooks compliant
  const [isClient, setIsClient] = useState(false);
  const media = useBrowserMedia();

  // Monitoring: track media errors (stabilized - only tracks when error string changes)
  useEffect(() => {
    if (media?.mediaError) {
      trackEvent({
        type: 'media_failure',
        device: 'unknown',
        reason: media.mediaError,
        timestamp: Date.now(),
      });
    }
  }, [media?.mediaError]); // Only depend on mediaError string, not the entire media object

  useEffect(() => {
    setIsClient(true);
  }, []);

  // No early return! All hooks have been called. Conditional data is passed
  // through the Provider value (and memoized for stable references).
  const value = useMemo(() => (isClient ? media : null), [isClient, media]);

  return <MeetingMediaContext.Provider value={value}>{children}</MeetingMediaContext.Provider>;
}

export function useMeetingMedia() {
  const context = useContext(MeetingMediaContext);
  if (!context) {
    // Server-side fallback: return minimal media state
    // Real implementation only available after client hydration
    return {
      stream: null,
      screenStream: null,
      isMuted: true,
      isVideoOn: true,
      isScreenSharing: false,
      isSupported: false,
      mediaError: null,
      startMedia: async () => null,
      stopMedia: () => {},
      toggleMute: () => {},
      toggleVideo: () => {},
      toggleScreenShare: async () => {},
    };
  }
  return context;
}

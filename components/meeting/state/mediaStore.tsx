"use client";

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { useBrowserMedia } from '../../../hooks/useBrowserMedia';
import { trackEvent } from '../../../lib/monitoring';

type MeetingMediaContextValue = ReturnType<typeof useBrowserMedia> | null;
const MeetingMediaContext = createContext<MeetingMediaContextValue | null>(null);

export function MeetingMediaProvider({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  const media = useBrowserMedia();

  // Monitoring: track media errors
  useEffect(() => {
    if (media.mediaError) {
      trackEvent({
        type: 'media_failure',
        device: 'unknown',
        reason: media.mediaError,
        timestamp: Date.now(),
      });
    }
  }, [media.mediaError]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // On server render: provide null to avoid browser API calls
  // On client hydration: hydrate with real media state
  // This prevents hydration mismatches from browser APIs
  if (!isClient) {
    return <MeetingMediaContext.Provider value={null}>{children}</MeetingMediaContext.Provider>;
  }

  return <MeetingMediaContext.Provider value={media}>{children}</MeetingMediaContext.Provider>;
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

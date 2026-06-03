"use client";

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useConnectionRecovery } from '../../hooks/useConnectionRecovery';
import { trackEvent } from '../../lib/monitoring';
import { useMonitoring } from '../../hooks/useMonitoring';
import { MeetingStateProvider } from './MeetingStateContext';
import MeetingRuntimeFallback from './MeetingRuntimeFallback';
import { ErrorBoundary } from '../ErrorBoundary';
import { MeetingErrorFallback, MediaErrorFallback, PanelErrorFallback } from '../MeetingErrorFallback';

const MeetingMediaStage = dynamic(() => import('./MeetingMediaStage'), {
  ssr: false,
  loading: () => <MeetingRuntimeFallback />,
});
const MeetingSidebarStage = dynamic(() => import('./MeetingSidebarStage'), {
  ssr: false,
  loading: () => <MeetingRuntimeFallback />,
});
const MeetingControlsWrapper = dynamic(() => import('./MeetingControlsWrapper'), {
  ssr: false,
  loading: () => <MeetingRuntimeFallback />,
});

export default function MeetingRuntimeClient() {
  // Connection recovery initialized (dependencies fixed)
  const connectionRecovery = useConnectionRecovery();
  
  // Meeting control states
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [meetingActive, setMeetingActive] = useState(true);

  // Mute handler
  const handleMute = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    trackEvent({
      type: 'custom',
      name: 'meeting_audio_control',
      data: { muted: newMutedState },
      timestamp: Date.now(),
    });
  }, [isMuted]);

  // Share screen handler
  const handleShareScreen = useCallback(() => {
    const newSharingState = !isScreenSharing;
    setIsScreenSharing(newSharingState);
    trackEvent({
      type: 'custom',
      name: 'meeting_screenshare_control',
      data: { sharing: newSharingState },
      timestamp: Date.now(),
    });
  }, [isScreenSharing]);

  // End meeting handler
  const handleEndMeeting = useCallback(() => {
    setMeetingActive(false);
    trackEvent({
      type: 'custom',
      name: 'meeting_ended',
      data: { duration: Date.now() },
      timestamp: Date.now(),
    });
    // Redirect to dashboard after brief delay
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 500);
  }, []);

  return (
    <ErrorBoundary name="MeetingRuntime" fallback={(error, reset) => <MeetingErrorFallback error={error} resetError={reset} />}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.55fr,0.95fr]">
          {/* Meeting media placeholder */}
          <div className="rounded-lg border border-white/10 bg-slate-900/80 p-6 flex items-center justify-center h-96">
            <p className="text-slate-400">Meeting video feed placeholder</p>
          </div>
          
          {/* Sidebar placeholder */}
          <div className="space-y-6">
            <div className="rounded-lg border border-white/10 bg-slate-900/80 p-4">
              <p className="text-sm font-semibold mb-3">Chat</p>
              <div className="h-64 rounded bg-slate-950/50 flex items-center justify-center">
                <p className="text-xs text-slate-500">Chat messages</p>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900/80 p-4">
              <p className="text-sm font-semibold mb-3">Participants</p>
              <div className="h-24 rounded bg-slate-950/50 flex items-center justify-center">
                <p className="text-xs text-slate-500">1 participant</p>
              </div>
            </div>
          </div>
        </div>

        {/* Meeting controls placeholder */}
        <div className="rounded-lg border border-white/10 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Meeting Controls</p>
            <div className="flex gap-2">
              <button 
                onClick={handleMute}
                className={`px-4 py-2 rounded text-sm text-white transition ${
                  isMuted 
                    ? 'bg-red-600 hover:bg-red-500' 
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                {isMuted ? '🔇 Muted' : '🎤 Mute'}
              </button>
              <button 
                onClick={handleShareScreen}
                className={`px-4 py-2 rounded text-sm text-white transition ${
                  isScreenSharing 
                    ? 'bg-blue-600 hover:bg-blue-500' 
                    : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                {isScreenSharing ? '📺 Sharing' : '📺 Share Screen'}
              </button>
              <button 
                onClick={handleEndMeeting}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-sm text-white transition"
              >
                ⏹️ End Meeting
              </button>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

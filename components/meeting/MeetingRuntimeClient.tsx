"use client";

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
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
              <button className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm text-white transition">Mute</button>
              <button className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm text-white transition">Share Screen</button>
              <button className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-sm text-white transition">End Meeting</button>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

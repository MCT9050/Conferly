"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { MeetingStateProvider } from './MeetingStateContext';
import MeetingRuntimeFallback from './MeetingRuntimeFallback';
import { ErrorBoundary } from '../ErrorBoundary';
import { MeetingErrorFallback } from '../MeetingErrorFallback';

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
  return (
    <ErrorBoundary name="MeetingRuntime" fallback={(error, reset) => <MeetingErrorFallback error={error} resetError={reset} />}>
      <MeetingStateProvider>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.55fr,0.95fr]">
            {/* Meeting media stage — actual video grid with LiveKit */} 
            <Suspense fallback={<MeetingRuntimeFallback />}>
              <MeetingMediaStage />
            </Suspense>

            {/* Sidebar stage — chat, participants, transcript, presentation */}
            <Suspense fallback={<MeetingRuntimeFallback />}>
              <MeetingSidebarStage />
            </Suspense>
          </div>

          {/* Meeting controls — mute, video, screen share, recording, reactions */}
          <Suspense fallback={<MeetingRuntimeFallback />}>
            <MeetingControlsWrapper />
          </Suspense>
        </div>
      </MeetingStateProvider>
    </ErrorBoundary>
  );
}

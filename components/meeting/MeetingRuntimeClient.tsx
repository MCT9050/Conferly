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
  // Initialize connection recovery (issue fixed - dependency removed from useEffect)
  const connectionRecovery = useConnectionRecovery();

  return (
    <ErrorBoundary name="MeetingRuntime" fallback={(error, reset) => <MeetingErrorFallback error={error} resetError={reset} />}>
      <MeetingStateProvider>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.55fr,0.95fr]">
            <ErrorBoundary name="MediaStage" fallback={(error, reset) => <MediaErrorFallback error={error} resetError={reset} />}>
              <Suspense fallback={<MeetingRuntimeFallback />}>
                <MeetingMediaStage />
              </Suspense>
            </ErrorBoundary>
            
            <ErrorBoundary name="SidebarStage" fallback={(error, reset) => <PanelErrorFallback error={error} resetError={reset} />}>
              <Suspense fallback={<MeetingRuntimeFallback />}>
                <MeetingSidebarStage />
              </Suspense>
            </ErrorBoundary>
          </div>

          <ErrorBoundary name="ControlsWrapper" fallback={(error, reset) => <PanelErrorFallback error={error} resetError={reset} />}>
            <Suspense fallback={<MeetingRuntimeFallback />}>
              <MeetingControlsWrapper />
            </Suspense>
          </ErrorBoundary>
        </div>
      </MeetingStateProvider>
    </ErrorBoundary>
  );
}

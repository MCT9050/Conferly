import { Suspense, lazy, useMemo, useEffect, useState } from 'react';
import { useAppState } from './store';
import { Loader2 } from 'lucide-react';
import Logo from './components/Logo';
import InstallBanner from './components/InstallBanner';

const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="xl" />
    </div>
  );
}

export default function App() {
  const state = useAppState();
  
  return (
    <Suspense fallback={<RouteLoader />}>
      <LandingPage />
    </Suspense>
  );
}

import { Suspense, lazy, useMemo, useEffect, useState } from 'react';
import { useAppState } from './store';
import { Loader2 } from 'lucide-react';
import Logo from './components/Logo';
import InstallBanner from './components/InstallBanner';

const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthPage = lazy(() => import('./components/AuthPage').then(m => ({ default: m.AuthPage })));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="xl" />
    </div>
  );
}

function getRouteFromURL() {
  try {
    const path = window?.location?.pathname || '';
    const hash = window?.location?.hash || '';
    const effectivePath = hash.startsWith('#/') ? hash.substring(1) : path.replace('/', '');
    return effectivePath;
  } catch (e) { return ''; }
}

export default function App() {
  const state = useAppState();
  const route = useMemo(() => getRouteFromURL(), []);
  
  return (
    <Suspense fallback={<RouteLoader />}>
      {state.isAuthenticated ? (
        <div className="p-4">Dashboard</div>
      ) : route === 'auth' ? (
        <AuthPage />
      ) : (
        <>
          <InstallBanner />
          <LandingPage />
        </>
      )}
    </Suspense>
  );
}

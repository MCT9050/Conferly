import { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { useAppState } from './store';
import { Loader2 } from 'lucide-react';
import Logo from './components/Logo';

const AuthPage = lazy(() => import('./components/AuthPage').then(m => ({ default: m.AuthPage })));
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="xl" />
    </div>
  );
}

function getRouteFromURL() {
  try {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const effectivePath = hash.startsWith('#/') ? hash.substring(1) : path;
    if (effectivePath === '/terms') return 'terms';
    if (effectivePath === '/privacy') return 'privacy';
    if (effectivePath === '/auth' || effectivePath === '/auth?mode=signin' || effectivePath === '/auth?mode=signup') return 'auth';
    if (effectivePath === '/dashboard') return 'dashboard';
    if (effectivePath === '/pricing') return 'pricing';
  } catch (e) {}
  return 'none';
}

export default function App() {
  const s = useAppState();
  const loading = s.authLoading;
  
  // Use useMemo like original
  const initialRoute = useMemo(() => getRouteFromURL(), []);
  
  const isAuthPage = initialRoute === 'auth';

  if (loading) {
    return <RouteLoader />;
  }

  if (!s.isAuthenticated) {
    if (isAuthPage) {
      return (
        <Suspense fallback={<RouteLoader />}>
          {/* AuthPage removed for test */}
          <div><h1>Auth Test</h1></div>
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<RouteLoader />}>
        <LandingPage />
      </Suspense>
    );
  }

  return <div>Dashboard</div>;
}

import { Suspense, lazy, useMemo } from 'react';
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

function getRouteFromURL() {
  try {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const effectivePath = hash.startsWith('#/') ? hash.substring(1) : path;
    if (effectivePath === '/terms') return 'terms';
    if (effectivePath === '/privacy') return 'privacy';
    if (effectivePath === '/auth' || effectivePath.startsWith('/auth?')) return 'auth';
    if (effectivePath === '/dashboard') return 'dashboard';
    if (effectivePath === '/pricing') return 'pricing';
  } catch (e) {}
  return 'none';
}

export default function App() {
  const s = useAppState();
  
  // Only compute derived state after initial route is known
  const initialRoute = useMemo(() => getRouteFromURL(), []);
  
  const isAuthPage = initialRoute === 'auth';
  const isDashboard = initialRoute === 'dashboard';
  const isPricingPage = initialRoute === 'pricing';
  const isTermsPage = initialRoute === 'terms';
  const isPrivacyPage = initialRoute === 'privacy';
  const isLobby = s.view === 'lobby';
  const isMeeting = s.view === 'meeting';
  const isOnboarding = s.view === 'onboarding';
  const isLanding = !s.isAuthenticated && !isAuthPage && !isTermsPage && !isPrivacyPage && !isDashboard && !isPricingPage && !isLobby && !isMeeting && !isOnboarding;

  if (s.authLoading) {
    return <RouteLoader />;
  }

  if (isTermsPage) {
    return <Suspense fallback={<RouteLoader />}><div>Terms</div></Suspense>;
  }

  if (isPrivacyPage) {
    return <Suspense fallback={<RouteLoader />}><div>Privacy</div></Suspense>;
  }

  if (!s.isAuthenticated) {
    if (isDashboard) {
      return <Suspense fallback={<RouteLoader />}><div>Dashboard</div></Suspense>;
    }

    if (isPricingPage) {
      return <Suspense fallback={<RouteLoader />}><div>Pricing</div></Suspense>;
    }

    if (isOnboarding) {
      return <Suspense fallback={<RouteLoader />}><div>Onboarding</div></Suspense>;
    }

    if (isAuthPage) {
      return <Suspense fallback={<RouteLoader />}><div>Auth</div></Suspense>;
    }

    return (
      <Suspense fallback={<RouteLoader />}>
        <LandingPage />
      </Suspense>
    );
  }

  if (isLobby) {
    return <Suspense fallback={<RouteLoader />}><div>Lobby</div></Suspense>;
  }

  if (isMeeting) {
    return <Suspense fallback={<RouteLoader />}><div>Meeting</div></Suspense>;
  }

  return <Suspense fallback={<RouteLoader />}><div>Dashboard Auth</div></Suspense>;
}

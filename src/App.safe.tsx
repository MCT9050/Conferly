import { useAppState } from './store';
import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import Logo from './components/Logo';

// Lazy load heavy route components
const AuthPage = lazy(() => import('./components/AuthPage').then(m => ({ default: m.AuthPage })));
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Lobby = lazy(() => import('./components/Lobby').then(m => ({ default: m.Lobby })));
const MeetingRoom = lazy(() => import('./components/MeetingRoom').then(m => ({ default: m.MeetingRoom })));
const PricingPage = lazy(() => import('./components/PricingPage').then(m => ({ default: m.PricingPage })));
const OnboardingPage = lazy(() => import('./components/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const TermsPage = lazy(() => import('./components/TermsPage').then(m => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./components/PrivacyPage').then(m => ({ default: m.PrivacyPage })));

// Lightweight fallback for lazy loading
function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Logo size="xl" />
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    </div>
  );
}

// Get initial route state synchronously - lightweight
function getRouteFromURL() {
  try {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const effectivePath = hash.startsWith('#/') ? hash.substring(1) : path;

    if (effectivePath === '/terms' || effectivePath === '/terms/') return 'terms';
    if (effectivePath === '/privacy' || effectivePath === '/privacy/') return 'privacy';
    if (effectivePath === '/auth' || effectivePath === '/auth?mode=signin' || effectivePath === '/auth?mode=signup') return 'auth';
    if (effectivePath === '/dashboard' || effectivePath === '/dashboard/') return 'dashboard';
    if (effectivePath === '/pricing' || effectivePath === '/pricing/') return 'pricing';
    if (effectivePath && effectivePath.startsWith('/meeting/')) return 'none';
  } catch (e) {
    console.warn('Failed to get route from URL:', e);
  }
  return 'none';
}

export default function App() {
  const s = useAppState();
  
  // Route state - initialized synchronously before auth check
  const initialRoute = getRouteFromURL();
  
  const isTermsPage = initialRoute === 'terms';
  const isPrivacyPage = initialRoute === 'privacy';
  const isAuthPage = initialRoute === 'auth';
  const isDashboard = initialRoute === 'dashboard';
  const isPricingPage = initialRoute === 'pricing';
  const isLobby = s.view === 'lobby';
  const isMeeting = s.view === 'meeting';
  const isOnboarding = s.view === 'onboarding';
  const isLanding = !s.isAuthenticated && !isAuthPage && !isTermsPage && !isPrivacyPage && !isDashboard && !isPricingPage && !isLobby && !isMeeting && !isOnboarding;

  if (s.authLoading) {
    return <RouteLoader />;
  }

  if (isTermsPage) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <TermsPage onClose={() => window.location.hash = ''} />
      </Suspense>
    );
  }

  if (isPrivacyPage) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <PrivacyPage onClose={() => window.location.hash = ''} />
      </Suspense>
    );
  }

  if (!s.isAuthenticated) {
    if (isAuthPage) {
      return (
        <Suspense fallback={<RouteLoader />}>
          <AuthPage
            onSignUp={s.signUp}
            onSignIn={s.signIn}
            onPasswordReset={s.passwordReset}
          />
        </Suspense>
      );
    }

    if (isDashboard) {
      return (
        <Suspense fallback={<RouteLoader />}>
          <Dashboard />
        </Suspense>
      );
    }

    if (isPricingPage) {
      return (
        <Suspense fallback={<RouteLoader />}>
          <PricingPage />
        </Suspense>
      );
    }

    if (isOnboarding) {
      return (
        <Suspense fallback={<RouteLoader />}>
          <OnboardingPage onComplete={s.completeOnboarding} />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<RouteLoader />}>
        <LandingPage />
      </Suspense>
    );
  }

  if (isLobby) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <Lobby />
      </Suspense>
    );
  }

  if (isMeeting) {
    return (
      <Suspense fallback={<RouteLoader />}>
        <MeetingRoom />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RouteLoader />}>
      <Dashboard />
    </Suspense>
  );
}

import { Suspense, lazy, useMemo } from 'react';
import { useAppState } from './store';
import Logo from './components/Logo';
import InstallBanner from './components/InstallBanner';
import OnboardingPage from './components/OnboardingPage';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';

const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthPage = lazy(() => import('./components/AuthPage').then(m => ({ default: m.AuthPage })));
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Lobby = lazy(() => import('./components/Lobby').then(m => ({ default: m.Lobby })));
const MeetingRoom = lazy(() => import('./components/MeetingRoom').then(m => ({ default: m.MeetingRoom })));
const PricingPage = lazy(() => import('./components/PricingPage').then(m => ({ default: m.PricingPage })));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="xl" />
    </div>
  );
}

function getRouteFromURL() {
  try {
    const hash = window?.location?.hash || '';
    // "#/pricing" -> "pricing"
    const route = hash.replace('#/', '').replace('#', '');
    return route;
  } catch (e) { return ''; }
}

export default function App() {
  const state = useAppState();
  const route = useMemo(() => getRouteFromURL(), []);
  const isInMeeting = state.view === 'meeting' && state.roomId;
  
  if (route === 'pricing') return <PricingPage />;
  if (route === 'terms') return <TermsPage />;
  if (route === 'privacy') return <PrivacyPage />;
  if (route === 'onboarding') return <OnboardingPage />;
  
  return (
    <Suspense fallback={<RouteLoader />}>
      {state.isAuthenticated ? (
        isInMeeting ? (
          <MeetingRoom />
        ) : (
          <Lobby />
        )
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

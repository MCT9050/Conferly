import { useAppState } from './store';
import { useEffect, lazy, Suspense, useState } from 'react';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import Logo from './components/Logo';
import InstallBanner from './components/InstallBanner';

const LandingPage = lazy(() => import('./components/LandingPage'));
const AuthPage = lazy(() => import('./components/AuthPage'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Lobby = lazy(() => import('./components/Lobby'));
const MeetingRoom = lazy(() => import('./components/MeetingRoom'));
const PricingPage = lazy(() => import('./components/PricingPage'));
const OnboardingPage = lazy(() => import('./components/OnboardingPage'));
const TermsPage = lazy(() => import('./components/TermsPage'));
const PrivacyPage = lazy(() => import('./components/PrivacyPage'));
const DocsPage = lazy(() => import('./components/DocsPage'));
const AboutPage = lazy(() => import('./components/AboutPage'));
const ContactPage = lazy(() => import('./components/ContactPage'));
const CareersPage = lazy(() => import('./components/CareersPage'));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="xl" />
    </div>
  );
}

export default function App() {
  const state = useAppState();
  const { installBanner, dismissBanner } = useInstallPrompt();
  
  // Track hash changes for modal pages
  const [hash, setHash] = useState(() => typeof window !== 'undefined' ? window.location.hash : '');
  
  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  // Get view from hash route (e.g., #/terms, #/privacy, #/docs)
  const route = hash.startsWith('#/') ? hash.substring(2) : '';
  const routeBase = route.split('/')[0];
  
  const isInMeeting = state.view === 'meeting' && state.roomId;

  // Helper to close modal pages
  const closePage = () => { window.location.hash = ''; };

  return (
    <Suspense fallback={<RouteLoader />}>
      {/* Modal pages - check hash route first */}
      {routeBase === 'docs' && <DocsPage onClose={closePage} />}
      {routeBase === 'terms' && <TermsPage onClose={closePage} />}
      {routeBase === 'privacy' && <PrivacyPage onClose={closePage} />}
      {routeBase === 'about' && <AboutPage onClose={closePage} />}
      {routeBase === 'contact' && <ContactPage onClose={closePage} />}
      {routeBase === 'careers' && <CareersPage onClose={closePage} />}
      
      {/* Main app routes */}
      {state.isAuthenticated ? (
        isInMeeting ? (
          <MeetingRoom />
        ) : (
          <Lobby />
        )
      ) : state.view === 'auth' ? (
        <AuthPage />
      ) : state.view === 'dashboard' ? (
        <Dashboard />
      ) : state.view === 'onboarding' ? (
        <OnboardingPage />
      ) : state.view === 'pricing' ? (
        <PricingPage />
      ) : (
        <>
          <InstallBanner />
          <LandingPage />
        </>
      )}
    </Suspense>
  );
}

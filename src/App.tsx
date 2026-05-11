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
import DocsPage from './components/DocsPage';
import AboutPage from './components/AboutPage';
import ContactPage from './components/ContactPage';
import CareersPage from './components/CareersPage';
import TermsPage from './components/TermsPage';
import PrivacyPage from './components/PrivacyPage';
import LearnPage from './components/LearnPage';
import MathLearnPage from './components/MathLearnPage';
import ScienceLearnPage from './components/ScienceLearnPage';
import TechLearnPage from './components/TechLearnPage';
import LanguagesLearnPage from './components/LanguagesLearnPage';

// Debug: loaded pages directly to verify routing works

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
  
  // Get view from hash route FIRST (e.g., #/terms, #/auth, #/pricing)
  // Prioritize hash routes but also check state.view
  const route = hash.startsWith('#/') ? hash.substring(2) : '';
  const routeBase = route.split('/')[0];

  // Check if this is a main view route (not modal)
  const isMainViewRoute = routeBase === 'auth' || routeBase === 'dashboard' || routeBase === 'pricing' || routeBase === 'onboarding';
  // Get effective view: hash route takes priority for main views, otherwise use state.view
  const effectiveView = isMainViewRoute ? routeBase : state.view;
  
  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
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
      {routeBase === 'learn' && <LearnPage onClose={closePage} />}
      {routeBase === 'mathematics' && <MathLearnPage onClose={closePage} />}
      {routeBase === 'science' && <ScienceLearnPage onClose={closePage} />}
      {routeBase === 'technology' && <TechLearnPage onClose={closePage} />}
      {routeBase === 'languages' && <LanguagesLearnPage onClose={closePage} />}
      
      {/* Main app routes - check effective view (hash or state) */}
      {effectiveView === 'auth' ? (
        <AuthPage />
      ) : effectiveView === 'dashboard' ? (
        <Dashboard />
      ) : effectiveView === 'onboarding' ? (
        <OnboardingPage />
      ) : effectiveView === 'pricing' ? (
        <PricingPage />
      ) : state.isAuthenticated ? (
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

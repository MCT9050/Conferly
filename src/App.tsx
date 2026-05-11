import { useAppState } from './store';
import { useEffect, lazy, Suspense, useState, Component } from 'react';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import Logo from './components/Logo';
import InstallBanner from './components/InstallBanner';

// Error boundary class to catch Suspense errors
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-red-600 mb-2">Error Loading Page</h1>
            <p className="text-gray-600">Something went wrong.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import PricingPage from './components/PricingPage';
const Dashboard = lazy(() => import('./components/Dashboard'));
const Lobby = lazy(() => import('./components/Lobby'));
const MeetingRoom = lazy(() => import('./components/MeetingRoom'));
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

// Debug: track errors during lazy loading

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Logo size="xl" />
    </div>
  );
}

// Error boundary to catch lazy loading errors
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-xl font-bold text-red-600 mb-2">Error Loading Page</h1>
        <p className="text-gray-600">{error.message}</p>
      </div>
    </div>
  );
}

export default function App() {
  const state = useAppState();
  const { installBanner, dismissBanner } = useInstallPrompt();
  
  // Track hash changes for modal pages
  const [hash, setHash] = useState(() => typeof window !== 'undefined' ? window.location.hash : '');
  
  // Get view from hash route FIRST (e.g., #/terms, #/auth, #/pricing)
  const route = hash.startsWith('#/') ? hash.substring(2) : '';
  const routeBase = route.split('/')[0];

  console.log('[ROUTING] hash:', hash, 'routeBase:', routeBase, 'state.view:', state.view);

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
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

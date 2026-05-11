import { useAppState } from './store';
import { useEffect, useLayoutEffect, lazy, Suspense, useState, Component } from 'react';
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
  const [hash, setHash] = useState('');
  
  // Get view from hash route FIRST (e.g., #/terms, #/auth, #/pricing)
  // Only take the path portion (before ? or #)
  const fullHash = hash.startsWith('#/') ? hash.substring(2) : '';
  const routePath = fullHash.split('?')[0].split('#')[0];
  const routeBase = routePath.split('/')[0];

  // Check if this is a modal route (not main view)
  const isModalRoute = routeBase === 'terms' || routeBase === 'privacy' || routeBase === 'science' || routeBase === 'technology' || routeBase === 'languages';
  
  // Initialize hash synchronously before paint and sync view from hash
  useLayoutEffect(() => {
    const currentHash = window.location.hash;
    setHash(currentHash);
    
    const mainViewRoutes = ['auth', 'dashboard', 'pricing', 'onboarding'];
    const currentFullHash = currentHash.startsWith('#/') ? currentHash.substring(2) : '';
    const currentRoutePath = currentFullHash.split('?')[0].split('#')[0];
    const currentRouteBase = currentRoutePath.split('/')[0];
    
    console.log('[App] Initial hash:', currentHash, 'routeBase:', currentRouteBase, 'state.view:', state.view);
    
    if (mainViewRoutes.includes(currentRouteBase)) {
      console.log('[App] Setting view to:', currentRouteBase);
      state.setView(currentRouteBase as AppView);
    }
  }, []);
  
  // Listen for hash changes
  useEffect(() => {
    const handleHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  const isInMeeting = state.view === 'meeting' && state.roomId;

  // Helper to close modal pages
  const closePage = () => { window.location.hash = ''; };

  return (
    <>
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
      
      {/* Main app routes - use key to force re-render on state.view change */}
      {state.view === 'auth' ? (
        <AuthPage key={state.view} />
      ) : state.view === 'dashboard' ? (
        <Dashboard key={state.view} />
      ) : state.view === 'onboarding' ? (
        <OnboardingPage key={state.view} />
      ) : state.view === 'pricing' ? (
        <PricingPage 
          key={state.view}
          setView={state.setView} 
          subscription={state.subscription}
          pricing={state.pricing}
          allLimits={state.allLimits}
          onUpgrade={state.upgradeSubscription}
        />
      ) : /* authenticated check */ state.isAuthenticated ? (
        isInMeeting ? (
          <MeetingRoom key={state.view} />
        ) : (
          <Lobby key={state.view} />
        )
      ) : (
        <>
          <InstallBanner />
          <LandingPage
            setView={state.setView}
            setRoomId={state.setRoomId}
            userName={state.userName}
            setUserName={state.setUserName}
            profile={state.profile}
            isOfflineMode={state.isOfflineMode}
            onSignOut={state.signOut}
            onUpdateName={state.updateProfile}
          />
        </>
      )}
      </Suspense>
    </>
  );
}

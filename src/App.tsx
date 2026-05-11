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

// === PURE HASH ROUTING SYSTEM ===

// Step 1: Central route resolver - URL hash is the ONLY source of truth
function getRouteFromHash(): string {
  const hash = window.location.hash;
  // Remove #/ prefix and any query params
  const route = hash.replace('#/', '').split('?')[0].split('#')[0];
  return route || 'home';
}

// Step 2: Define valid routes - SINGLE SOURCE OF TRUTH
const VALID_ROUTES = [
  'home', 'auth', 'pricing', 'dashboard', 'onboarding',
  'docs', 'terms', 'privacy', 'about', 'contact', 'careers',
  'learn', 'mathematics', 'science', 'technology', 'languages'
];

export default function App() {
  const state = useAppState();
  const { installBanner, dismissBanner } = useInstallPrompt();
  
  // === STEP 3: SINGLE ROUTE STATE (derived from hash only) ===
  const [route, setRoute] = useState(getRouteFromHash);
  
  // === DEBUG LOGGING ===
  console.log('[ROUTER] Hash:', window.location.hash, 'Route:', route);
  
  // === STEP 4: HASH CHANGE LISTENER ===
  useEffect(() => {
    // Handler reads current hash directly - no stale closure
    const handleHashChange = () => {
      const newRoute = getRouteFromHash();
      console.log('[ROUTER] Hash changed to:', newRoute);
      setRoute(newRoute);
    };
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    
    // Initial load - already captured in useState initializer
    // Handle case where hash changed between init and effect
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // Empty deps - listener is stable
  
  // Step 7: Unknown route fallback
  const currentRoute = VALID_ROUTES.includes(route) ? route : 'home';
  
  // Redirect unknown routes
  if (currentRoute === 'home' && route !== 'home' && route !== '') {
    window.location.hash = '/home';
  }

  // Helper to close modal pages
  const closePage = () => { window.location.hash = '/home'; };

  // === CLEAN DETERMINISTIC RENDERING ===
  return (
    <>
      <Suspense fallback={<RouteLoader />}>
        {/* Modal/secondary routes - rendered as overlays */}
        {currentRoute === 'docs' && <DocsPage onClose={closePage} />}
        {currentRoute === 'terms' && <TermsPage onClose={closePage} />}
        {currentRoute === 'privacy' && <PrivacyPage onClose={closePage} />}
        {currentRoute === 'about' && <AboutPage onClose={closePage} />}
        {currentRoute === 'contact' && <ContactPage onClose={closePage} />}
        {currentRoute === 'careers' && <CareersPage onClose={closePage} />}
        {currentRoute === 'learn' && <LearnPage onClose={closePage} />}
        {currentRoute === 'mathematics' && <MathLearnPage onClose={closePage} />}
        {currentRoute === 'science' && <ScienceLearnPage onClose={closePage} />}
        {currentRoute === 'technology' && <TechLearnPage onClose={closePage} />}
        {currentRoute === 'languages' && <LanguagesLearnPage onClose={closePage} />}
        
        {/* Main routes - pure hash routing */}
        {currentRoute === 'auth' && (
          <AuthPage />
        )}
        {currentRoute === 'pricing' && (
          <PricingPage 
            setView={(v: any) => window.location.hash = `/${v}`}
            subscription={state.subscription}
            pricing={state.pricing}
            allLimits={state.allLimits}
            onUpgrade={state.upgradeSubscription}
          />
        )}
        {currentRoute === 'dashboard' && state.isAuthenticated && (
          <Dashboard />
        )}
        {currentRoute === 'onboarding' && state.isAuthenticated && (
          <OnboardingPage />
        )}
        {currentRoute === 'dashboard' && !state.isAuthenticated && (
          window.location.hash = '/auth'
        )}
        {currentRoute === 'onboarding' && !state.isAuthenticated && (
          window.location.hash = '/auth'
        )}
        
        {/* Default: Landing page */}
        {currentRoute === 'home' && (
          <>
            <InstallBanner />
            <LandingPage />
          </>
        )}
      </Suspense>
    </>
  );
}

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
  if (typeof window === 'undefined') return 'home';
  const hash = window.location?.hash;
  if (!hash || hash === '#') return 'home';
  const route = hash.replace('#/', '').split('?')[0].split('#')[0];
  return route || 'home';
}

// Step 2: Define valid routes
const VALID_ROUTES = [
  'home', 'auth', 'pricing', 'dashboard', 'onboarding',
  'docs', 'terms', 'privacy', 'about', 'contact', 'careers',
  'learn', 'mathematics', 'science', 'technology', 'languages'
];

export default function App() {
  const state = useAppState();
  const { installBanner, dismissBanner } = useInstallPrompt();
  
  // Force update counter to trigger re-renders
  const [, forceUpdate] = useState(0);
  
  // Read hash during render - this is the key insight!
  const route = getRouteFromHash();
  
  // === DEBUG ===
  console.log('[ROUTER] Route:', route, 'Hash:', window.location.hash);
  
  // Listen for hash changes - triggers re-render
  useEffect(() => {
    const handleHashChange = () => forceUpdate(n => n + 1);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  // === Valid route or fallback ===
  const currentRoute = VALID_ROUTES.includes(route) ? route : 'home';
  if (currentRoute === 'home' && route && route !== '' && route !== 'home') {
    window.location.hash = '/home';
  }

  // Helper
  const closePage = () => { window.location.hash = '/home'; };

  // === PURE DETERMINISTIC RENDER ===
  return (
    <>
      <Suspense fallback={<RouteLoader />}>
        {/* Modals */}
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
        
        {/* Main routes */}
        {currentRoute === 'auth' && <AuthPage />}
        {currentRoute === 'pricing' && (
          <PricingPage setView={(v: any) => window.location.hash = `/${v}`} subscription={state.subscription} pricing={state.pricing} allLimits={state.allLimits} onUpgrade={state.upgradeSubscription} />
        )}
        {currentRoute === 'dashboard' && state.isAuthenticated && <Dashboard />}
        {currentRoute === 'onboarding' && state.isAuthenticated && <OnboardingPage />}
        {currentRoute === 'dashboard' && !state.isAuthenticated && (window.location.hash = '/auth', null)}
        {currentRoute === 'onboarding' && !state.isAuthenticated && (window.location.hash = '/auth', null)}
        {currentRoute === 'home' && (<><InstallBanner /><LandingPage /></>)}
      </Suspense>
    </>
  );
}

import { useAppState } from './store';
import { useEffect, lazy, Suspense } from 'react';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import Logo from './components/Logo';
import InstallBanner from './components/InstallBanner';

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
  console.log('[ROUTER] RAW HASH:', window.location.hash);
  
  if (typeof window === 'undefined') return 'home';
  const hash = window.location?.hash;
  if (!hash || hash === '#') {
    console.log('[ROUTER] RETURNING: home (empty hash)');
    return 'home';
  }
  const cleaned = hash.replace('#/', '');
  console.log('[ROUTER] CLEANED HASH:', cleaned);
  
  const route = cleaned.split('?')[0].split('#')[0];
  console.log('[ROUTER] RETURNING ROUTE:', route || 'home');
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
  
  
  // Read hash during render - this is the key insight!
  const route = getRouteFromHash();
  
  // === DEBUG ===
  console.log('[ROUTER] Route:', route, 'Hash:', window.location.hash, 'currentRoute:', currentRoute, 'state.view:', state.view);
  
  // Listen for hash changes - triggers re-render
  useEffect(() => {
    const handleHashChange = () => {
      console.log('[ROUTER] Hash changed, forcing update');
      // NO force update
    };
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
  // VISIBLE DEBUG - always rendered at absolute top
  const debugInfo = (
    <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 99999, background: 'yellow', padding: '10px', fontSize: '12px', fontFamily: 'monospace' }}>
      ROUTE: {route} | CURRENT: {currentRoute} | HASH: {window.location.hash} | AUTH: {String(state.isAuthenticated)}
    </div>
  );
  
  console.log('[ROUTER] FINAL ROUTE USED:', route, 'HASH:', window.location.hash, 'currentRoute:', currentRoute);
  
  // ALWAYS VISIBLE - even if App crashes
  return (
    <div style={{ minHeight: '100vh', background: route === 'pricing' ? 'magenta' : route === 'auth' ? 'cyan' : 'green' }}>
      {/* Navigation debug */}
      <nav style={{ background: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px 10px', fontSize: '10px' }}>
        DEBUG: route={route} currentRoute={currentRoute} hash={window.location.hash}
      </nav>
      <Suspense fallback={<RouteLoader />}>
        {/* Modals */}
        {currentRoute === 'docs' && console.log('[ROUTER] RENDERING DOCS') || null}
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
        {currentRoute === 'auth' && console.log('[ROUTER] RENDERING AUTH PAGE') || null}
        {currentRoute === 'auth' && <AuthPage />}
        
        {currentRoute === 'pricing' && console.log('[ROUTER] RENDERING PRICING PAGE') || null}
        {currentRoute === 'pricing' && (
          <div style={{ background: '#ff0000', minHeight: '100vh', padding: '20px' }}>
            <h1 style={{ color: 'white' }}>PRICING ROUTE ACTIVE (RED=test wrapper)</h1>
            <PricingPage setView={(v: any) => window.location.hash = `/${v}`} subscription={state.subscription} pricing={state.pricing} allLimits={state.allLimits} onUpgrade={state.upgradeSubscription} />
          </div>
        )}
        
        {currentRoute === 'dashboard' && state.isAuthenticated && <Dashboard />}
        {currentRoute === 'onboarding' && state.isAuthenticated && <OnboardingPage />}        {currentRoute === 'dashboard' && !state.isAuthenticated && (window.location.hash = '/auth', null)}
        {currentRoute === 'onboarding' && !state.isAuthenticated && (window.location.hash = '/auth', null)}
        
        {currentRoute === 'home' && console.log('[ROUTER] RENDERING LANDING PAGE') || null}
        {currentRoute === 'home' && (<><InstallBanner /><LandingPage /></>)}
      </Suspense>
    </div>
  );
}

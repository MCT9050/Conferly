/**
 * App.tsx with REAL pages restored
 */
import React from 'react';
import { useHashRoute } from './router/useHashRoute';
import AuthPage from './components/AuthPage';
import PricingPage from './components/PricingPage';

// Basic props for PricingPage
const defaultProps = {
  subscription: { tier: 'trial', status: 'active', currentPeriodEnd: new Date().toISOString() },
  pricing: { trial: { monthly: 0, annual: 0 }, pro: { monthly: 15, annual: 150 }, business: { monthly: 35, annual: 350 }, enterprise: { monthly: 0, annual: 0 } },
  allLimits: { 
    trial: { maxParticipants: 500, maxDurationMinutes: 40, features: [] },
    pro: { maxParticipants: 500, maxDurationMinutes: -1, features: ['recording', 'transcription'] },
    business: { maxParticipants: 500, maxDurationMinutes: -1, features: ['recording', 'transcription', 'analytics'] },
    enterprise: { maxParticipants: 500, maxDurationMinutes: -1, features: ['recording', 'transcription', 'analytics', 'sso'] },
  },
  setView: () => {},
  onUpgrade: () => {},
};

function HomePage() {
  console.log('[RENDER] LandingPage');
  return (
    <div style={{ minHeight: '100vh', padding: '40px', fontFamily: 'system-ui' }}>
      <h1>Welcome to Conferly</h1>
      <nav>
        <a href="#/auth">Login</a> | <a href="#/pricing">Pricing</a>
      </nav>
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  console.log('[APP] Route:', route);
  
  return (
    <div style={{ minHeight: '100vh' }}>
      <nav style={{ background: '#000', color: '#0f0', padding: '8px', fontFamily: 'monospace' }}>
        ROUTE: {route}
      </nav>
      
      {route === 'home' && <HomePage />}
      {route === 'auth' && <AuthPage />}
      {route === 'pricing' && <PricingPage {...defaultProps} />}
    </div>
  );
}

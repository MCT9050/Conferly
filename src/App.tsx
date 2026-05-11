/**
 * App.tsx - Clean routing
 */
import React from 'react';
import { useHashRoute } from './router/useHashRoute';
import AuthPage from './components/AuthPage';
import PricingPage from './components/PricingPage';

const defaultProps = {
  subscription: { tier: 'trial', status: 'active', currentPeriodEnd: new Date().toISOString() },
  pricing: { trial: { monthly: 0, annual: 0 }, pro: { monthly: 15, annual: 150 }, business: { monthly: 35, annual: 350 }, enterprise: { monthly: 0, annual: 0 } },
  allLimits: { 
    trial: { maxParticipants: 500, maxDurationMinutes: 40 },
    pro: { maxParticipants: 500, maxDurationMinutes: -1 },
    business: { maxParticipants: 500, maxDurationMinutes: -1 },
    enterprise: { maxParticipants: 500, maxDurationMinutes: -1 },
  },
  setView: () => {},
  onUpgrade: () => {},
};

function HomePage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '40px', 
      fontFamily: 'system-ui',
      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      color: 'white'
    }}>
      <h1 style={{ fontSize: '48px', fontWeight: 'bold' }}>🎙️ Conferly</h1>
      <p style={{ fontSize: '24px', marginTop: '20px' }}>Connecting with Purpose</p>
      
      <nav style={{ marginTop: '40px', fontSize: '18px' }}>
        <a href="#/auth" style={{ color: 'white', marginRight: '20px' }}>🔐 Login</a>
        <a href="#/pricing" style={{ color: 'white' }}>💰 Pricing</a>
      </nav>
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  
  return (
    <div style={{ minHeight: '100vh' }}>
      {route === 'home' && <HomePage />}
      {route === 'auth' && <AuthPage />}
      {route === 'pricing' && <PricingPage {...defaultProps} />}
    </div>
  );
}

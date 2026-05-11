/**
 * NEW CLEAN App.tsx
 * Uses fresh router + inline placeholder pages
 */
import React from 'react';
import { useHashRoute } from './router/useHashRoute';

// Simple inline placeholder pages - NO external imports until proven working
function HomePage() {
  console.log('[RENDER] HomePage');
  return (
    <div style={{ background: 'white', minHeight: '100vh', padding: '40px' }}>
      <h1 style={{ fontSize: '48px', color: '#333' }}>🏠 HOME PAGE WORKS!</h1>
    </div>
  );
}

function AuthPage() {
  console.log('[RENDER] AuthPage');
  return (
    <div style={{ background: '#22c55e', minHeight: '100vh', padding: '40px' }}>
      <h1 style={{ fontSize: '48px', color: 'white' }}>🔐 AUTH PAGE WORKS!</h1>
    </div>
  );
}

function PricingPage() {
  console.log('[RENDER] PricingPage');
  return (
    <div style={{ background: '#f97316', minHeight: '100vh', padding: '40px' }}>
      <h1 style={{ fontSize: '48px', color: 'white' }}>💰 PRICING PAGE WORKS!</h1>
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  console.log('[APP] Current route:', route);
  
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Debug nav */}
      <nav style={{ background: '#000', color: '#0f0', padding: '8px', fontFamily: 'monospace' }}>
        ROUTE: {route}
      </nav>
      
      {/* Simple route rendering - no Suspense, no lazy, no chain */}
      {route === 'home' && <HomePage />}
      {route === 'auth' && <AuthPage />}
      {route === 'pricing' && <PricingPage />}
    </div>
  );
}

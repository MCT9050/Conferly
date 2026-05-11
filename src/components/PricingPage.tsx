import React, { useState, useEffect, useMemo } from 'react';

// Global heartbeat logging
console.log('[PRICING] Module loaded at', Date.now());

interface PricingPageProps {
  setView: (v: string) => void;
  subscription: any;
  pricing: any;
  allLimits: any;
  onUpgrade: any;
}

export default function PricingPage({
  setView,
  subscription,
  pricing,
  allLimits,
  onUpgrade,
}: PricingPageProps) {
  // Track render count
  const [renderCount, setRenderCount] = useState(0);
  const [mountTime] = useState(Date.now());
  const [heartbeat, setHeartbeat] = useState(Date.now());
  const [error, setError] = useState<Error | null>(null);
  
  // Heartbeat - confirm alive every 2 seconds
  useEffect(() => {
    console.log('[PRICING] useEffect running at', Date.now());
    const interval = setInterval(() => {
      console.log('[PRICING] heartbeat', Date.now());
      setHeartbeat(Date.now());
    }, 2000);
    return () => {
      console.log('[PRICING] useEffect cleanup at', Date.now());
      clearInterval(interval);
    };
  }, []);
  
  // Increment render count on each render
  useEffect(() => {
    setRenderCount(c => c + 1);
    console.log('[PRICING] render count now:', renderCount + 1);
  });
  
  // Safety: wrap render in try-catch
  try {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'cyan',
          padding: '40px',
          color: 'black'
        }}
      >
        {console.log('[PRICING] JSX rendering at', Date.now()) || null}
        <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>
          PRICING PAGE WORKS!
        </h1>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>
          Mounted at: {new Date(mountTime).toLocaleTimeString()}
        </div>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>
          Render count: {renderCount}
        </div>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>
          Heartbeat: {new Date(heartbeat).toLocaleTimeString()}
        </div>
        <div style={{ fontSize: '18px', color: 'blue', marginBottom: '10px' }}>
          Has subscription: {subscription ? 'YES' : 'NO'}
        </div>
        <div style={{ fontSize: '18px', color: 'blue', marginBottom: '10px' }}>
          Has pricing: {pricing ? 'YES' : 'NO'}
        </div>
        <div style={{ fontSize: '18px', color: 'blue', marginBottom: '10px' }}>
          Has allLimits: {allLimits ? 'YES' : 'NO'}
        </div>
        <button
          onClick={() => setView('home')}
          style={{
            padding: '15px 30px',
            fontSize: '20px',
            background: 'blue',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Go Home
        </button>
      </div>
    );
  } catch (e) {
    // Safety catch for render errors
    console.error('[PRICING] RENDER ERROR:', e);
    setError(e as Error);
    return (
      <div style={{ padding: '40px', background: 'red', color: 'white', minHeight: '100vh' }}>
        <h1>PRICING RENDER ERROR</h1>
        <p>{(e as Error).message}</p>
      </div>
    );
  }
}

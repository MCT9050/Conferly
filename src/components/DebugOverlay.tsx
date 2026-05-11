import React, { useState, useEffect } from 'react';

/**
 * DEBUG OVERLAY COMPONENT
 * Fixed bottom-right overlay showing runtime state
 */

interface DebugOverlayProps {
  visible?: boolean;
}

export default function DebugOverlay({ visible = true }: DebugOverlayProps) {
  const [renderCount, setRenderCount] = useState(0);
  const [lastError, setLastError] = useState<any>(null);
  const [heartbeat, setHeartbeat] = useState(Date.now());
  
  // Heartbeat to confirm component is alive
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartbeat(Date.now());
      setRenderCount(c => c + 1);
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  
  // Capture latest runtime error
  useEffect(() => {
    if (window.__RUNTIME_ERRORS__?.length) {
      const errors = window.__RUNTIME_ERRORS__;
      setLastError(errors[errors.length - 1]);
    }
  }, [renderCount]);
  
  if (!visible) return null;
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.85)',
      color: 'white',
      padding: '10px',
      fontSize: '10px',
      fontFamily: 'monospace',
      zIndex: 99999,
      maxWidth: '280px',
      borderRadius: '4px',
      border: '1px solid #333'
    }}>
      <div style={{ color: '#0f0', marginBottom: '4px', fontWeight: 'bold' }}>
        DEBUG OVERLAY
      </div>
      <div>Hash: {typeof window !== 'undefined' ? window.location?.hash : 'N/A'}</div>
      <div>Route: {window.__CURRENT_ROUTE__ || 'unknown'}</div>
      <div>Render: #{renderCount}</div>
      <div>Heartbeat: {new Date(heartbeat).toLocaleTimeString()}</div>
      {lastError && (
        <div style={{ color: '#f00', marginTop: '4px' }}>
          ERROR: {lastError.message?.slice(0, 80)}
        </div>
      )}
      <div style={{ color: '#888', marginTop: '4px' }}>
        Errors: {window.__RUNTIME_ERRORS__?.length || 0}
      </div>
    </div>
  );
}
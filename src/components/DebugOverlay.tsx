import React, { useState, useEffect } from 'react';

/**
 * DEBUG OVERLAY COMPONENT
 * Fixed bottom-right overlay showing runtime state
 */

interface DebugOverlayProps {
  visible?: boolean;
}

export default function DebugOverlay({ visible = true }: DebugOverlayProps) {
  // Static info only - no intervals causing re-renders
  const [errors] = useState(() => window.__RUNTIME_ERRORS__?.length || 0);
  
  // Get current info at render time only
  const routeInfo = window.location?.hash || 'N/A';
  const errorCount = window.__RUNTIME_ERRORS__?.length || 0;
  
  if (!visible) return null;
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.9)',
      color: 'white',
      padding: '12px',
      fontSize: '11px',
      fontFamily: 'monospace',
      zIndex: 99999,
      maxWidth: '300px',
      borderRadius: '4px',
      border: '2px solid #0f0'
    }}>
      <div style={{ color: '#0f0', marginBottom: '6px', fontWeight: 'bold', fontSize: '13px' }}>
        DEBUG OVERLAY v2
      </div>
      <div style={{ marginBottom: '2px' }}>Hash: {routeInfo}</div>
      <div style={{ marginBottom: '2px' }}>Errors captured: {errorCount}</div>
      <div style={{ color: '#888', fontSize: '10px' }}>
        No intervals - static render
      </div>
    </div>
  );
}

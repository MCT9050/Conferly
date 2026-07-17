'use client';

import React, { useEffect, useState, useRef } from 'react';

export default function DiagnosticOverlay() {
  const [fps, setFps] = useState(60);
  const [webrtcStats, setWebrtcStats] = useState({ activeTracks: 0, videoElements: 0 });
  const [domNodes, setDomNodes] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Monitor Frames Per Second (FPS) to detect rendering freezes
    let animationFrameId: number;
    const calculateFps = () => {
      frameCount.current++;
      const now = performance.now();
      if (now >= lastTime.current + 1000) {
        setFps(Math.round((frameCount.current * 1000) / (now - lastTime.current)));
        frameCount.current = 0;
        lastTime.current = now;
      }
      animationFrameId = requestAnimationFrame(calculateFps);
    };
    animationFrameId = requestAnimationFrame(calculateFps);

    // 2. Safe Scan for WebRTC tracks and DOM complexity
    const performAppScan = () => {
      try {
        // Count video elements currently in the DOM
        const videoElements = document.querySelectorAll('video');

        // Count total active tracks across all video elements safely
        let activeTracks = 0;
        videoElements.forEach((video) => {
          if (video.srcObject instanceof MediaStream) {
            activeTracks += video.srcObject.getTracks().length;
          }
        });

        // Count total DOM nodes to check for DOM flooding/bloat
        const totalNodes = document.getElementsByTagName('*').length;

        setWebrtcStats({ activeTracks, videoElements: videoElements.length });
        setDomNodes(totalNodes);

        // Warning alerts in console if thresholds are crossed
        if (totalNodes > 3000) {
          console.warn(`[DIAGNOSTIC WARN] High DOM node count (${totalNodes}). Canvas or list components may be leaking elements.`);
        }
        if (videoElements.length > 8) {
          console.warn(`[DIAGNOSTIC WARN] High video element count (${videoElements.length}). This triggers GPU rendering limits on many browsers.`);
        }
      } catch (err) {
        console.error('[DIAGNOSTIC ERROR] Failed during non-destructive app scan:', err);
      }
    };

    const scanInterval = setInterval(performAppScan, 3000);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(scanInterval);
    };
  }, []);

  // Performance warning threshold
  const isPerformanceDropping = fps < 30;

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: isPerformanceDropping ? 'rgba(139, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.85)',
      color: '#fff',
      padding: '12px',
      borderRadius: '8px',
      zIndex: 99999,
      fontFamily: 'monospace',
      fontSize: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      border: isPerformanceDropping ? '2px solid #ff4d4d' : '1px solid #444',
      pointerEvents: 'none'
    }}>
      <div style={{ fontWeight: 'bold', borderBottom: '1px solid #555', paddingBottom: '4px', marginBottom: '6px' }}>
        ⚙️ LIVE APP DIAGNOSTICS
      </div>
      <div>FPS: <span style={{ color: isPerformanceDropping ? '#ff4d4d' : '#00ff00', fontWeight: 'bold' }}>{fps}</span></div>
      <div>Active Video Elements: {webrtcStats.videoElements}</div>
      <div>Total Media Tracks: {webrtcStats.activeTracks}</div>
      <div>Total DOM Elements: {domNodes}</div>
      {isPerformanceDropping && (
        <div style={{ color: '#ff4d4d', marginTop: '6px', fontWeight: 'bold animate' }}>
          ⚠️ RENDERING BOTTLENECK DETECTED
        </div>
      )}
    </div>
  );
}
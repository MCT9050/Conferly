'use client';

import { useState, useEffect } from 'react';

interface DiagnosticOverlayProps {
  roomId?: string;
  participantCount?: number;
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'unknown';
}

export default function DiagnosticOverlay({
  roomId = 'N/A',
  participantCount = 0,
  connectionQuality = 'unknown',
}: DiagnosticOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState({
    latency: 0,
    packetLoss: 0,
    bandwidth: 0,
    timestamp: Date.now(),
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'd' && e.altKey) {
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics({
        latency: Math.floor(Math.random() * 100) + 20,
        packetLoss: Math.random() * 2,
        bandwidth: Math.floor(Math.random() * 5000) + 1000,
        timestamp: Date.now(),
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  const qualityColor = {
    excellent: 'text-green-400',
    good: 'text-yellow-400',
    poor: 'text-red-400',
    unknown: 'text-slate-400',
  }[connectionQuality];

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-xl shadow-black/50 text-xs font-mono">
      <div className="space-y-2">
        <div className="text-slate-400 border-b border-slate-700/50 pb-2 mb-2">
          <span className="text-blue-400">Diagnostic Overlay</span>
          <span className="text-slate-500 ml-2">(Alt+D to toggle)</span>
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-slate-500">Room:</span>
          <span className="text-slate-300">{roomId.slice(0, 8)}...</span>
          
          <span className="text-slate-500">Participants:</span>
          <span className="text-slate-300">{participantCount}</span>
          
          <span className="text-slate-500">Quality:</span>
          <span className={qualityColor}>{connectionQuality}</span>
          
          <span className="text-slate-500">Latency:</span>
          <span className={metrics.latency > 150 ? 'text-red-400' : 'text-green-400'}>
            {metrics.latency}ms
          </span>
          
          <span className="text-slate-500">Packet Loss:</span>
          <span className={metrics.packetLoss > 1 ? 'text-red-400' : 'text-green-400'}>
            {metrics.packetLoss.toFixed(1)}%
          </span>
          
          <span className="text-slate-500">Bandwidth:</span>
          <span className="text-slate-300">{(metrics.bandwidth / 1000).toFixed(1)} Mbps</span>
        </div>
      </div>
    </div>
  );
}

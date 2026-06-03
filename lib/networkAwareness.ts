// lib/networkAwareness.ts
// Bandwidth-aware runtime modes for mobile optimization
// Phase 12C: Mobile & Network Optimization

import React from 'react';

export type NetworkMode = 'high' | 'medium' | 'low' | 'offline';

export interface NetworkStatus {
  mode: NetworkMode;
  effectiveType?: string; // 'slow-2g', '2g', '3g', '4g'
  downlink?: number; // Mbps estimate
  rtt?: number; // Round-trip time in ms
  saveData: boolean;
  online: boolean;
}

/**
 * Network awareness manager
 * Detects network conditions and adapts runtime behavior
 */
export class NetworkAwareness {
  private listeners: Set<(status: NetworkStatus) => void> = new Set();
  private currentStatus: NetworkStatus;
  private checkInterval?: NodeJS.Timeout;
  
  constructor() {
    this.currentStatus = this.detectNetworkStatus();
    this.startMonitoring();
  }
  
  /**
   * Detect current network status
   */
  private detectNetworkStatus(): NetworkStatus {
    if (typeof window === 'undefined') {
      return {
        mode: 'high',
        online: true,
        saveData: false,
      };
    }
    
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (!connection) {
      // Fallback: assume good network if we can't detect
      return {
        mode: 'high',
        online: navigator.onLine,
        saveData: false,
      };
    }
    
    const effectiveType = connection.effectiveType;
    const downlink = connection.downlink;
    const rtt = connection.rtt;
    const saveData = connection.saveData || false;
    
    // Determine network mode based on connection quality
    let mode: NetworkMode;
    
    if (saveData) {
      mode = 'low';
    } else if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      mode = 'low';
    } else if (effectiveType === '3g' || downlink < 1.5) {
      mode = 'medium';
    } else {
      mode = 'high';
    }
    
    return {
      mode,
      effectiveType,
      downlink,
      rtt,
      saveData,
      online: navigator.onLine,
    };
  }
  
  /**
   * Start monitoring network changes
   */
  private startMonitoring(): void {
    if (typeof window === 'undefined') return;
    
    // Listen for connection changes
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;
    
    if (connection) {
      connection.addEventListener('change', () => {
        this.updateStatus();
      });
    }
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.updateStatus());
    window.addEventListener('offline', () => this.updateStatus());
    
    // Periodic check (every 30 seconds)
    this.checkInterval = setInterval(() => {
      this.updateStatus();
    }, 30000) as unknown as NodeJS.Timeout;
  }
  
  /**
   * Update network status and notify listeners
   */
  private updateStatus(): void {
    const newStatus = this.detectNetworkStatus();
    
    if (JSON.stringify(newStatus) !== JSON.stringify(this.currentStatus)) {
      this.currentStatus = newStatus;
      this.notifyListeners();
    }
  }
  
  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentStatus);
      } catch (error) {
         
        console.error('NetworkAwareness listener error:', error);
      }
    }
  }
  
  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }
  
  /**
   * Subscribe to network status changes
   */
  subscribe(listener: (status: NetworkStatus) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately call with current status
    try {
      listener(this.currentStatus);
    } catch (error) {
       
      console.error('NetworkAwareness listener error:', error);
    }
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Stop monitoring
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.listeners.clear();
  }
  
  /**
   * Check if we should use reduced quality based on network
   */
  shouldReduceQuality(): boolean {
    return this.currentStatus.mode === 'low' || this.currentStatus.saveData;
  }
  
  /**
   * Get appropriate video quality based on network
   */
  getVideoQuality(): { width: number; height: number; bitrate: number } {
    switch (this.currentStatus.mode) {
      case 'low':
        return { width: 480, height: 360, bitrate: 500 }; // 360p, 500kbps
      case 'medium':
        return { width: 640, height: 480, bitrate: 1000 }; // 480p, 1Mbps
      case 'high':
        return { width: 1280, height: 720, bitrate: 2500 }; // 720p, 2.5Mbps
      case 'offline':
        return { width: 0, height: 0, bitrate: 0 }; // No video
      default:
        return { width: 640, height: 480, bitrate: 1000 };
    }
  }
  
  /**
   * Get appropriate transcript update frequency (ms)
   */
  getTranscriptUpdateInterval(): number {
    switch (this.currentStatus.mode) {
      case 'low':
        return 5000; // Update every 5 seconds
      case 'medium':
        return 2000; // Update every 2 seconds
      case 'high':
        return 500; // Update every 500ms
      case 'offline':
        return 0; // No updates
      default:
        return 2000;
    }
  }
}

// Singleton instance
let networkAwarenessInstance: NetworkAwareness | null = null;

/**
 * Get or create network awareness instance
 */
export function getNetworkAwareness(): NetworkAwareness {
  if (!networkAwarenessInstance) {
    networkAwarenessInstance = new NetworkAwareness();
  }
  return networkAwarenessInstance;
}

/**
 * React hook for network awareness
 */
export function useNetworkAwareness() {
  const [status, setStatus] = React.useState(() => getNetworkAwareness().getStatus());
  
  React.useEffect(() => {
    const awareness = getNetworkAwareness();
    const unsubscribe = awareness.subscribe(setStatus);
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  return status;
}

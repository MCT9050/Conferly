// lib/batteryAwareness.ts
// Battery-aware optimizations for mobile devices
// Phase 12C: Mobile & Network Optimization

import React from 'react';

export type BatteryLevel = 'critical' | 'low' | 'medium' | 'high';

export interface BatteryStatus {
  level: BatteryLevel;
  percentage: number; // 0-1
  charging: boolean;
  chargingTime?: number; // seconds until full, or Infinity if not charging
  dischargingTime?: number; // seconds until empty, or Infinity if not discharging
}

/**
 * Battery Manager API interface
 * Note: Battery API is not yet standardized in TypeScript definitions
 */
interface BatteryManager {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

/**
 * Battery awareness manager
 * Detects battery status and adapts runtime behavior
 */
export class BatteryAwareness {
  private listeners: Set<(status: BatteryStatus) => void> = new Set();
  private currentStatus: BatteryStatus;
  private batteryAPI: BatteryManager | null = null;

  constructor() {
    this.currentStatus = this.detectBatteryStatus();
    this.startMonitoring();
  }

  /**
   * Detect current battery status
   */
  private detectBatteryStatus(): BatteryStatus {
    if (typeof window === 'undefined') {
      return {
        level: 'high',
        percentage: 1,
        charging: true,
      };
    }

    // Initial status - will be updated by startMonitoring
    return {
      level: 'high',
      percentage: 1,
      charging: true,
    };
  }

  /**
   * Start monitoring battery changes
   */
  private async startMonitoring(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const battery = (navigator as any).getBattery ?
        await (navigator as any).getBattery() : null;

      if (!battery) return;

      this.batteryAPI = battery;

      // Listen for battery changes
      battery.addEventListener('levelchange', () => this.updateStatus());
      battery.addEventListener('chargingchange', () => this.updateStatus());
      battery.addEventListener('chargingtimechange', () => this.updateStatus());
      battery.addEventListener('dischargingtimechange', () => this.updateStatus());

      // Update initial status
      this.updateStatus();
    } catch (error) {
      // Battery API not supported or permission denied
       
      console.warn('Battery API not available:', error);
    }
  }

  /**
   * Update battery status and notify listeners
   */
  private updateStatus(): void {
    if (!this.batteryAPI) return;

    const percentage = this.batteryAPI.level;
    const charging = this.batteryAPI.charging;
    const chargingTime = this.batteryAPI.chargingTime;
    const dischargingTime = this.batteryAPI.dischargingTime;

    // Determine battery level
    let level: BatteryLevel;
    if (percentage < 0.1) {
      level = 'critical';
    } else if (percentage < 0.2) {
      level = 'low';
    } else if (percentage < 0.5) {
      level = 'medium';
    } else {
      level = 'high';
    }

    const newStatus: BatteryStatus = {
      level,
      percentage,
      charging,
      chargingTime,
      dischargingTime,
    };

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
         
        console.error('BatteryAwareness listener error:', error);
      }
    }
  }

  /**
   * Get current battery status
   */
  getStatus(): BatteryStatus {
    return { ...this.currentStatus };
  }

  /**
   * Subscribe to battery status changes
   */
  subscribe(listener: (status: BatteryStatus) => void): () => void {
    this.listeners.add(listener);

    // Immediately call with current status
    try {
      listener(this.currentStatus);
    } catch (error) {
       
      console.error('BatteryAwareness listener error:', error);
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
    this.listeners.clear();
    if (this.batteryAPI) {
      // Remove event listeners
      this.batteryAPI.removeEventListener('levelchange', () => this.updateStatus());
      this.batteryAPI.removeEventListener('chargingchange', () => this.updateStatus());
      this.batteryAPI.removeEventListener('chargingtimechange', () => this.updateStatus());
      this.batteryAPI.removeEventListener('dischargingtimechange', () => this.updateStatus());
    }
  }

  /**
   * Check if we should enable power-saving mode
   */
  shouldEnablePowerSaving(): boolean {
    return this.currentStatus.level === 'critical' ||
      this.currentStatus.level === 'low';
  }

  /**
   * Get appropriate frame rate based on battery
   */
  getTargetFrameRate(): number {
    switch (this.currentStatus.level) {
      case 'critical':
        return 15; // Very low frame rate
      case 'low':
        return 24; // Low frame rate
      case 'medium':
        return 30; // Medium frame rate
      case 'high':
        return 60; // Full frame rate
      default:
        return 30;
    }
  }

  /**
   * Check if we should disable animations
   */
  shouldDisableAnimations(): boolean {
    return this.currentStatus.level === 'critical' ||
      (this.currentStatus.level === 'low' && !this.currentStatus.charging);
  }

  /**
   * Check if we should reduce video quality
   */
  shouldReduceVideoQuality(): boolean {
    return this.currentStatus.level === 'critical' ||
      (this.currentStatus.level === 'low' && !this.currentStatus.charging);
  }

  /**
   * Get appropriate update interval for background tasks (ms)
   */
  getBackgroundUpdateInterval(): number {
    switch (this.currentStatus.level) {
      case 'critical':
        return 60000; // Update every minute
      case 'low':
        return 30000; // Update every 30 seconds
      case 'medium':
        return 10000; // Update every 10 seconds
      case 'high':
        return 5000; // Update every 5 seconds
      default:
        return 10000;
    }
  }
}

// Singleton instance
let batteryAwarenessInstance: BatteryAwareness | null = null;

/**
 * Get or create battery awareness instance
 */
export async function getBatteryAwareness(): Promise<BatteryAwareness> {
  if (!batteryAwarenessInstance) {
    batteryAwarenessInstance = new BatteryAwareness();
  }
  return batteryAwarenessInstance;
}

/**
 * React hook for battery awareness
 */
export function useBatteryAwareness() {
  const [status, setStatus] = React.useState<BatteryStatus>({
    level: 'high',
    percentage: 1,
    charging: true,
  });

  React.useEffect(() => {
    let mounted = true;

    getBatteryAwareness().then(awareness => {
      if (!mounted) return;

      setStatus(awareness.getStatus());
      const unsubscribe = awareness.subscribe(newStatus => {
        if (mounted) {
          setStatus(newStatus);
        }
      });

      return () => {
        unsubscribe();
      };
    });

    return () => {
      mounted = false;
    };
  }, []);

  return status;
}

"use client";

/**
 * Connection manager for handling reconnection and session recovery
 * Handles network glitches, tab backgrounding, and full disconnections
 */

export type ConnectionState = 'online' | 'offline' | 'reconnecting' | 'error';

export interface ConnectionManagerOptions {
  onlineThreshold?: number; // Glitch window (ms)
  backgroundThreshold?: number; // Tab background window (ms)
  maxReconnectAttempts?: number;
  initialRetryDelay?: number;
  maxRetryDelay?: number;
}

/**
 * Manages connection state and reconnection logic
 */
export class ConnectionManager {
  private state: ConnectionState = 'online';
  private lastOnlineTime: number = Date.now();
  private reconnectAttempts: number = 0;
  private reconnectTimer: number | null = null;
  private stateChangeListeners: Set<(state: ConnectionState) => void> = new Set();

  private readonly onlineThreshold: number;
  private readonly backgroundThreshold: number;
  private readonly maxReconnectAttempts: number;
  private readonly initialRetryDelay: number;
  private readonly maxRetryDelay: number;

  constructor(options: ConnectionManagerOptions = {}) {
    this.onlineThreshold = options.onlineThreshold || 5000; // 5 seconds
    this.backgroundThreshold = options.backgroundThreshold || 30000; // 30 seconds
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.initialRetryDelay = options.initialRetryDelay || 1000;
    this.maxRetryDelay = options.maxRetryDelay || 8000;

    this.setupListeners();
  }

  private setupListeners() {
    if (typeof window === 'undefined') return;

    // Monitor online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Monitor visibility changes
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
  }

  private handleOnline() {
    this.lastOnlineTime = Date.now();
    
    if (this.state === 'offline' || this.state === 'error') {
      // Connection restored
      this.setStateIfChanged('online');
    }
  }

  private handleOffline() {
    this.setStateIfChanged('offline');
  }

  private handleVisibilityChange() {
    if (typeof document === 'undefined') return;

    if (document.hidden) {
      // Tab backgrounded
      console.log('Tab backgrounded, pausing media streams');
    } else {
      // Tab returned to foreground
      const backgroundDuration = Date.now() - this.lastOnlineTime;
      if (backgroundDuration > this.backgroundThreshold) {
        console.warn('Tab was backgrounded for > 30s, attempting reconnect');
        this.attemptReconnect();
      }
    }
  }

  private setStateIfChanged(newState: ConnectionState) {
    if (this.state !== newState) {
      this.state = newState;
      this.notifyStateChange();
    }
  }

  private notifyStateChange() {
    this.stateChangeListeners.forEach(listener => listener(this.state));
  }

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'online';
  }

  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  async attemptReconnect(): Promise<boolean> {
    if (this.state === 'online') {
      return true; // Already connected
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStateIfChanged('error');
      return false;
    }

    this.setStateIfChanged('reconnecting');
    const delay = this.calculateBackoffDelay();

    console.log(
      `Attempting reconnect (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}) in ${delay}ms`
    );

    await new Promise(resolve => setTimeout(resolve, delay));

    // Check if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.reconnectAttempts = 0;
      this.setStateIfChanged('online');
      this.lastOnlineTime = Date.now();
      return true;
    } else {
      this.reconnectAttempts++;
      return false;
    }
  }

  private calculateBackoffDelay(): number {
    const exponentialDelay = Math.min(
      this.maxRetryDelay,
      this.initialRetryDelay * Math.pow(2, this.reconnectAttempts)
    );
    // Add jitter
    return exponentialDelay + Math.random() * 1000;
  }

  resetReconnectAttempts() {
    this.reconnectAttempts = 0;
  }

  getReconnectProgress(): number {
    return (this.reconnectAttempts / this.maxReconnectAttempts) * 100;
  }

  cleanup() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => this.handleOnline());
      window.removeEventListener('offline', () => this.handleOffline());
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', () => this.handleVisibilityChange());
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.stateChangeListeners.clear();
  }
}

/**
 * Session recovery manager
 * Handles participant list sync, message replay, etc.
 */
export class SessionRecoveryManager {
  private messageBuffer: any[] = [];
  private lastSyncTimestamp: number = Date.now();

  constructor(private maxBufferSize: number = 1000) {}

  /**
   * Buffer outgoing message when offline
   * Send when back online
   */
  bufferMessage(message: any): void {
    if (this.messageBuffer.length < this.maxBufferSize) {
      this.messageBuffer.push({
        ...message,
        bufferedAt: Date.now(),
      });
    } else {
      console.warn('Message buffer full, dropping oldest message');
      this.messageBuffer.shift();
      this.messageBuffer.push(message);
    }
  }

  getBufferedMessages(): any[] {
    return [...this.messageBuffer];
  }

  clearBuffer(): void {
    this.messageBuffer = [];
  }

  /**
   * Sync participant list from server
   * Should be called after reconnect
   */
  async syncParticipantList(fetchFn: () => Promise<any[]>): Promise<any[]> {
    try {
      const participants = await fetchFn();
      this.lastSyncTimestamp = Date.now();
      return participants;
    } catch (error) {
      console.error('Failed to sync participant list:', error);
      return [];
    }
  }

  /**
   * Fetch missing transcript entries since last sync
   */
  async syncTranscript(fetchFn: (since: number) => Promise<any[]>): Promise<any[]> {
    try {
      const newEntries = await fetchFn(this.lastSyncTimestamp);
      this.lastSyncTimestamp = Date.now();
      return newEntries;
    } catch (error) {
      console.error('Failed to sync transcript:', error);
      return [];
    }
  }

  /**
   * Fetch missing chat messages since last sync
   */
  async syncChat(fetchFn: (since: number) => Promise<any[]>): Promise<any[]> {
    try {
      const newMessages = await fetchFn(this.lastSyncTimestamp);
      this.lastSyncTimestamp = Date.now();
      return newMessages;
    } catch (error) {
      console.error('Failed to sync chat:', error);
      return [];
    }
  }

  getLastSyncTime(): number {
    return this.lastSyncTimestamp;
  }

  reset(): void {
    this.messageBuffer = [];
    this.lastSyncTimestamp = Date.now();
  }
}

/**
 * Meeting state recovery
 * Maintains state during temporary disconnections
 */
export interface MeetingStateSnapshot {
  timestamp: number;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  participantCount: number;
  recordingStatus: 'idle' | 'recording' | 'paused';
}

export class MeetingStateRecovery {
  private stateSnapshots: MeetingStateSnapshot[] = [];
  private readonly maxSnapshots = 10;

  recordSnapshot(state: MeetingStateSnapshot): void {
    this.stateSnapshots.push(state);
    if (this.stateSnapshots.length > this.maxSnapshots) {
      this.stateSnapshots.shift();
    }
  }

  getLastSnapshot(): MeetingStateSnapshot | null {
    return this.stateSnapshots[this.stateSnapshots.length - 1] || null;
  }

  getSnapshots(): MeetingStateSnapshot[] {
    return [...this.stateSnapshots];
  }

  /**
   * Determine what needs recovery
   */
  getRecoveryNeeded(previousState: MeetingStateSnapshot): {
    restoreMeeting: boolean;
    resyncParticipants: boolean;
    resyncTranscript: boolean;
    resyncChat: boolean;
  } {
    const lastSnapshot = this.getLastSnapshot();
    if (!lastSnapshot) {
      return {
        restoreMeeting: false,
        resyncParticipants: true,
        resyncTranscript: true,
        resyncChat: true,
      };
    }

    return {
      restoreMeeting: previousState.participantCount > 0,
      resyncParticipants: previousState.participantCount !== lastSnapshot.participantCount,
      resyncTranscript: true, // Always resync transcript after reconnect
      resyncChat: true, // Always resync chat after reconnect
    };
  }

  clear(): void {
    this.stateSnapshots = [];
  }
}

/**
 * Connection recovery UI state
 */
export interface ReconnectingUIState {
  isReconnecting: boolean;
  progress: number;
  message: string;
  canCancel: boolean;
}

/**
 * Helper to generate UI state during reconnection
 */
export function getReconnectingUIState(
  reconnectProgress: number,
  attempt: number,
  maxAttempts: number
): ReconnectingUIState {
  if (reconnectProgress >= 100) {
    return {
      isReconnecting: false,
      progress: 100,
      message: 'Reconnected!',
      canCancel: false,
    };
  }

  if (attempt >= maxAttempts) {
    return {
      isReconnecting: false,
      progress: 100,
      message: 'Unable to reconnect. Please refresh the page.',
      canCancel: false,
    };
  }

  return {
    isReconnecting: true,
    progress: Math.min(90, reconnectProgress),
    message: `Reconnecting... (Attempt ${attempt}/${maxAttempts})`,
    canCancel: attempt < maxAttempts - 1,
  };
}

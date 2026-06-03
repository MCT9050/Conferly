"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { ConnectionManager, SessionRecoveryManager, MeetingStateRecovery } from '../lib/connectionRecovery';

export interface UseConnectionRecoveryOptions {
  onlineThreshold?: number;
  backgroundThreshold?: number;
  maxReconnectAttempts?: number;
}

/**
 * Hook for managing connection recovery
 * Handles network interruptions and session restore
 */
export function useConnectionRecovery(options: UseConnectionRecoveryOptions = {}) {
  const [connectionState, setConnectionState] = useState('online');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectProgress, setReconnectProgress] = useState(0);

  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  const sessionRecoveryRef = useRef<SessionRecoveryManager | null>(null);
  const meetingStateRecoveryRef = useRef<MeetingStateRecovery | null>(null);

  useEffect(() => {
    // Initialize managers on client side only
    connectionManagerRef.current = new ConnectionManager(options);
    sessionRecoveryRef.current = new SessionRecoveryManager();
    meetingStateRecoveryRef.current = new MeetingStateRecovery();

    // Listen for connection state changes
    const unsubscribe = connectionManagerRef.current.onStateChange((state) => {
      setConnectionState(state);

      if (state === 'reconnecting') {
        setIsReconnecting(true);
      } else if (state === 'online') {
        setIsReconnecting(false);
        setReconnectProgress(0);
      } else if (state === 'offline') {
        setReconnectProgress(connectionManagerRef.current?.getReconnectProgress() || 0);
      }
    });

    return () => {
      unsubscribe();
      connectionManagerRef.current?.cleanup();
    };
  }, []);

  const recordMeetingState = useCallback((state: any) => {
    if (meetingStateRecoveryRef.current) {
      meetingStateRecoveryRef.current.recordSnapshot({
        timestamp: Date.now(),
        ...state,
      });
    }
  }, []);

  const bufferMessage = useCallback((message: any) => {
    if (sessionRecoveryRef.current) {
      sessionRecoveryRef.current.bufferMessage(message);
    }
  }, []);

  const attemptReconnect = useCallback(async () => {
    if (!connectionManagerRef.current) return false;
    return await connectionManagerRef.current.attemptReconnect();
  }, []);

  return {
    connectionState,
    isReconnecting,
    reconnectProgress,
    recordMeetingState,
    bufferMessage,
    attemptReconnect,
    connectionManager: connectionManagerRef.current,
    sessionRecovery: sessionRecoveryRef.current,
    meetingStateRecovery: meetingStateRecoveryRef.current,
  };
}

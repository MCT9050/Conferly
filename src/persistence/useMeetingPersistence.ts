/**
 * useMeetingPersistence - Session persistence hook
 * Saves active room session to localStorage for recovery on refresh
 */
import { useState, useEffect, useCallback } from 'react';

export interface MeetingSession {
  roomId: string;
  displayName: string;
  joinedAt: string;
  isHost: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  meetingPassword?: string;
}

const SESSION_KEY = 'conferly_active_session';

const defaultSession: MeetingSession = {
  roomId: '',
  displayName: '',
  joinedAt: '',
  isHost: false,
  audioEnabled: true,
  videoEnabled: true,
};

// Save session to localStorage
export function saveSession(session: MeetingSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('[persist] Failed to save session:', e);
  }
}

// Load session from localStorage
export function loadSession(): MeetingSession | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    const session = JSON.parse(data) as MeetingSession;
    if (!session.roomId) return null;
    return session;
  } catch (e) {
    console.warn('[persist] Failed to load session:', e);
    return null;
  }
}

// Clear session from localStorage
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.warn('[persist] Failed to clear session:', e);
  }
}

// Check if a session exists
export function hasSession(): boolean {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return false;
    const session = JSON.parse(data) as MeetingSession;
    return !!session.roomId;
  } catch {
    return false;
  }
}

// Hook for components
export function useMeetingPersistence() {
  const [session, setSessionState] = useState<MeetingSession | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

  // Load existing session on mount
  useEffect(() => {
    const existing = loadSession();
    if (existing) {
      setSessionState(existing);
      setIsRecovering(true);
    }
  }, []);

  // Save session
  const save = useCallback((newSession: MeetingSession) => {
    saveSession(newSession);
    setSessionState(newSession);
  }, []);

  // Clear session
  const clear = useCallback(() => {
    clearSession();
    setSessionState(null);
    setIsRecovering(false);
  }, []);

  // Dismiss recovery mode
  const dismissRecovery = useCallback(() => {
    setIsRecovering(false);
  }, []);

  // Rejoin session (for reconnect banner)
  const rejoin = useCallback(() => {
    setIsRecovering(false);
  }, []);

  return {
    session,
    isRecovering,
    hasSession: !!session,
    save,
    clear,
    dismissRecovery,
    rejoin,
  };
}

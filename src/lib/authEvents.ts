/**
 * Auth Event Sourcing System
 * Records every authentication-related action for session replay
 * 
 * Implements event sourcing model for authentication:
 * - Every action generates an event
 * - Events are stored in order
 * - Sessions can be reconstructed after the fact
 * 
 * @module authEvents
 */

import { v4 as uuidv4 } from 'uuid';

// Generate session ID for this browser session
const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

// Get or create current session ID
function getCurrentSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  const win = window as unknown as { AUTH_SESSION_ID?: string };
  if (!win.AUTH_SESSION_ID) {
    win.AUTH_SESSION_ID = generateSessionId();
  }
  return win.AUTH_SESSION_ID;
}

// Event store structure
export interface AuthEvent {
  eventId: string;
  type: AuthEventType;
  timestamp: number;
  sessionId: string;
  userId?: string;
  email?: string;
  success: boolean;
  metadata: AuthEventMetadata;
}

export interface AuthEventMetadata {
  source: 'login_form' | 'signup_form' | 'session_restore' | 'auto_login' | 'unknown';
  attemptNumber: number;
  error?: string;
  provider?: 'supabase' | 'backend' | 'offline';
  duration?: number; // ms since previous event
}

export type AuthEventType = 
  | 'auth:login_attempt'
  | 'auth:login_success'
  | 'auth:login_failure'
  | 'auth:login_blocked'
  | 'auth:login_retry'
  | 'auth:register_attempt'
  | 'auth:register_success'
  | 'auth:register_failure'
  | 'auth:session_restore_start'
  | 'auth:session_restored'
  | 'auth:session_expired'
  | 'auth:session_none';

// Event store
const EVENT_STORE: AuthEvent[] = [];
const MAX_STORE_SIZE = 1000;

// Per-session attempt tracking
const ATTEMPT_COUNTERS: Map<string, { login: number; register: number; success: boolean }> = new Map();

/**
 * Get attempt number for session
 */
function getAttemptNumber(sessionId: string, type: 'login' | 'register'): number {
  const counters = ATTEMPT_COUNTERS.get(sessionId);
  if (!counters) return 1;
  return type === 'login' ? counters.login + 1 : counters.register + 1;
}

/**
 * Increment attempt counter
 */
function incrementAttempt(sessionId: string, type: 'login' | 'register'): void {
  let counters = ATTEMPT_COUNTERS.get(sessionId);
  if (!counters) {
    counters = { login: 0, register: 0, success: false };
    ATTEMPT_COUNTERS.set(sessionId, counters);
  }
  if (type === 'login') counters.login++;
  else counters.register++;
}

/**
 * Mark session as successful
 */
function markSuccess(sessionId: string): void {
  const counters = ATTEMPT_COUNTERS.get(sessionId);
  if (counters) counters.success = true;
}

/**
 * Check if session is successful
 */
function isSessionSuccessful(sessionId: string): boolean {
  const counters = ATTEMPT_COUNTERS.get(sessionId);
  return counters?.success || false;
}

/**
 * Emit an authentication event
 * 
 * @param type - Event type
 * @param data - Event data
 */
export function emit(type: AuthEventType, data: Partial<AuthEvent>): void {
  const sessionId = data.sessionId || getCurrentSessionId();
  const attemptType = type.includes('login') ? 'login' : 'register';
  
  // Get attempt number (don't increment for success/failure - only attempts)
  let attemptNumber = 1;
  if (type === 'auth:login_attempt' || type === 'auth:register_attempt') {
    attemptNumber = getAttemptNumber(sessionId, attemptType);
    incrementAttempt(sessionId, attemptType);
  } else if (type.includes('success')) {
    attemptNumber = getAttemptNumber(sessionId, attemptType);
    markSuccess(sessionId);
  } else {
    // For failures/sessions, get current attempt number
    attemptNumber = getAttemptNumber(sessionId, attemptType);
  }
  
  // Calculate duration since last event
  const lastEvent = EVENT_STORE[EVENT_STORE.length - 1];
  const duration = lastEvent ? Date.now() - lastEvent.timestamp : 0;
  
  const event: AuthEvent = {
    eventId: uuidv4(),
    type,
    timestamp: Date.now(),
    sessionId,
    userId: data.userId,
    email: data.email,
    success: type.includes('success'),
    metadata: {
      source: data.metadata?.source || 'unknown',
      attemptNumber,
      error: data.metadata?.error,
      provider: data.metadata?.provider,
      duration,
    },
  };
  
  // Add to store
  EVENT_STORE.push(event);
  
  // Limit store size
  if (EVENT_STORE.length > MAX_STORE_SIZE) {
    EVENT_STORE.shift();
  }
  
  // Console output
  const prefix = type.includes('success') ? '[AUTH:✅]' 
    : type.includes('failure') || type.includes('blocked') ? '[AUTH:❌]'
    : '[AUTH:event]';
  
  console.log(prefix, {
    type: event.type,
    sessionId: event.sessionId.slice(0, 20) + '...',
    attempt: event.metadata.attemptNumber,
    duration: event.metadata.duration ? `${event.metadata.duration}ms` : '-',
    ...(event.email ? { email: event.email?.split('@')[0] + '@...' } : {}),
    ...(event.metadata.error ? { error: event.metadata.error.slice(0, 30) } : {}),
  });
}

/**
 * Emit login attempt
 */
export function emitLoginAttempt(email: string, provider?: 'supabase' | 'backend' | 'offline'): void {
  emit('auth:login_attempt', {
    email,
    metadata: { source: 'login_form', attemptNumber: 0, provider },
  });
}

/**
 * Emit login success
 */
export function emitLoginSuccess(userId: string, email: string, provider?: 'supabase' | 'backend' | 'offline'): void {
  emit('auth:login_success', {
    userId,
    email,
    metadata: { source: 'login_form', attemptNumber: 0, provider },
  });
}

/**
 * Emit login failure
 */
export function emitLoginFailure(email: string, error: string, provider?: 'supabase' | 'backend' | 'offline'): void {
  emit('auth:login_failure', {
    email,
    metadata: { source: 'login_form', attemptNumber: 0, error, provider },
  });
}

/**
 * Emit login blocked (brute force, etc)
 */
export function emitLoginBlocked(email: string, reason: string): void {
  emit('auth:login_blocked', {
    email,
    metadata: { source: 'login_form', attemptNumber: 0, error: reason },
  });
}

/**
 * Emit login retry
 */
export function emitLoginRetry(email: string, attemptNumber: number): void {
  emit('auth:login_retry', {
    email,
    metadata: { source: 'login_form', attemptNumber },
  });
}

/**
 * Emit register attempt
 */
export function emitRegisterAttempt(email: string, provider?: 'supabase' | 'backend' | 'offline'): void {
  emit('auth:register_attempt', {
    email,
    metadata: { source: 'signup_form', attemptNumber: 0, provider },
  });
}

/**
 * Emit register success
 */
export function emitRegisterSuccess(userId: string, email: string, provider?: 'supabase' | 'backend' | 'offline'): void {
  emit('auth:register_success', {
    userId,
    email,
    metadata: { source: 'signup_form', attemptNumber: 0, provider },
  });
}

/**
 * Emit register failure
 */
export function emitRegisterFailure(email: string, error: string, provider?: 'supabase' | 'backend' | 'offline'): void {
  emit('auth:register_failure', {
    email,
    metadata: { source: 'signup_form', attemptNumber: 0, error, provider },
  });
}

/**
 * Emit session restore start
 */
export function emitSessionRestoreStart(): void {
  emit('auth:session_restore_start', {
    metadata: { source: 'session_restore', attemptNumber: 0 },
  });
}

/**
 * Emit session restored
 */
export function emitSessionRestored(userId: string): void {
  emit('auth:session_restored', {
    userId,
    metadata: { source: 'session_restore', attemptNumber: 0 },
  });
}

/**
 * Emit session expired
 */
export function emitSessionExpired(): void {
  emit('auth:session_expired', {
    metadata: { source: 'session_restore', attemptNumber: 0 },
  });
}

/**
 * Emit session none found
 */
export function emitSessionNone(): void {
  emit('auth:session_none', {
    metadata: { source: 'session_restore', attemptNumber: 0 },
  });
}

/**
 * Get all events for a session
 */
export function getSessionEvents(sessionId: string): AuthEvent[] {
  return EVENT_STORE.filter(e => e.sessionId === sessionId);
}

/**
 * Get all events from current session
 */
export function getCurrentEvents(): AuthEvent[] {
  const sessionId = getCurrentSessionId();
  return getSessionEvents(sessionId);
}

/**
 * Replay authentication session
 * 
 * Returns chronological sequence of events for reconstruction
 */
export function replayAuthSession(sessionId?: string): AuthEvent[] {
  const sid = sessionId || getCurrentSessionId();
  return getSessionEvents(sid).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get session summary
 */
export function getSessionSummary(sessionId?: string): {
  sessionId: string;
  totalEvents: number;
  loginAttempts: number;
  loginFailures: number;
  loginSuccesses: number;
  registerAttempts: number;
  registerFailures: number;
  registerSuccesses: number;
  sessionRestored: number;
  sessionExpired: number;
  totalDuration: number;
  firstAttemptTime: number;
  lastAttemptTime: number;
  failureToSuccessRatio: number;
} {
  const sid = sessionId || getCurrentSessionId();
  const events = getSessionEvents(sid);
  
  if (events.length === 0) {
    return {
      sessionId: sid,
      totalEvents: 0,
      loginAttempts: 0,
      loginFailures: 0,
      loginSuccesses: 0,
      registerAttempts: 0,
      registerFailures: 0,
      registerSuccesses: 0,
      sessionRestored: 0,
      sessionExpired: 0,
      totalDuration: 0,
      firstAttemptTime: 0,
      lastAttemptTime: 0,
      failureToSuccessRatio: 0,
    };
  }
  
  const loginAttempts = events.filter(e => e.type === 'auth:login_attempt').length;
  const loginFailures = events.filter(e => e.type === 'auth:login_failure').length;
  const loginSuccesses = events.filter(e => e.type === 'auth:login_success').length;
  const registerAttempts = events.filter(e => e.type === 'auth:register_attempt').length;
  const registerFailures = events.filter(e => e.type === 'auth:register_failure').length;
  const registerSuccesses = events.filter(e => e.type === 'auth:register_success').length;
  const sessionRestored = events.filter(e => e.type === 'auth:session_restored').length;
  const sessionExpired = events.filter(e => e.type === 'auth:session_expired').length;
  
  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  const totalDuration = lastEvent.timestamp - firstEvent.timestamp;
  
  const totalFailures = loginFailures + registerFailures;
  const totalSuccesses = loginSuccesses + registerSuccesses;
  const failureToSuccessRatio = totalSuccesses > 0 ? totalFailures / totalSuccesses : totalFailures > 0 ? totalFailures : 0;
  
  return {
    sessionId: sid,
    totalEvents: events.length,
    loginAttempts,
    loginFailures,
    loginSuccesses,
    registerAttempts,
    registerFailures,
    registerSuccesses,
    sessionRestored,
    sessionExpired,
    totalDuration,
    firstAttemptTime: firstEvent?.timestamp || 0,
    lastAttemptTime: lastEvent?.timestamp || 0,
    failureToSuccessRatio: Math.round(failureToSuccessRatio * 100) / 100,
  };
}

/**
 * Generate AUTH SESSION REPLAY REPORT
 */
export function generateAuthReport(): string {
  const sessionId = getCurrentSessionId();
  const events = replayAuthSession(sessionId);
  const summary = getSessionSummary(sessionId);
  
  let report = `\n=== AUTH SESSION REPLAY REPORT ===\n`;
  report += `SESSION: ${sessionId}\n`;
  report += `=================================\n\n`;
  
  // Event sequence
  report += `EVENT SEQUENCE:\n`;
  report += `---------------------------------\n`;
  
  let firstTimestamp = events[0]?.timestamp || 0;
  
  for (const event of events) {
    const relativeTime = event.timestamp - firstTimestamp;
    const successIcon = event.success ? '✅' : '❌';
    const attemptInfo = event.metadata.attemptNumber > 0 ? ` (attempt ${event.metadata.attemptNumber})` : '';
    const errorInfo = event.metadata.error ? ` - ${event.metadata.error}` : '';
    
    report += `[${relativeTime}ms] ${successIcon} ${event.type}${attemptInfo}${errorInfo}\n`;
  }
  
  report += `\n`;
  report += `SUMMARY:\n`;
  report += `---------------------------------\n`;
  report += `Total Events: ${summary.totalEvents}\n`;
  report += `Login Attempts: ${summary.loginAttempts}\n`;
  report += `Login Failures: ${summary.loginFailures}\n`;
  report += `Login Successes: ${summary.loginSuccesses}\n`;
  report += `Register Attempts: ${summary.registerAttempts}\n`;
  report += `Register Failures: ${summary.registerFailures}\n`;
  report += `Register Successes: ${summary.registerSuccesses}\n`;
  report += `Session Restored: ${summary.sessionRestored}\n`;
  report += `Session Expired: ${summary.sessionExpired}\n`;
  report += `Total Duration: ${(summary.totalDuration / 1000).toFixed(2)}s\n`;
  
  if (summary.loginFailures > 0 && summary.loginSuccesses > 0) {
    report += `\nFailure Rate: ${Math.round(summary.loginFailures / summary.loginAttempts * 100)}%\n`;
    report += `Time to success: ${(summary.totalDuration / 1000).toFixed(2)}s\n`;
  }
  
  report += `\n=================================\n`;
  
  return report;
}

/**
 * Detect brute force pattern
 */
export function detectBruteForce(sessionId?: string): boolean {
  const sid = sessionId || getCurrentSessionId();
  const events = getSessionEvents(sid);
  
  const recentFailures = events.filter(e => 
    (e.type === 'auth:login_failure' || e.type === 'auth:login_blocked') &&
    Date.now() - e.timestamp < 60000 // Last 60 seconds
  );
  
  return recentFailures.length >= 5; // 5+ failures in 60 seconds = brute force
}

/**
 * Detect rapid retries (same timestamp burst)
 */
export function detectRapidRetries(sessionId?: string): boolean {
  const sid = sessionId || getCurrentSessionId();
  const events = getSessionEvents(sid);
  
  for (let i = 1; i < events.length; i++) {
    const timeDiff = events[i].timestamp - events[i-1].timestamp;
    if (timeDiff < 100 && events[i].type === 'auth:login_attempt') {
      return true;
    }
  }
  return false;
}

/**
 * Detect pattern types
 */
export function detectPatterns(): {
  bruteForce: boolean;
  rapidRetries: boolean;
  mixedCredentials: boolean;
} {
  const sessionId = getCurrentSessionId();
  
  return {
    bruteForce: detectBruteForce(sessionId),
    rapidRetries: detectRapidRetries(sessionId),
    mixedCredentials: false, // Would need more complex tracking
  };
}

/**
 * Clear event store (for testing or new session)
 */
export function clearEventStore(): void {
  EVENT_STORE.length = 0;
  ATTEMPT_COUNTERS.clear();
}

/**
 * Export all events for external analysis
 */
export function exportEvents(): AuthEvent[] {
  return [...EVENT_STORE];
}

// Attach to window for debugging
if (typeof window !== 'undefined') {
  const win = window as unknown as { 
    AUTH_EVENT_STORE: AuthEvent[];
    AUTH_SESSION_ID: string;
    getCurrentEvents: typeof getCurrentEvents;
    replayAuthSession: typeof replayAuthSession;
    getSessionSummary: typeof getSessionSummary;
    generateAuthReport: typeof generateAuthReport;
    detectPatterns: typeof detectPatterns;
    clearEventStore: typeof clearEventStore;
    emitLoginAttempt: typeof emitLoginAttempt;
    emitLoginSuccess: typeof emitLoginSuccess;
    emitLoginFailure: typeof emitLoginFailure;
    emitRegisterSuccess: typeof emitRegisterSuccess;
    emitSessionRestored: typeof emitSessionRestored;
    emitSessionExpired: typeof emitSessionExpired;
  };
  
  win.AUTH_EVENT_STORE = EVENT_STORE;
  win.getCurrentEvents = getCurrentEvents;
  win.replayAuthSession = replayAuthSession;
  win.getSessionSummary = getSessionSummary;
  win.generateAuthReport = generateAuthReport;
  win.detectPatterns = detectPatterns;
  win.clearEventStore = clearEventStore;
  win.emitLoginAttempt = emitLoginAttempt;
  win.emitLoginSuccess = emitLoginSuccess;
  win.emitLoginFailure = emitLoginFailure;
  win.emitRegisterSuccess = emitRegisterSuccess;
  win.emitSessionRestored = emitSessionRestored;
  win.emitSessionExpired = emitSessionExpired;
}
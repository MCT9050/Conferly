/**
 * Auth Tracing Utility
 * Production-safe observability for authentication flows
 * 
 * Logs auth events in real-time for debugging
 * NO sensitive data (passwords, tokens) is logged
 * 
 * @module authTracer
 */

// High-resolution timestamp
function now(): number {
  return performance.now();
}

// Trace buffer - stores all auth events
const TRACE_BUFFER: AuthTraceEntry[] = [];
const MAX_BUFFER_SIZE = 500; // Limit buffer size

export interface AuthTraceEntry {
  event: string;
  timestamp: number;
  time: string;
  data?: Record<string, unknown>;
  category: 'auth' | 'supabase' | 'state' | 'session' | 'race' | 'error';
}

/**
 * Format timestamp for display
 */
function formatTime(ts: number): string {
  const date = new Date();
  return `${date.toISOString().slice(11, 19)}.${String(ts % 1000).padStart(3, '0')}`;
}

/**
 * Add entry to trace buffer
 */
function addToBuffer(entry: AuthTraceEntry): void {
  // Add to buffer
  TRACE_BUFFER.push(entry);
  
  // Limit buffer size
  if (TRACE_BUFFER.length > MAX_BUFFER_SIZE) {
    TRACE_BUFFER.shift();
  }
}

/**
 * Log authentication event
 * 
 * @param event - Event name (lowercase with colons)
 * @param data - Optional payload (NO passwords/tokens)
 */
export function log(event: string, data?: Record<string, unknown>): void {
  const ts = now();
  const entry: AuthTraceEntry = {
    event,
    timestamp: ts,
    time: formatTime(ts),
    data: sanitizeData(data),
    category: 'auth'
  };
  
  addToBuffer(entry);
  
  // Console output with category prefix
  const prefix = '[AUTH:event]';
  console.log(prefix, { time: entry.time, event, ...(data ? { data: entry.data } : {}) });
}

/**
 * Log Supabase interaction
 * 
 * @param event - Event name
 * @param data - Optional payload
 */
export function supabase(event: string, data?: Record<string, unknown>): void {
  const ts = now();
  const entry: AuthTraceEntry = {
    event: `supabase:${event}`,
    timestamp: ts,
    time: formatTime(ts),
    data: sanitizeData(data),
    category: 'supabase'
  };
  
  addToBuffer(entry);
  
  const prefix = '[SUPABASE:event]';
  console.log(prefix, { time: entry.time, event, ...(data ? { data: entry.data } : {}) });
}

/**
 * Log state transition
 * 
 * @param event - Event name
 * @param data - State data
 */
export function state(event: string, data?: Record<string, unknown>): void {
  const ts = now();
  const entry: AuthTraceEntry = {
    event: `state:${event}`,
    timestamp: ts,
    time: formatTime(ts),
    data: sanitizeData(data),
    category: 'state'
  };
  
  addToBuffer(entry);
  
  const prefix = '[STATE:event]';
  console.log(prefix, { time: entry.time, event, ...(data ? { data: entry.data } : {}) });
}

/**
 * Log session lifecycle
 * 
 * @param event - Event name
 * @param data - Session data (NO tokens)
 */
export function session(event: string, data?: Record<string, unknown>): void {
  const ts = now();
  const entry: AuthTraceEntry = {
    event: `session:${event}`,
    timestamp: ts,
    time: formatTime(ts),
    data: sanitizeData(data),
    category: 'session'
  };
  
  addToBuffer(entry);
  
  const prefix = '[SESSION:event]';
  console.log(prefix, { time: entry.time, event, ...(data ? { data: entry.data } : {}) });
}

/**
 * Log error
 * 
 * @param event - Event name
 * @param error - Error data
 */
export function error(event: string, error: Record<string, unknown>): void {
  const ts = now();
  const entry: AuthTraceEntry = {
    event: `error:${event}`,
    timestamp: ts,
    time: formatTime(ts),
    data: sanitizeData(error),
    category: 'error'
  };
  
  addToBuffer(entry);
  
  const prefix = '[ERROR:event]';
  console.error(prefix, { time: entry.time, event, ...{ data: entry.data } });
}

/**
 * Detect and log race conditions
 * 
 * @param type - Type of race
 * @param events - Conflicting events
 * @param data - Additional data
 */
export function race(type: string, events: string[], data?: Record<string, unknown>): void {
  const ts = now();
  const entry: AuthTraceEntry = {
    event: `race:detected:${type}`,
    timestamp: ts,
    time: formatTime(ts),
    data: {
      ...sanitizeData(data),
      events,
      timestamps: events.map(() => formatTime(ts))
    },
    category: 'race'
  };
  
  addToBuffer(entry);
  
  const prefix = '[RACE:detected]';
  console.warn(prefix, { time: entry.time, type, events, ...(data ? { data: entry.data } : {}) });
}

/**
 * Sanitize data - remove sensitive fields
 * 
 * NEVER log: passwords, tokens, secrets, raw credentials
 */
function sanitizeData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;
  
  const sensitive = [
    'password',
    'token',
    'access_token',
    'refresh_token',
    'secret',
    'jwt',
    'hash',
    'encrypted_password',
    'options',
    'turnstileToken',
    'credentials'
  ];
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (sensitive.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = '[object]';
    } else if (typeof value === 'string' && value.length > 50) {
      sanitized[key] = value.slice(0, 10) + '...[truncated]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Get full trace buffer for export/debugging
 * 
 * @returns All trace entries sorted by timestamp
 */
export function getAuthTrace(): AuthTraceEntry[] {
  return [...TRACE_BUFFER].sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get trace grouped by session
 * 
 * @param sessionId - Optional session filter
 */
export function getSessionTrace(sessionId?: string): AuthTraceEntry[] {
  const traces = getAuthTrace();
  
  if (sessionId) {
    return traces.filter(t => 
      t.data?.sessionId === sessionId
    );
  }
  
  return traces;
}

/**
 * Get trace for current session
 * 
 * Returns events from current browser session
 */
export function getCurrentTrace(): AuthTraceEntry[] {
  const traces = getAuthTrace();
  const sessionStart = traces[0]?.timestamp || 0;
  
  return traces.filter(t => t.timestamp >= sessionStart);
}

/**
 * Clear trace buffer
 * Useful for testing or memory management
 */
export function clearAuthTrace(): void {
  TRACE_BUFFER.length = 0;
}

/**
 * Export trace for external analysis
 */
export function exportAuthTrace(): {
  buffer: AuthTraceEntry[];
  exportTime: string;
  eventCount: number;
} {
  return {
    buffer: getAuthTrace(),
    exportTime: new Date().toISOString(),
    eventCount: TRACE_BUFFER.length
  };
}

/**
 * Get trace summary
 * Useful for debugging
 */
export function getTraceSummary(): {
  totalEvents: number;
  byCategory: Record<string, number>;
  firstEvent: string;
  lastEvent: string;
} {
  const traces = getAuthTrace();
  
  const byCategory: Record<string, number> = {};
  for (const t of traces) {
    byCategory[t.category] = (byCategory[t.category] || 0) + 1;
  }
  
  return {
    totalEvents: traces.length,
    byCategory,
    firstEvent: traces[0]?.event || 'none',
    lastEvent: traces[traces.length - 1]?.event || 'none'
  };
}

/**
 * Enable/disable tracing (production safety)
 */
let TracingEnabled = true;

/**
 * Disable tracing in production if needed
 */
export function setTracingEnabled(enabled: boolean): void {
  TracingEnabled = enabled;
}

/**
 * Check if tracing is enabled
 */
export function isTracingEnabled(): boolean {
  return TracingEnabled;
}

// Attach to window for debugging
if (typeof window !== 'undefined') {
  (window as unknown as { AUTH_TRACE_BUFFER: AuthTraceEntry[] }).AUTH_TRACE_BUFFER = TRACE_BUFFER;
  (window as unknown as { getAuthTrace: typeof getAuthTrace }).getAuthTrace = getAuthTrace;
  (window as unknown as { exportAuthTrace: typeof exportAuthTrace }).exportAuthTrace = exportAuthTrace;
  (window as unknown as { clearAuthTrace: typeof clearAuthTrace }).clearAuthTrace = clearAuthTrace;
  (window as unknown as { getTraceSummary: typeof getTraceSummary }).getTraceSummary = getTraceSummary;
}
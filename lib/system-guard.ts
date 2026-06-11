// lib/system-guard.ts
// Conferly Pre-Flight Shield & Circuit Breaker Layer
// Sliding window rate-limiter + circuit breaker for Hugging Face API calls.
// Optimized for 6GB RAM — uses simple Map with periodic timestamp pruning.

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

import { trackEvent } from './telemetry';

const GLOBAL_WINDOW_MS = 60_000;       // 1 minute
const GLOBAL_MAX_REQUESTS = 50;         // 50 requests/min global
const ROOM_WINDOW_MS = 60_000;          // 1 minute
const ROOM_MAX_REQUESTS = 10;           // 10 requests/min per room
const CIRCUIT_OPEN_MS = 30_000;         // 30 seconds circuit open duration
const CIRCUIT_FAILURE_THRESHOLD = 3;    // 3 consecutive 429/503 to trip

// ---------------------------------------------------------------------------
// State — in-memory, optimized for single-process Next.js serverless
// ---------------------------------------------------------------------------

/** Map<key, sorted timestamps[]> — each timestamp is Date.now() */
const requestLog = new Map<string, number[]>();

/** Current circuit breaker state */
let circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
/** Consecutive failure count (429 or 503 from HF) */
let failureCount = 0;
/** Timestamp when circuit was last tripped OPEN */
let openedAt = 0;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Remove timestamps older than `windowMs` for a given key.
 * Automatically deletes the key when the window is empty.
 */
function pruneWindow(key: string, windowMs: number): void {
  const timestamps = requestLog.get(key);
  if (!timestamps) return;

  const cutoff = Date.now() - windowMs;
  const valid = timestamps.filter(t => t > cutoff);

  if (valid.length === 0) {
    requestLog.delete(key);
  } else {
    requestLog.set(key, valid);
  }
}

/**
 * Periodic garbage collection — prunes ALL keys every N calls.
 * Simple counter to avoid expensive scans on every check.
 */
let gcCounter = 0;
const GC_INTERVAL = 10;

function maybeGc(): void {
  gcCounter = (gcCounter + 1) % GC_INTERVAL;
  if (gcCounter !== 0) return;

  const now = Date.now();
  const globalCutoff = now - GLOBAL_WINDOW_MS;
  const roomCutoff = now - ROOM_WINDOW_MS;

  for (const [key, timestamps] of requestLog.entries()) {
    const cutoff = key.startsWith('room:') ? roomCutoff : globalCutoff;
    const valid = timestamps.filter(t => t > cutoff);
    if (valid.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, valid);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if a request is allowed based on:
 * 1. Circuit breaker state
 * 2. Global AI rate limit (50 req/min)
 * 3. Per-room AI rate limit (10 req/min)
 *
 * @param roomId - Optional room ID for per-room limiting
 * @returns Object with `allowed` boolean and optional `retryAfter` (seconds)
 */
export function checkRateLimit(roomId?: string): { allowed: boolean; retryAfter?: number } {
  maybeGc();

  // --- Circuit breaker check ---
  if (circuitState === 'OPEN') {
    const elapsed = Date.now() - openedAt;
    if (elapsed >= CIRCUIT_OPEN_MS) {
      circuitState = 'HALF_OPEN'; // Allow a single probe request
    } else {
      return {
        allowed: false,
        retryAfter: Math.ceil((CIRCUIT_OPEN_MS - elapsed) / 1000),
      };
    }
  }

  // --- Global limit ---
  const globalKey = 'global:ai';
  pruneWindow(globalKey, GLOBAL_WINDOW_MS);
  const globalTimestamps = requestLog.get(globalKey) || [];

  if (globalTimestamps.length >= GLOBAL_MAX_REQUESTS) {
    return { allowed: false, retryAfter: 30 };
  }

  // Record global slot (will be pruned if roomId check fails below)
  requestLog.set(globalKey, [...globalTimestamps, Date.now()]);

  // --- Per-room limit ---
  if (roomId) {
    const roomKey = `room:${roomId}`;
    pruneWindow(roomKey, ROOM_WINDOW_MS);
    const roomTimestamps = requestLog.get(roomKey) || [];

    if (roomTimestamps.length >= ROOM_MAX_REQUESTS) {
      // Roll back the global slot we just added
      const rolledBack = requestLog.get(globalKey)!;
      rolledBack.pop();
      if (rolledBack.length === 0) requestLog.delete(globalKey);
      return { allowed: false, retryAfter: 30 };
    }

    requestLog.set(roomKey, [...roomTimestamps, Date.now()]);
  }

  return { allowed: true };
}

/**
 * Record a Hugging Face API response status to drive the circuit breaker.
 *
 * - 429 (Rate Limit) or 503 (Overloaded) → increment failure count
 * - Any other status (including success) → reset failure count, close circuit
 *
 * When failure count reaches CIRCUIT_FAILURE_THRESHOLD the circuit trips OPEN.
 */
export function recordHfResponse(status: number): void {
  if (status === 429 || status === 503) {
    failureCount += 1;

    if (failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
      circuitState = 'OPEN';
      openedAt = Date.now();
      failureCount = 0; // Reset counter; next check will use circuit state

      trackEvent('CIRCUIT_OPENED', {
        reason: `Consecutive failures (${CIRCUIT_FAILURE_THRESHOLD})`,
        lastStatus: status,
        circuitDurationMs: CIRCUIT_OPEN_MS,
      });
    }
  } else {
    const previousState = circuitState;

    // Success or unexpected status — reset breaker
    failureCount = 0;
    circuitState = 'CLOSED';

    if (previousState === 'HALF_OPEN' || previousState === 'OPEN') {
      trackEvent('CIRCUIT_CLOSED', {
        previousState,
      });
    }
  }
}

/**
 * Get current circuit breaker state for monitoring / health dashboard.
 */
export function getCircuitBreakerState(): {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  retryAfter?: number;
  openedAt?: number;
} {
  if (circuitState === 'OPEN') {
    const elapsed = Date.now() - openedAt;
    return {
      state: 'OPEN',
      retryAfter: Math.ceil((CIRCUIT_OPEN_MS - elapsed) / 1000),
      openedAt,
    };
  }

  return { state: circuitState };
}

/**
 * Get system load metrics for monitoring dashboard.
 */
export function getSystemLoad(): {
  globalUsage: number;
  globalMax: number;
  roomUsage?: number;
  circuitState: string;
  totalKeys: number;
} {
  pruneWindow('global:ai', GLOBAL_WINDOW_MS);
  const globalTimestamps = requestLog.get('global:ai');

  return {
    globalUsage: globalTimestamps?.length ?? 0,
    globalMax: GLOBAL_MAX_REQUESTS,
    circuitState,
    totalKeys: requestLog.size,
  };
}

/**
 * Get the current failure count (used for diagnostics).
 */
export function getFailureCount(): number {
  return failureCount;
}

/**
 * Reset all state — primarily for testing.
 */
export function resetForTest(): void {
  requestLog.clear();
  circuitState = 'CLOSED';
  failureCount = 0;
  openedAt = 0;
  gcCounter = 0;
}

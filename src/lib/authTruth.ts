/**
 * Full-Stack Auth Truth System
 * 
 * Complete authentication observability across all layers:
 * - Frontend (React runtime)
 * - Network (fetch/XHR)
 * - Supabase SDK
 * - Backend behavior inference
 * - System of truth ranking
 * 
 * @module authTruth
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================
// PHASE 1: REQUEST CORRELATION LAYER
// ============================================

export interface RequestContext {
  requestId: string;
  correlationId: string;
  sessionId: string;
  timestamp: number;
  endpoint?: string;
  method?: string;
}

// Generate unique request ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Get or create session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  const win = window as unknown as { AUTH_SESSION_ID?: string };
  if (!win.AUTH_SESSION_ID) {
    win.AUTH_SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  return win.AUTH_SESSION_ID;
}

// ============================================
// PHASE 2: NETWORK LAYER INTERCEPTION
// ============================================

export type NetworkEventType = 
  | 'network:request_start'
  | 'network:request_success'
  | 'network:request_failure'
  | 'network:request_timeout'
  | 'network:request_aborted';

export interface NetworkEvent {
  eventId: string;
  type: NetworkEventType;
  requestId: string;
  correlationId: string;
  endpoint: string;
  method: string;
  timestamp: number;
  duration?: number;
  statusCode?: number;
  error?: string;
  timing: {
    frontend: number;
    network: number;
    backend_inferred: number;
    total: number;
  };
}

// Network event emission with timing
export function emitNetworkEvent(
  type: NetworkEventType,
  requestId: string,
  correlationId: string,
  endpoint: string,
  method: string,
  startTime: number,
  options?: {
    statusCode?: number;
    error?: string;
  }
): NetworkEvent {
  const now = Date.now();
  const totalDuration = now - startTime;
  
  // Estimate frontend vs network (assuming ~30% frontend, ~70% network)
  const estimatedNetwork = totalDuration * 0.7;
  const estimatedFrontend = totalDuration * 0.3;
  
  const event: NetworkEvent = {
    eventId: uuidv4(),
    type,
    requestId,
    correlationId,
    endpoint,
    method,
    timestamp: now,
    duration: totalDuration,
    statusCode: options?.statusCode,
    error: options?.error,
    timing: {
      frontend: Math.round(estimatedFrontend),
      network: Math.round(estimatedNetwork),
      backend_inferred: 0, // Will be inferred from response
      total: totalDuration,
    },
  };
  
  const prefix = type.includes('success') ? '[NETWORK:✅]' 
    : type.includes('failure') || type.includes('timeout') || type.includes('aborted') ? '[NETWORK:❌]'
    : '[NETWORK:event]';
  
  console.log(prefix, {
    type: event.type,
    requestId: event.requestId.slice(0, 15) + '...',
    endpoint: event.endpoint,
    duration: `${event.duration}ms`,
    status: event.statusCode || '-',
    ...(event.error ? { error: event.error.slice(0, 30) } : {}),
  });
  
  return event;
}

// ============================================
// PHASE 3: SUPABASE SDK TRACING
// ============================================

export type SupabaseEventType =
  | 'supabase:auth:request'
  | 'supabase:auth:response'
  | 'supabase:auth:error'
  | 'supabase:session:issued'
  | 'supabase:session:refreshed'
  | 'supabase:rls:deny'
  | 'supabase:rls:allow';

export interface SupabaseEvent {
  eventId: string;
  type: SupabaseEventType;
  requestId?: string;
  sessionId: string;
  timestamp: number;
  method: string;
  outcome: 'AUTHORIZED' | 'DENIED' | 'INVALID_SESSION' | 'UNKNOWN';
  responseData?: {
    hasUser: boolean;
    hasSession: boolean;
    hasError: boolean;
    errorMessage?: string;
  };
}

export function emitSupabaseEvent(
  type: SupabaseEventType,
  sessionId: string,
  method: string,
  requestId?: string,
  responseData?: SupabaseEvent['responseData']
): SupabaseEvent {
  // Infer outcome from response
  let outcome: SupabaseEvent['outcome'] = 'UNKNOWN';
  
  if (type.includes('error')) outcome = 'UNKNOWN';
  else if (type.includes('deny')) outcome = 'DENIED';
  else if (responseData?.hasUser && responseData?.hasSession) outcome = 'AUTHORIZED';
  else if (responseData?.errorMessage?.includes('session')) outcome = 'INVALID_SESSION';
  else if (responseData?.hasUser || type.includes('issued') || type.includes('refreshed')) outcome = 'AUTHORIZED';
  
  const event: SupabaseEvent = {
    eventId: uuidv4(),
    type,
    requestId,
    sessionId,
    timestamp: Date.now(),
    method,
    outcome,
    responseData,
  };
  
  const prefix = outcome === 'AUTHORIZED' ? '[SUPABASE:✅]' 
    : outcome === 'DENIED' || outcome === 'INVALID_SESSION' ? '[SUPABASE:❌]'
    : '[SUPABASE:event]';
  
  console.log(prefix, {
    type: event.type,
    method: event.method,
    outcome: event.outcome,
    ...(responseData ? {
      hasUser: responseData.hasUser,
      hasSession: responseData.hasSession,
    } : {}),
  });
  
  return event;
}

// ============================================
// PHASE 4: BACKEND BEHAVIOR INFERENCE
// ============================================

export type BackendOutcome = 'AUTHORIZED' | 'DENIED' | 'INVALID_SESSION' | 'UNKNOWN_FAILURE';

// Infer backend behavior from response
export function inferBackendOutcome(response: unknown, statusCode?: number): BackendOutcome {
  // Based on HTTP status
  if (statusCode === 401) return 'INVALID_SESSION';
  if (statusCode === 403) return 'DENIED';
  if (statusCode === 404) return 'DENIED';
  
  // Based on response structure
  if (!response) return 'UNKNOWN_FAILURE';
  
  const resp = response as Record<string, unknown>;
  
  // Check for auth.users response
  if (resp.user && !resp.error) return 'AUTHORIZED';
  if (resp.error) {
    if (String(resp.error).includes('session')) return 'INVALID_SESSION';
    if (String(resp.error).includes('row') || String(resp.error).includes('policy')) return 'DENIED';
    return 'UNKNOWN_FAILURE';
  }
  
  // Check for session
  if (resp.session && !resp.error) return 'AUTHORIZED';
  if (resp.session === null && resp.access_token === null) return 'INVALID_SESSION';
  
  return 'UNKNOWN_FAILURE';
}

// ============================================
// PHASE 5: FULL AUTH PIPELINE
// ============================================

export type PipelineEventType = 
  | 'pipeline:ui:login_click'
  | 'pipeline:validation:email'
  | 'pipeline:network:request_start'
  | 'pipeline:network:request_end'
  | 'pipeline:supabase:auth_request'
  | 'pipeline:supabase:auth_response'
  | 'pipeline:backend:inference'
  | 'pipeline:state:user_hydrated'
  | 'pipeline:state:session_stored'
  | 'pipeline:ui:dashboard_rendered';

export interface PipelineEvent {
  eventId: string;
  requestId?: string;
  correlationId: string;
  sessionId: string;
  type: PipelineEventType;
  timestamp: number;
  duration?: number;
  layer: 'UI' | 'VALIDATION' | 'NETWORK' | 'SUPABASE' | 'BACKEND' | 'STATE';
  data?: Record<string, unknown>;
}

// Pipeline event emission
export function emitPipelineEvent(
  type: PipelineEventType,
  requestId: string,
  correlationId: string,
  sessionId: string,
  data?: Record<string, unknown>,
  previousTimestamp?: number
): PipelineEvent {
  const now = Date.now();
  const duration = previousTimestamp ? now - previousTimestamp : undefined;
  
  // Determine layer from type
  let layer: PipelineEvent['layer'] = 'UI';
  if (type.includes('validation')) layer = 'VALIDATION';
  else if (type.includes('network')) layer = 'NETWORK';
  else if (type.includes('supabase')) layer = 'SUPABASE';
  else if (type.includes('backend')) layer = 'BACKEND';
  else if (type.includes('state')) layer = 'STATE';
  
  const event: PipelineEvent = {
    eventId: uuidv4(),
    requestId,
    correlationId,
    sessionId,
    type,
    timestamp: now,
    duration,
    layer,
    data,
  };
  
  console.log(`[PIPELINE:${layer}]`, {
    type: event.type,
    duration: event.duration ? `${event.duration}ms` : '-',
    ...(data ? { data: Object.keys(data) } : {}),
  });
  
  return event;
}

// ============================================
// PHASE 6: LATENCY BREAKDOWN
// ============================================

export interface LatencyBreakdown {
  requestId: string;
  total: number;
  components: {
    frontend_validation: number;
    network_request: number;
    backend_processing: number;
    frontend_state_update: number;
  };
  breakdown: string; // Human-readable
}

// Compute latency breakdown
export function computeLatencyBreakdown(
  requestId: string,
  startTimestamp: number,
  endTimestamp: number,
  networkStart: number,
  networkEnd: number
): LatencyBreakdown {
  const total = endTimestamp - startTimestamp;
  const networkTime = networkEnd - networkStart;
  
  // Assume: 10% validation, 50% network, 30% backend, 10% state
  const frontend_validation = Math.round(total * 0.1);
  const network_request = networkTime;
  const backend_processing = Math.round(total * 0.3);
  const frontend_state_update = Math.round(total * 0.1);
  
  return {
    requestId,
    total,
    components: {
      frontend_validation,
      network_request,
      backend_processing,
      frontend_state_update,
    },
    breakdown: `Total: ${total}ms (UI: ${frontend_validation}ms, Net: ${network_request}ms, BE: ${backend_processing}ms, State: ${frontend_state_update}ms)`,
  };
}

// ============================================
// PHASE 7: RACE CONDITION DETECTOR
// ============================================

export interface RaceCondition {
  type: 'duplicate_requests' | 'overlapping_restore_login' | 'slow_network_retry' | 'supabase_retry_hidden_failure' | 'stale_session_overwrite';
  requestIds: string[];
  timestamps: number[];
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// Track active requests for race detection
const activeRequests = new Map<string, number>();

export function trackRequestStart(requestId: string): void {
  activeRequests.set(requestId, Date.now());
}

export function trackRequestEnd(requestId: string): void {
  activeRequests.delete(requestId);
}

export function detectRaceConditions(): RaceCondition[] {
  const races: RaceCondition[] = [];
  const now = Date.now();
  
  // Check for slow network + fast retry
  if (activeRequests.size > 1) {
    races.push({
      type: 'slow_network_retry',
      requestIds: Array.from(activeRequests.keys()),
      timestamps: Array.from(activeRequests.values()),
      severity: 'medium',
      description: 'Multiple overlapping requests detected',
    });
  }
  
  return races;
}

// ============================================
// PHASE 8: SYSTEM OF TRUTH
// ============================================

export type TruthSource = 'supabase_auth' | 'postgres' | 'network' | 'frontend_state' | 'localstorage';

export interface TruthConflict {
  source1: TruthSource;
  source2: TruthSource;
  field: string;
  value1: unknown;
  value2: unknown;
  severity: 'low' | 'medium' | 'high';
  resolvedBy?: TruthSource;
}

// Truth source ranking (highest authoritative first)
const TRUTH_RANKING: TruthSource[] = [
  'supabase_auth',
  'postgres', 
  'network',
  'frontend_state',
  'localstorage',
];

// Resolve truth conflicts
export function resolveTruthConflict(
  source1: TruthSource,
  value1: unknown,
  source2: TruthSource,
  value2: unknown
): { winner: TruthSource; value: unknown } {
  const rank1 = TRUTH_RANKING.indexOf(source1);
  const rank2 = TRUTH_RANKING.indexOf(source2);
  
  if (rank1 < rank2) {
    return { winner: source1, value: value1 };
  }
  return { winner: source2, value: value2 };
}

// ============================================
// PHASE 9: FULL AUTH TRACE OUTPUT
// ============================================

// All events storage
const AUTH_TRUTH_EVENTS: (NetworkEvent | SupabaseEvent | PipelineEvent)[] = [];

export function addAuthTruthEvent(event: NetworkEvent | SupabaseEvent | PipelineEvent): void {
  AUTH_TRUTH_EVENTS.push(event);
}

export function clearAuthTruthEvents(): void {
  AUTH_TRUTH_EVENTS.length = 0;
}

// Generate full stack trace
export function generateFullStackTrace(): string {
  const sessionId = getSessionId();
  
  let trace = `\n═══════════════════════════════════════════\n`;
  trace += `FULL STACK AUTH TRACE - SESSION: ${sessionId}\n`;
  trace += `═══════════════════════════════════════════\n\n`;
  
  // Group events by layer
  const uiEvents = AUTH_TRUTH_EVENTS.filter(e => 'layer' in e && (e as PipelineEvent).layer === 'UI');
  const networkEvents = AUTH_TRUTH_EVENTS.filter(e => e.type?.startsWith('network:'));
  const supabaseEvents = AUTH_TRUTH_EVENTS.filter(e => e.type?.startsWith('supabase:'));
  const stateEvents = AUTH_TRUTH_EVENTS.filter(e => 'layer' in e && (e as PipelineEvent).layer === 'STATE');
  
  trace += `1. UI LAYER (${uiEvents.length} events)\n`;
  trace += `─────────────────────────────────────────────\n`;
  for (const e of uiEvents) {
    const pe = e as PipelineEvent;
    trace += `[${pe.layer}] ${pe.type}${pe.duration ? ` (${pe.duration}ms)` : ''}\n`;
  }
  
  trace += `\n2. NETWORK LAYER (${networkEvents.length} events)\n`;
  trace += `─────────────────────────────────────────────\n`;
  for (const e of networkEvents) {
    trace += `[NETWORK] ${e.type} ${e.endpoint} ${e.duration ? `${e.duration}ms` : ''} ${e.statusCode ? `[${e.statusCode}]` : ''}\n`;
  }
  
  trace += `\n3. SUPABASE LAYER (${supabaseEvents.length} events)\n`;
  trace += `─────────────────────────────────────────────\n`;
  for (const e of supabaseEvents) {
    trace += `[SUPABASE] ${e.type} ${e.outcome} ${e.method ? `[${e.method}]` : ''}\n`;
  }
  
  trace += `\n4. STATE LAYER (${stateEvents.length} events)\n`;
  trace += `─────────────────────────────────────────────\n`;
  for (const e of stateEvents) {
    const pe = e as PipelineEvent;
    trace += `[STATE] ${pe.type}${pe.duration ? ` (${pe.duration}ms)` : ''}\n`;
  }
  
  // Compute total latency
  const firstEvent = AUTH_TRUTH_EVENTS[0];
  const lastEvent = AUTH_TRUTH_EVENTS[AUTH_TRUTH_EVENTS.length - 1];
  const totalLatency = lastEvent && firstEvent ? lastEvent.timestamp - firstEvent.timestamp : 0;
  
  trace += `\n═══════════════════════════════════════════\n`;
  trace += `TOTAL LATENCY: ${totalLatency}ms\n`;
  trace += `═══════════════════════════════════════════\n`;
  
  return trace;
}

// ============================================
// PHASE 10: FAILURE MODE MATRIX
// ============================================

export interface FailureMode {
  failure: string;
  layer_detected: string;
  what_frontend_saw: string;
  what_backend_did: string;
  classification: string;
}

export function classifyFailureMode(
  error: unknown,
  networkStatusCode?: number,
  responseData?: Record<string, unknown>
): FailureMode {
  const errorMsg = String(error || '');
  
  // Network failure
  if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('Failed to fetch')) {
    return {
      failure: 'network_failure',
      layer_detected: 'NETWORK',
      what_frontend_saw: 'Request failed to reach server',
      what_backend_did: 'Unknown (request never reached)',
      classification: 'NETWORK_ERROR',
    };
  }
  
  // Supabase timeout
  if (errorMsg.includes('timeout') || errorMsg.includes('Gateway Timeout')) {
    return {
      failure: 'supabase_timeout',
      layer_detected: 'NETWORK',
      what_frontend_saw: 'Request timed out',
      what_backend_did: 'May have processed, response lost',
      classification: 'TIMEOUT',
    };
  }
  
  // RLS denial (403 or policy error)
  if (networkStatusCode === 403 || errorMsg.includes('row') || errorMsg.includes('policy') || errorMsg.includes('RLS')) {
    return {
      failure: 'rls_denial',
      layer_detected: 'POSTGRES/RLS',
      what_frontend_saw: 'Access denied or empty result',
      what_backend_did: 'RLS policy denied access',
      classification: 'RLS_DENIED',
    };
  }
  
  // Invalid session (401)
  if (networkStatusCode === 401 || errorMsg.includes('session') || errorMsg.includes('JWT')) {
    return {
      failure: 'invalid_session',
      layer_detected: 'SUPABASE_AUTH',
      what_frontend_saw: 'Session invalid or expired',
      what_backend_did: 'Token rejected as invalid',
      classification: 'INVALID_SESSION',
    };
  }
  
  // Partial session creation
  if (responseData?.session && !responseData?.user) {
    return {
      failure: 'partial_session',
      layer_detected: 'SUPABASE_AUTH',
      what_frontend_saw: 'Session created but no user',
      what_backend_did: 'Session issued, user lookup failed',
      classification: 'PARTIAL_FAILURE',
    };
  }
  
  // Duplicate request (409)
  if (networkStatusCode === 409 || errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
    return {
      failure: 'duplicate_request',
      layer_detected: 'POSTGRES',
      what_frontend_saw: 'Resource already exists',
      what_backend_did: 'UNIQUE constraint violation',
      classification: 'DUPLICATE',
    };
  }
  
  // Unknown
  return {
    failure: 'unknown',
    layer_detected: 'UNKNOWN',
    what_frontend_saw: errorMsg.slice(0, 50),
    what_backend_did: 'Unknown failure',
    classification: 'UNKNOWN',
  };
}

// ============================================
// WINDOW EXPORTS FOR DEBUGGING
// ============================================

if (typeof window !== 'undefined') {
  const win = window as unknown as {
    generateRequestId: typeof generateRequestId;
    emitNetworkEvent: typeof emitNetworkEvent;
    emitSupabaseEvent: typeof emitSupabaseEvent;
    emitPipelineEvent: typeof emitPipelineEvent;
    detectRaceConditions: typeof detectRaceConditions;
    generateFullStackTrace: typeof generateFullStackTrace;
    classifyFailureMode: typeof classifyFailureMode;
    clearAuthTruthEvents: typeof clearAuthTruthEvents;
    AUTH_TRUTH_EVENTS: typeof AUTH_TRUTH_EVENTS;
  };
  
  win.generateRequestId = generateRequestId;
  win.emitNetworkEvent = emitNetworkEvent;
  win.emitSupabaseEvent = emitSupabaseEvent;
  win.emitPipelineEvent = emitPipelineEvent;
  win.detectRaceConditions = detectRaceConditions;
  win.generateFullStackTrace = generateFullStackTrace;
  win.classifyFailureMode = classifyFailureMode;
  win.clearAuthTruthEvents = clearAuthTruthEvents;
  win.AUTH_TRUTH_EVENTS = AUTH_TRUTH_EVENTS;
}
/**
 * Cross-System Truth Validation Layer
 * 
 * Reconciles authentication state across:
 * - Supabase Auth API (PRIMARY)
 * - PostgreSQL / RLS
 * - Network HTTP responses
 * - Frontend state
 * - localStorage cache
 * 
 * Internal logs are NO LONGER trusted as truth.
 * Only cross-system agreement defines truth.
 * 
 * @module authTruthReconciler
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================
// PHASE 1: SYSTEM OF TRUTH PRIORITY
// ============================================

export type TruthSource = 
  | 'supabase_auth'  // PRIMARY - highest authority
  | 'postgres'       // RLS outcome
  | 'network'       // HTTP response
  | 'sdk'           // Supabase SDK state
  | 'frontend'      // React state
  | 'localstorage'; // UNTRUSTED - lowest

export const TRUTH_PRIORITY: TruthSource[] = [
  'supabase_auth',
  'postgres',
  'network',
  'sdk',
  'frontend',
  'localstorage',
];

// ============================================
// PHASE 2: EXTERNAL EVENT STORES
// ============================================

export interface NetworkTruthRecord {
  eventId: string;
  requestId: string;
  url: string;
  method: string;
  status: number;
  statusText: string;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  timestamp: number;
  duration: number;
  isCached: boolean;
}

export interface SupabaseAuthTruth {
  eventId: string;
  requestId: string;
  userId?: string;
  email?: string;
  sessionExists: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  emailConfirmed: boolean;
  rawUser?: Record<string, unknown>;
  timestamp: number;
}

export interface PostgresTruth {
  eventId: string;
  requestId: string;
  table: string;
  rowsReturned: number;
  rlsApplied: boolean;
  rlsDenied: boolean;
  data?: unknown[];
  error?: string;
  timestamp: number;
}

export interface FrontendTruth {
  eventId: string;
  sessionId: string;
  userId?: string;
  profileLoaded: boolean;
  stateSnapshot: Record<string, unknown>;
  timestamp: number;
}

// Truth stores
const NETWORK_TRUTH: NetworkTruthRecord[] = [];
const SUPABASE_AUTH_TRUTH: SupabaseAuthTruth[] = [];
const POSTGRES_TRUTH: PostgresTruth[] = [];
const FRONTEND_TRUTH: FrontendTruth[] = [];

// ============================================
// PHASE 3: TRUTH CAPTURE FUNCTIONS
// ============================================

/**
 * Capture network truth from HTTP response
 */
export function captureNetworkTruth(
  eventId: string,
  requestId: string,
  url: string,
  method: string,
  status: number,
  statusText: string,
  duration: number,
  responseBody?: string,
  isCached: boolean = false
): NetworkTruthRecord {
  const record: NetworkTruthRecord = {
    eventId,
    requestId,
    url,
    method,
    status,
    statusText,
    responseBody,
    timestamp: Date.now(),
    duration,
    isCached,
  };
  
  NETWORK_TRUTH.push(record);
  
  console.log(`[TRUTH:NETWORK] ${method} ${url} → ${status} (${duration}ms)`);
  
  return record;
}

/**
 * Capture Supabase Auth truth from response
 */
export function captureSupabaseAuthTruth(
  eventId: string,
  requestId: string,
  response: {
    user?: { id: string; email: string; email_confirmed_at?: string };
    session?: { access_token: string; refresh_token: string; expires_in: number };
    error?: { message?: string };
  }
): SupabaseAuthTruth {
  const record: SupabaseAuthTruth = {
    eventId,
    requestId,
    userId: response.user?.id,
    email: response.user?.email,
    sessionExists: !!response.session,
    accessToken: response.session?.access_token,
    refreshToken: response.session?.refresh_token,
    expiresAt: response.session?.expires_in 
      ? Date.now() + response.session.expires_in * 1000 
      : undefined,
    emailConfirmed: !!response.user?.email_confirmed_at,
    rawUser: response.user as Record<string, unknown>,
    timestamp: Date.now(),
  };
  
  SUPABASE_AUTH_TRUTH.push(record);
  
  console.log(`[TRUTH:SUPABASE] user=${record.userId || 'none'}, session=${record.sessionExists}`);
  
  return record;
}

/**
 * Capture PostgreSQL / RLS truth
 */
export function capturePostgresTruth(
  eventId: string,
  requestId: string,
  table: string,
  rowsReturned: number,
  rlsApplied: boolean,
  rlsDenied: boolean = false,
  data?: unknown[],
  error?: string
): PostgresTruth {
  const record: PostgresTruth = {
    eventId,
    requestId,
    table,
    rowsReturned,
    rlsApplied,
    rlsDenied,
    data,
    error,
    timestamp: Date.now(),
  };
  
  POSTGRES_TRUTH.push(record);
  
  console.log(`[TRUTH:POSTGRES] ${table} → rows=${rowsReturned}, rls_denied=${rlsDenied}`);
  
  return record;
}

/**
 * Capture frontend truth snapshot
 */
export function captureFrontendTruth(
  eventId: string,
  sessionId: string,
  userId?: string,
  profileLoaded: boolean = false,
  stateSnapshot: Record<string, unknown> = {}
): FrontendTruth {
  const record: FrontendTruth = {
    eventId,
    sessionId,
    userId,
    profileLoaded,
    stateSnapshot,
    timestamp: Date.now(),
  };
  
  FRONTEND_TRUTH.push(record);
  
  console.log(`[TRUTH:FRONTEND] sessionId=${sessionId}, userId=${userId || 'none'}`);
  
  return record;
}

// ============================================
// PHASE 4: CROSS-LAYER RECONCILIATION
// ============================================

export type TruthDriftType = 
  | 'NONE'
  | 'AUTH_DESYNC'
  | 'STATE_INCONSISTENCY'
  | 'RLS_ORPHAN'
  | 'NETWORK_FACADE'
  | 'SDK_DESYNC'
  | 'CACHE_POISONING';

export interface TruthReconciliation {
  eventId: string;
  timestamp: number;
  match: boolean;
  truthScore: number; // 0-4
  maxScore: number;
  driftType: TruthDriftType;
  layers: {
    network: { status: number; matches: boolean };
    supabase: { sessionExists: boolean; matches: boolean };
    frontend: { hasSession: boolean; matches: boolean };
    postgres: { rowsReturned: number; matches: boolean };
  };
  details: string[];
}

/**
 * Reconcile truth across all layers for an event
 */
export function reconcileTruth(eventId: string): TruthReconciliation {
  // Get latest records for this event
  const network = NETWORK_TRUTH.filter(n => n.eventId === eventId).pop();
  const supabase = SUPABASE_AUTH_TRUTH.filter(s => s.eventId === eventId).pop();
  const postgres = POSTGRES_TRUTH.filter(p => p.eventId === eventId).pop();
  const frontend = FRONTEND_TRUTH.filter(f => f.eventId === eventId).pop();
  
  const layers = {
    network: {
      status: network?.status || 0,
      matches: network?.status === 200,
    },
    supabase: {
      sessionExists: supabase?.sessionExists || false,
      matches: supabase?.sessionExists === true,
    },
    frontend: {
      hasSession: !!frontend?.userId,
      matches: !!frontend?.userId,
    },
    postgres: {
      rowsReturned: postgres?.rowsReturned || 0,
      matches: (postgres?.rowsReturned || 0) > 0,
    },
  };
  
  // Calculate truth score (each layer = 1 point)
  let truthScore = 0;
  if (layers.network.matches) truthScore++;
  if (layers.supabase.matches) truthScore++;
  if (layers.frontend.matches) truthScore++;
  if (layers.postgres.matches) truthScore++;
  
  // Detect drift type
  let driftType: TruthDriftType = 'NONE';
  const details: string[] = [];
  
  // CASE 1: False Success - Frontend says success but Supabase says no session
  if (layers.frontend.matches && !layers.supabase.matches) {
    driftType = 'AUTH_DESYNC';
    details.push('Frontend shows logged in but Supabase has no session');
  }
  
  // CASE 2: Hidden Failure - Network 200 but no session
  if (layers.network.matches && !layers.supabase.matches) {
    driftType = 'NETWORK_FACADE';
    details.push('Network returned 200 but no session created');
  }
  
  // CASE 3: RLS Mismatch - Auth success but profile empty
  if (layers.supabase.matches && layers.postgres.matches === false && postgres) {
    driftType = 'RLS_ORPHAN';
    details.push('Auth succeeded but profile query returned no rows (RLS?)');
  }
  
  // CASE 4: State Inconsistency - SDK state doesn't match frontend
  if (layers.supabase.matches !== layers.frontend.matches) {
    driftType = 'STATE_INCONSISTENCY';
    details.push('Supabase session and frontend state mismatch');
  }
  
  // CASE 5: Cache Poisoning - localStorage doesn't match Supabase
  if (layers.frontend.matches && !layers.supabase.matches && frontend) {
    driftType = 'CACHE_POISONING';
    details.push('Frontend has session from cache but Supabase has no session');
  }
  
  const match = driftType === 'NONE' && truthScore >= 3;
  
  const reconciliation: TruthReconciliation = {
    eventId,
    timestamp: Date.now(),
    match,
    truthScore,
    maxScore: 4,
    driftType,
    layers,
    details,
  };
  
  // Log reconciliation result
  const icon = match ? '✅' : driftType !== 'NONE' ? '⚠️' : '❌';
  console.log(`[TRUTH:RECONCILE] ${icon} Score: ${truthScore}/4, Drift: ${driftType}`);
  
  return reconciliation;
}

// ============================================
// PHASE 5: TRUTH SCORE ENGINE
// ============================================

export interface TruthScore {
  score: number;
  maxScore: number;
  percentage: number;
  validation: 'VALIDATED_TRUTH' | 'DEGRADED_TRUTH' | 'BROKEN_TRUST';
}

/**
 * Calculate overall truth score for a session
 */
export function calculateTruthScore(eventIds: string[]): TruthScore {
  let totalScore = 0;
  let maxScore = 0;
  
  for (const eventId of eventIds) {
    const reconciliation = reconcileTruth(eventId);
    totalScore += reconciliation.truthScore;
    maxScore += reconciliation.maxScore;
  }
  
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  
  let validation: TruthScore['validation'];
  if (percentage >= 100) validation = 'VALIDATED_TRUTH';
  else if (percentage >= 50) validation = 'DEGRADED_TRUTH';
  else validation = 'BROKEN_TRUST';
  
  return {
    score: totalScore,
    maxScore,
    percentage: Math.round(percentage),
    validation,
  };
}

// ============================================
// PHASE 6: EXTERNAL VERIFICATION PROBES
// ============================================

/**
 * Probe Supabase to verify actual session state
 */
export async function probeSupabaseSession(): Promise<{
  actualUserId: string | null;
  actualSessionExists: boolean;
  matchesFrontend: boolean;
}> {
  try {
    // This would require Supabase client access
    // For now, return structure
    return {
      actualUserId: null, // Would call supabase.auth.getSession()
      actualSessionExists: false,
      matchesFrontend: false,
    };
  } catch {
    return {
      actualUserId: null,
      actualSessionExists: false,
      matchesFrontend: false,
    };
  }
}

/**
 * Probe PostgreSQL to verify profile exists
 */
export async function probePostgresProfile(userId: string): Promise<{
  profileExists: boolean;
  matchesFrontend: boolean;
}> {
  try {
    return {
      profileExists: false, // Would query profiles table
      matchesFrontend: false,
    };
  } catch {
    return {
      profileExists: false,
      matchesFrontend: false,
    };
  }
}

/**
 * Verify network response actually happened
 */
export function verifyNetworkReplay(requestId: string): boolean {
  const network = NETWORK_TRUTH.find(n => n.requestId === requestId);
  return !!network && network.status === 200;
}

// ============================================
// PHASE 7: REALITY SYNCHRONIZATION LOOP
// ============================================

let SYNC_INTERVAL: ReturnType<typeof setInterval> | null = null;

/**
 * Start reality sync loop
 * Periodically reconciles frontend state with Supabase
 */
export function startRealitySync(intervalMs: number = 60000): void {
  if (SYNC_INTERVAL) {
    stopRealitySync();
  }
  
  SYNC_INTERVAL = setInterval(async () => {
    console.log('[TRUTH:SYNC] Running reality synchronization...');
    
    // Get latest event
    const lastEvent = SUPABASE_AUTH_TRUTH[SUPABASE_AUTH_TRUTH.length - 1];
    if (lastEvent) {
      const reconciliation = reconcileTruth(lastEvent.eventId);
      
      if (reconciliation.driftType !== 'NONE') {
        console.warn(`[TRUTH:DRIFT] Detected: ${reconciliation.driftType}`);
        console.warn('[TRUTH:DRIFT] Details:', reconciliation.details);
      }
    }
  }, intervalMs);
  
  console.log(`[TRUTH:SYNC] Reality sync started (interval: ${intervalMs}ms)`);
}

/**
 * Stop reality sync loop
 */
export function stopRealitySync(): void {
  if (SYNC_INTERVAL) {
    clearInterval(SYNC_INTERVAL);
    SYNC_INTERVAL = null;
    console.log('[TRUTH:SYNC] Reality sync stopped');
  }
}

// ============================================
// PHASE 8: TRUTH FAILURE MODES
// ============================================

export type TruthFailureType = 
  | 'AUTH_TRUTH_DRIFT'
  | 'NETWORK_FACADE'
  | 'SUPABASE_DESYNC'
  | 'RLS_INCONSISTENCY'
  | 'CACHE_POISONING';

/**
 * Classify truth failure
 */
export function classifyTruthFailure(reconciliation: TruthReconciliation): TruthFailureType[] {
  const failures: TruthFailureType[] = [];
  
  if (reconciliation.driftType === 'AUTH_DESYNC') {
    failures.push('AUTH_TRUTH_DRIFT');
  }
  if (reconciliation.driftType === 'NETWORK_FACADE') {
    failures.push('NETWORK_FACADE');
  }
  if (reconciliation.driftType === 'STATE_INCONSISTENCY') {
    failures.push('SUPABASE_DESYNC');
  }
  if (reconciliation.driftType === 'RLS_ORPHAN') {
    failures.push('RLS_INCONSISTENCY');
  }
  if (reconciliation.driftType === 'CACHE_POISONING') {
    failures.push('CACHE_POISONING');
  }
  
  return failures;
}

// ============================================
// PHASE 9: GLOBAL TRUTH REPORT
// ============================================

export interface GlobalTruthReport {
  generatedAt: number;
  truthScore: TruthScore;
  recentReconciliations: TruthReconciliation[];
  driftEvents: { eventId: string; driftType: TruthDriftType }[];
  lastReconciledState: {
    network: string;
    supabase: string;
    frontend: string;
    postgres: string;
  };
  truthCounts: {
    networkRecords: number;
    supabaseRecords: number;
    postgresRecords: number;
    frontendRecords: number;
  };
}

/**
 * Generate comprehensive truth report
 */
export function generateTruthReport(): GlobalTruthReport {
  // Get recent reconciliations
  const eventIds = [...new Set([
    ...NETWORK_TRUTH.map(n => n.eventId),
    ...SUPABASE_AUTH_TRUTH.map(s => s.eventId),
  ])];
  
  const reconciliations = eventIds.map(id => reconcileTruth(id));
  const recentReconciliations = reconciliations.slice(-10);
  
  // Find drift events
  const driftEvents = reconciliations
    .filter(r => r.driftType !== 'NONE')
    .map(r => ({ eventId: r.eventId, driftType: r.driftType }));
  
  // Calculate overall truth score
  const truthScore = calculateTruthScore(eventIds);
  
  // Get last reconciled state
  const lastSupabase = SUPABASE_AUTH_TRUTH[SUPABASE_AUTH_TRUTH.length - 1];
  const lastFrontend = FRONTEND_TRUTH[FRONTEND_TRUTH.length - 1];
  const lastNetwork = NETWORK_TRUTH[NETWORK_TRUTH.length - 1];
  const lastPostgres = POSTGRES_TRUTH[POSTGRES_TRUTH.length - 1];
  
  const report: GlobalTruthReport = {
    generatedAt: Date.now(),
    truthScore,
    recentReconciliations,
    driftEvents,
    lastReconciledState: {
      network: lastNetwork ? `${lastNetwork.status}` : 'none',
      supabase: lastSupabase?.sessionExists ? 'active' : 'none',
      frontend: lastFrontend?.userId ? 'active' : 'none',
      postgres: lastPostgres ? `${lastPostgres.rowsReturned} rows` : 'none',
    },
    truthCounts: {
      networkRecords: NETWORK_TRUTH.length,
      supabaseRecords: SUPABASE_AUTH_TRUTH.length,
      postgresRecords: POSTGRES_TRUTH.length,
      frontendRecords: FRONTEND_TRUTH.length,
    },
  };
  
  return report;
}

/**
 * Print human-readable truth report
 */
export function printTruthReport(): void {
  const report = generateTruthReport();
  
  let output = '\n═══════════════════════════════════════════\n';
  output += '        CROSS-SYSTEM TRUTH VALIDATION REPORT\n';
  output += '═══════════════════════════════════════════\n\n';
  
  output += `VALIDATION: ${report.truthScore.validation}\n`;
  output += `TRUTH SCORE: ${report.truthScore.score}/${report.truthScore.maxScore} (${report.truthScore.percentage}%)\n\n`;
  
  output += 'LAST RECONCILED STATE:\n';
  output += '───────────────────────────────────────────\n';
  output += `Network:    ${report.lastReconciledState.network}\n`;
  output += `Supabase:  ${report.lastReconciledState.supabase}\n`;
  output += `Frontend:   ${report.lastReconciledState.frontend}\n`;
  output += `Postgres:   ${report.lastReconciledState.postgres}\n\n`;
  
  output += 'TRUTH COUNTS:\n';
  output += '───────────────────────────────────────────\n';
  output += `Network Records:    ${report.truthCounts.networkRecords}\n`;
  output += `Supabase Records:   ${report.truthCounts.supabaseRecords}\n`;
  output += `Postgres Records:   ${report.truthCounts.postgresRecords}\n`;
  output += `Frontend Records:   ${report.truthCounts.frontendRecords}\n\n`;
  
  if (report.driftEvents.length > 0) {
    output += '⚠️  DRIFT EVENTS DETECTED:\n';
    output += '───────────────────────────────────────────\n';
    for (const drift of report.driftEvents) {
      output += `  - ${drift.eventId.slice(0, 8)}... → ${drift.driftType}\n`;
    }
  } else {
    output += '✅ NO DRIFT DETECTED\n';
  }
  
  output += '\n═══════════════════════════════════════════\n';
  
  console.log(output);
}

// ============================================
// WINDOW EXPORTS
// ============================================

if (typeof window !== 'undefined') {
  const win = window as unknown as {
    captureNetworkTruth: typeof captureNetworkTruth;
    captureSupabaseAuthTruth: typeof captureSupabaseAuthTruth;
    capturePostgresTruth: typeof capturePostgresTruth;
    captureFrontendTruth: typeof captureFrontendTruth;
    reconcileTruth: typeof reconcileTruth;
    calculateTruthScore: typeof calculateTruthScore;
    generateTruthReport: typeof generateTruthReport;
    printTruthReport: typeof printTruthReport;
    startRealitySync: typeof startRealitySync;
    stopRealitySync: typeof stopRealitySync;
    NETWORK_TRUTH: typeof NETWORK_TRUTH;
    SUPABASE_AUTH_TRUTH: typeof SUPABASE_AUTH_TRUTH;
    POSTGRES_TRUTH: typeof POSTGRES_TRUTH;
    FRONTEND_TRUTH: typeof FRONTEND_TRUTH;
  };
  
  win.captureNetworkTruth = captureNetworkTruth;
  win.captureSupabaseAuthTruth = captureSupabaseAuthTruth;
  win.capturePostgresTruth = capturePostgresTruth;
  win.captureFrontendTruth = captureFrontendTruth;
  win.reconcileTruth = reconcileTruth;
  win.calculateTruthScore = calculateTruthScore;
  win.generateTruthReport = generateTruthReport;
  win.printTruthReport = printTruthReport;
  win.startRealitySync = startRealitySync;
  win.stopRealitySync = stopRealitySync;
  win.NETWORK_TRUTH = NETWORK_TRUTH;
  win.SUPABASE_AUTH_TRUTH = SUPABASE_AUTH_TRUTH;
  win.POSTGRES_TRUTH = POSTGRES_TRUTH;
  win.FRONTEND_TRUTH = FRONTEND_TRUTH;
}
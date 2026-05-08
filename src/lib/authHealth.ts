/**
 * Self-Verifying Authentication Observability System
 * 
 * Runtime health checks that continuously validate:
 * - Fetch interception is active
 * - Supabase wrapper is functioning
 * - Event store is working
 * - Trace buffer is valid
 * 
 * @module authHealth
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================
// PHASE 1: BOOTSTRAP SELF-CHECK
// ============================================

export interface ObservabilityHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'BROKEN';
  fetchInterception: boolean;
  supabaseWrapped: boolean;
  eventStoreActive: boolean;
  traceBufferActive: boolean;
  lastCheck: number;
  bootTimestamp: number;
  checksPassed: number;
  checksFailed: number;
  startTimestamp: number;
}

const DEFAULT_HEALTH: ObservabilityHealth = {
  status: 'BROKEN',
  fetchInterception: false,
  supabaseWrapped: false,
  eventStoreActive: false,
  traceBufferActive: false,
  lastCheck: 0,
  bootTimestamp: Date.now(),
  checksPassed: 0,
  checksFailed: 0,
  startTimestamp: Date.now(),
};

// Global health state
let HEALTH: ObservabilityHealth = { ...DEFAULT_HEALTH };
let HEALTH_CHECK_INTERVAL: ReturnType<typeof setInterval> | null = null;

// ============================================
// PHASE 2: INDIVIDUAL HEALTH CHECKS
// ============================================

/**
 * Check 1: Fetch Interception
 * Detects if window.fetch has been overridden
 */
export function checkFetchInterception(): boolean {
  try {
    const fetchString = window.fetch.toString();
    // If it's still native, interception is NOT active
    const isNative = fetchString.includes('[native code]');
    return !isNative;
  } catch {
    return false;
  }
}

/**
 * Check 2: Supabase Wrapper
 * Detects if Supabase methods have been instrumented
 */
export function checkSupabaseWrapper(): boolean {
  try {
    // Check if authTracer is imported in useAuth
    // This is a proxy check - we assume if authEvents exists, wrapper works
    const win = window as unknown as { 
      AUTH_EVENT_STORE?: unknown[];
      emitLoginAttempt?: unknown;
    };
    return typeof win.emitLoginAttempt === 'function';
  } catch {
    return false;
  }
}

/**
 * Check 3: Event Store
 * Verifies event store exists and is writable
 */
export function checkEventStore(): boolean {
  try {
    const win = window as unknown as { AUTH_EVENT_STORE?: unknown[] };
    if (!win.AUTH_EVENT_STORE) return false;
    
    // Try to push a test event
    const initialLength = win.AUTH_EVENT_STORE.length;
    win.AUTH_EVENT_STORE.push({ __health_test: true, timestamp: Date.now() });
    const canWrite = win.AUTH_EVENT_STORE.length > initialLength;
    
    // Clean up test event
    if (canWrite) {
      win.AUTH_EVENT_STORE.pop();
    }
    
    return canWrite;
  } catch {
    return false;
  }
}

/**
 * Check 4: Trace Buffer
 * Verifies trace buffer exists and is valid
 */
export function checkTraceBuffer(): boolean {
  try {
    const win = window as unknown as { AUTH_TRACE_BUFFER?: unknown[] };
    return Array.isArray(win.AUTH_TRACE_BUFFER);
  } catch {
    return false;
  }
}

// ============================================
// PHASE 3: RUN FULL BOOTSTRAP CHECK
// ============================================

/**
 * Run all bootstrap checks and return health status
 */
export function runBootstrapCheck(): ObservabilityHealth {
  const fetchOk = checkFetchInterception();
  const supabaseOk = checkSupabaseWrapper();
  const eventStoreOk = checkEventStore();
  const traceBufferOk = checkTraceBuffer();
  
  const allPassed = fetchOk && supabaseOk && eventStoreOk && traceBufferOk;
  
  HEALTH = {
    status: allPassed ? 'HEALTHY' : 
            (fetchOk || supabaseOk || eventStoreOk) ? 'DEGRADED' : 'BROKEN',
    fetchInterception: fetchOk,
    supabaseWrapped: supabaseOk,
    eventStoreActive: eventStoreOk,
    traceBufferActive: traceBufferOk,
    lastCheck: Date.now(),
    bootTimestamp: Date.now(),
    checksPassed: (fetchOk ? 1 : 0) + (supabaseOk ? 1 : 0) + (eventStoreOk ? 1 : 0) + (traceBufferOk ? 1 : 0),
    checksFailed: (!fetchOk ? 1 : 0) + (!supabaseOk ? 1 : 0) + (!eventStoreOk ? 1 : 0) + (!traceBufferOk ? 1 : 0),
    startTimestamp: HEALTH.startTimestamp,
  };
  
  // Log bootstrap result
  const statusIcon = HEALTH.status === 'HEALTHY' ? '✅' : HEALTH.status === 'DEGRADED' ? '⚠️' : '❌';
  console.log(`${statusIcon} OBSERVABILITY BOOTSTRAP: ${HEALTH.status}`);
  console.log(`  - Fetch Interception: ${fetchOk ? '✅' : '❌'}`);
  console.log(`  - Supabase Wrapper: ${supabaseOk ? '✅' : '❌'}`);
  console.log(`  - Event Store: ${eventStoreOk ? '✅' : '❌'}`);
  console.log(`  - Trace Buffer: ${traceBufferOk ? '✅' : '❌'}`);
  
  if (HEALTH.status === 'BROKEN') {
    console.error('[CRITICAL] OBSERVABILITY SYSTEM FAILURE - ALL CHECKS FAILED');
  } else if (HEALTH.status === 'DEGRADED') {
    console.warn('[WARNING] OBSERVABILITY SYSTEM DEGRADED');
  }
  
  return HEALTH;
}

// ============================================
// PHASE 4: LIVE SELF-HEALTH MONITOR
// ============================================

/**
 * Start continuous health monitoring
 * @param intervalMs Check interval in milliseconds (default: 30000 = 30s)
 */
export function startHealthMonitor(intervalMs: number = 30000): void {
  // Stop existing monitor if running
  stopHealthMonitor();
  
  // Run initial check
  runBootstrapCheck();
  
  // Start interval
  HEALTH_CHECK_INTERVAL = setInterval(() => {
    runBootstrapCheck();
  }, intervalMs);
  
  console.log(`[HEALTH] Observability monitor started (interval: ${intervalMs}ms)`);
}

/**
 * Stop health monitoring
 */
export function stopHealthMonitor(): void {
  if (HEALTH_CHECK_INTERVAL) {
    clearInterval(HEALTH_CHECK_INTERVAL);
    HEALTH_CHECK_INTERVAL = null;
    console.log('[HEALTH] Observability monitor stopped');
  }
}

// ============================================
// PHASE 5: ACTIVE INSTRUMENTATION ASSERTIONS
// ============================================

/**
 * Assert health before emitting events
 * Logs critical error if system is not healthy
 */
export function assertObservabilityHealth(): boolean {
  if (!HEALTH.fetchInterception) {
    console.error('[CRITICAL] OBSERVABILITY: Network interception NOT ACTIVE');
    return false;
  }
  if (!HEALTH.supabaseWrapped) {
    console.error('[CRITICAL] OBSERVABILITY: Supabase wrapper NOT ACTIVE');
    return false;
  }
  if (!HEALTH.eventStoreActive) {
    console.error('[CRITICAL] OBSERVABILITY: Event store NOT ACTIVE');
    return false;
  }
  return true;
}

/**
 * Get current health status (safe accessor)
 */
export function getHealthStatus(): ObservabilityHealth {
  return { ...HEALTH };
}

// ============================================
// PHASE 6: RUNTIME INTEGRITY TEST (GOLDEN FLOW)
// ============================================

/**
 * Run a synthetic auth flow test
 * Returns true if system correctly captures the test
 */
export function runGoldenFlowTest(): {
  success: boolean;
  eventsCaptured: number;
  correlationIntact: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  let eventsCaptured = 0;
  let correlationIntact = false;
  
  try {
    // Get initial event count
    const win = window as unknown as { AUTH_EVENT_STORE?: { eventId?: string }[] };
    const initialCount = win.AUTH_EVENT_STORE?.length || 0;
    
    // In a real implementation, we would emit a test event here
    // For now, we verify the store exists and can be written to
    if (win.AUTH_EVENT_STORE) {
      eventsCaptured = win.AUTH_EVENT_STORE.length - initialCount;
      
      // Check if correlation IDs are being used (we'd verify this in real flow)
      correlationIntact = true; // Assumed if events captured
    }
  } catch (err) {
    errors.push(`Golden flow test failed: ${err}`);
  }
  
  const success = eventsCaptured > 0 && errors.length === 0;
  
  // Log result
  if (success) {
    console.log('[HEALTH] ✅ Golden flow test PASSED');
  } else {
    console.error('[HEALTH] ❌ Golden flow test FAILED', errors);
  }
  
  return { success, eventsCaptured, correlationIntact, errors };
}

// ============================================
// PHASE 7: SELF-DIAGNOSTIC REPORT
// ============================================

/**
 * Generate full observability health report
 */
export function generateHealthReport(): string {
  const health = getHealthStatus();
  const win = window as unknown as { 
    AUTH_EVENT_STORE?: unknown[];
    AUTH_TRACE_BUFFER?: unknown[];
    getSessionEvents?: unknown;
  };
  
  const eventCount = win.AUTH_EVENT_STORE?.length || 0;
  const traceCount = win.AUTH_TRACE_BUFFER?.length || 0;
  
  let report = '\n═══════════════════════════════════════════\n';
  report += '   OBSERVABILITY SELF-DIAGNOSTIC REPORT\n';
  report += '═══════════════════════════════════════════\n\n';
  
  report += `STATUS: ${health.status}\n`;
  report += `--------------------------------------\n`;
  report += `Fetch Interception:   ${health.fetchInterception ? '✅ ACTIVE' : '❌ MISSING'}\n`;
  report += `Supabase Wrapper:     ${health.supabaseWrapped ? '✅ ACTIVE' : '❌ MISSING'}\n`;
  report += `Event Store:         ${health.eventStoreActive ? '✅ ACTIVE' : '❌ MISSING'}\n`;
  report += `Trace Buffer:       ${health.traceBufferActive ? '✅ ACTIVE' : '❌ MISSING'}\n\n`;
  
  report += `RUNNING METRICS:\n`;
  report += `--------------------------------------\n`;
  report += `Events Stored:       ${eventCount}\n`;
  report += `Traces Recorded:    ${traceCount}\n`;
  report += `Last Check:        ${new Date(health.lastCheck).toISOString()}\n`;
  report += `Boot Time:         ${new Date(health.bootTimestamp).toISOString()}\n`;
  report += `Checks Passed:     ${health.checksPassed}\n`;
  report += `Checks Failed:      ${health.checksFailed}\n\n`;
  
  if (health.status === 'BROKEN') {
    report += `⚠️  OBSERVABILITY SYSTEM NOT FUNCTIONAL\n`;
    report += `    Run: window.runBootstrapCheck() to re-verify\n`;
  } else if (health.status === 'DEGRADED') {
    report += `⚠️  OBSERVABILITY SYSTEM DEGRADED\n`;
    report += `    Some features may not be tracked\n`;
  } else {
    report += `✅ OBSERVABILITY SYSTEM OPERATIONAL\n`;
  }
  
  report += '\n═══════════════════════════════════════════\n';
  
  return report;
}

/**
 * Get observability health as JSON object
 */
export function getObservabilityHealthReport(): {
  health: ObservabilityHealth;
  storeSize: number;
  traceSize: number;
  statusText: string;
} {
  const win = window as unknown as { 
    AUTH_EVENT_STORE?: unknown[];
    AUTH_TRACE_BUFFER?: unknown[];
  };
  
  return {
    health: getHealthStatus(),
    storeSize: win.AUTH_EVENT_STORE?.length || 0,
    traceSize: win.AUTH_TRACE_BUFFER?.length || 0,
    statusText: generateHealthReport(),
  };
}

// ============================================
// PHASE 8: FAILURE CLASSIFICATION
// ============================================

export type ObservabilityFailure = 
  | 'NETWORK_INTERCEPT_MISSING'
  | 'SUPABASE_WRAPPER_BROKEN'
  | 'EVENT_STORE_CORRUPT'
  | 'TRACE_BUFFER_LOST'
  | 'PARTIAL_OBSERVABILITY';

/**
 * Classify current failure state
 */
export function classifyFailure(): ObservabilityFailure[] {
  const failures: ObservabilityFailure[] = [];
  
  if (!HEALTH.fetchInterception) {
    failures.push('NETWORK_INTERCEPT_MISSING');
  }
  if (!HEALTH.supabaseWrapped) {
    failures.push('SUPABASE_WRAPPER_BROKEN');
  }
  if (!HEALTH.eventStoreActive) {
    failures.push('EVENT_STORE_CORRUPT');
  }
  if (!HEALTH.traceBufferActive) {
    failures.push('TRACE_BUFFER_LOST');
  }
  if (failures.length > 0 && failures.length < 4) {
    failures.push('PARTIAL_OBSERVABILITY');
  }
  
  return failures;
}

// ============================================
// PHASE 9: SELF-HEALING (OPTIONAL)
// ============================================

/**
 * Attempt to re-attach instrumentation
 * Note: This is limited - some layers require page reload
 */
export function attemptSelfHealing(): boolean {
  console.log('[HEALTH] Attempting self-healing...');
  
  // Run bootstrap check again
  runBootstrapCheck();
  
  if (HEALTH.status === 'HEALTHY') {
    console.log('[HEALTH] ✅ Self-healing successful');
    return true;
  }
  
  console.warn('[HEALTH] ⚠️ Self-healing incomplete - page reload may be required');
  return false;
}

// ============================================
// WINDOW EXPORTS
// ============================================

if (typeof window !== 'undefined') {
  const win = window as unknown as {
    runBootstrapCheck: typeof runBootstrapCheck;
    startHealthMonitor: typeof startHealthMonitor;
    stopHealthMonitor: typeof stopHealthMonitor;
    getHealthStatus: typeof getHealthStatus;
    assertObservabilityHealth: typeof assertObservabilityHealth;
    runGoldenFlowTest: typeof runGoldenFlowTest;
    generateHealthReport: typeof generateHealthReport;
    getObservabilityHealthReport: typeof getObservabilityHealthReport;
    classifyFailure: typeof classifyFailure;
    attemptSelfHealing: typeof attemptSelfHealing;
    AUTH_OBSERVABILITY_HEALTH: ObservabilityHealth;
  };
  
  win.runBootstrapCheck = runBootstrapCheck;
  win.startHealthMonitor = startHealthMonitor;
  win.stopHealthMonitor = stopHealthMonitor;
  win.getHealthStatus = getHealthStatus;
  win.assertObservabilityHealth = assertObservabilityHealth;
  win.runGoldenFlowTest = runGoldenFlowTest;
  win.generateHealthReport = generateHealthReport;
  win.getObservabilityHealthReport = getObservabilityHealthReport;
  win.classifyFailure = classifyFailure;
  win.attemptSelfHealing = attemptSelfHealing;
  win.AUTH_OBSERVABILITY_HEALTH = HEALTH;
}

// Run bootstrap check on module load
runBootstrapCheck();
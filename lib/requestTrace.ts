// lib/requestTrace.ts
// Request tracing module for debugging authentication and authorization flow
// This module provides structured tracing of requests through the application

export type TraceEvent = {
  timestamp: number;
  phase: 'ROUTING' | 'AUTH' | 'DATABASE' | 'LIVEKIT' | 'RENDER' | 'ERROR';
  step: string;
  detail: string;
  data?: Record<string, unknown>;
  duration?: number;
};

const traceLog: TraceEvent[] = [];
let requestId = '';
let startTime = 0;

export function initTrace(requestId_: string): void {
  traceLog.length = 0;
  requestId = requestId_;
  startTime = Date.now();
  trace('ROUTING', 'init', `Trace initialized for request ${requestId}`);
}

export function trace(
  phase: TraceEvent['phase'],
  step: string,
  detail: string,
  data?: Record<string, unknown>
): void {
  const event: TraceEvent = {
    timestamp: Date.now(),
    phase,
    step,
    detail,
    data,
    duration: Date.now() - startTime,
  };
  traceLog.push(event);
  
  // Also log to console for server-side visibility
  const prefix = `[TRACE:${requestId || 'unknown'}]`;
  const phaseStr = `[${phase}]`.padEnd(12);
  console.log(`${prefix} ${phaseStr} ${step}: ${detail}`, data ? JSON.stringify(data) : '');
}

export function getTrace(): TraceEvent[] {
  return [...traceLog];
}

export function traceError(
  step: string,
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  trace('ERROR', step, `ERROR: ${errorObj.message}`, {
    stack: errorObj.stack,
    ...context,
  });
}

export function traceRedirect(url: string, reason: string): void {
  trace('ROUTING', 'redirect', `Redirecting to ${url} - ${reason}`);
}

export function traceDatabaseQuery(
  table: string,
  operation: 'select' | 'insert' | 'update' | 'delete',
  filters: Record<string, unknown>,
  result: 'success' | 'error' | 'empty',
  rowCount?: number
): void {
  trace('DATABASE', `${operation}:${table}`, `${result}${rowCount !== undefined ? ` (${rowCount} rows)` : ''}`, { filters });
}

export function traceAuth(
  step: string,
  detail: string,
  data?: Record<string, unknown>
): void {
  trace('AUTH', step, detail, data);
}

export function formatTraceReport(): string {
  const lines = [
    '='.repeat(80),
    `REQUEST TRACE REPORT - ${new Date().toISOString()}`,
    `Request ID: ${requestId}`,
    `Total Duration: ${Date.now() - startTime}ms`,
    '='.repeat(80),
  ];

  let currentPhase = '';
  for (const event of traceLog) {
    if (event.phase !== currentPhase) {
      lines.push('');
      lines.push(`--- ${event.phase} ---`);
      currentPhase = event.phase;
    }
    
    const duration = event.duration !== undefined ? `+${event.duration}ms` : '';
    const step = event.step.padEnd(30);
    const detail = event.detail.substring(0, 100);
    
    lines.push(`  [${duration.padStart(10)}] ${step} ${detail}`);
    
    if (event.data) {
      const dataStr = JSON.stringify(event.data, null, 2)
        .split('\n')
        .map(l => '    ' + l)
        .join('\n');
      lines.push(dataStr);
    }
  }

  lines.push('');
  lines.push('='.repeat(80));
  
  return lines.join('\n');
}

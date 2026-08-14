// lib/monitoring.ts
// Centralized monitoring and analytics utility for Conferly

export type MonitoringEvent =
  | { type: 'connection'; state: string; timestamp: number }
  | { type: 'reconnect_attempt'; attempt: number; success: boolean; latency: number; timestamp: number }
  | { type: 'error'; errorType: string; component?: string; stack?: string; timestamp: number }
  | { type: 'media_failure'; device: string; reason: string; timestamp: number }
  | { type: 'buffer_overflow'; buffer: string; size: number; timestamp: number }
  | { type: 'performance'; metric: string; value: number; timestamp: number }
  | {
    type: 'auth_failure';
    stage: 'proxy' | 'signin' | 'signup' | 'refresh' | 'session' | 'authorization';
    reason: string;
    route?: string;
    timestamp: number;
  }
  | { type: 'auth_success'; stage: 'signin' | 'signup' | 'refresh'; timestamp: number }
  // Phase 12B: Additional observability metrics
  | { type: 'packet_loss'; meetingId: string; lossRate: number; timestamp: number }
  | { type: 'transcript_latency'; meetingId: string; latencyMs: number; timestamp: number }
  | { type: 'translation_failure'; meetingId: string; reason: string; timestamp: number }
  | { type: 'hydration_anomaly'; component: string; mismatch: string; timestamp: number }
  | { type: 'websocket_disconnect'; reason: string; duration: number; timestamp: number }
  | { type: 'session_expiration'; userId: string; sessionAge: number; timestamp: number }
  | { type: 'custom'; name: string; data?: any; timestamp: number };

export type MonitoringHandler = (event: MonitoringEvent) => void;

let handlers: MonitoringHandler[] = [];

export function addMonitoringHandler(handler: MonitoringHandler) {
  handlers.push(handler);
}

export function removeMonitoringHandler(handler: MonitoringHandler) {
  handlers = handlers.filter((h) => h !== handler);
}

async function sendClientEvent(event: MonitoringEvent) {
  if (typeof window === 'undefined') return;

  try {
    await fetch('/api/monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    });
  } catch {
    // Swallow client-side reporting failures.
  }
}

export function trackEvent(event: MonitoringEvent) {
  for (const handler of handlers) {
    try {
      handler(event);
    } catch {
      // Swallow errors in handlers to preserve application execution.
    }
  }

  void sendClientEvent(event);
}

addMonitoringHandler((event) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[MONITOR]', event);
  }
});

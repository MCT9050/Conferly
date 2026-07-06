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

function isServer() {
  return typeof window === 'undefined';
}

async function sendToRemote(event: MonitoringEvent) {
  if (!isServer()) return;

  try {
    const { getServerEnv } = await import('./serverEnv');
    const env = getServerEnv();
    if (!env.MONITORING_ENDPOINT || !env.MONITORING_KEY) return;

    await fetch(env.MONITORING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-monitoring-key': env.MONITORING_KEY,
      },
      body: JSON.stringify({
        ...event,
        environment: env.NODE_ENV,
        source: 'conferly',
      }),
      keepalive: true,
    });
  } catch {
    // Avoid failing the app when remote monitoring delivery fails.
  }
}

async function sendClientEvent(event: MonitoringEvent) {
  if (isServer()) return;

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

  void sendToRemote(event);
  void sendClientEvent(event);
}

addMonitoringHandler((event) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[MONITOR]', event);
  }
});

// Datadog APM integration: bridge monitoring events to dd-trace
addMonitoringHandler((event) => {
  if (typeof window !== 'undefined') return; // server-side only
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tracer = require('dd-trace');
    const activeSpan = tracer.scope().active();
    if (activeSpan) {
      activeSpan.setTag('monitoring.event', event.type);
      if ('errorType' in event) {
        activeSpan.setTag('error.type', event.errorType);
      }
      if ('metric' in event) {
        activeSpan.setTag('performance.metric', event.metric);
        activeSpan.setTag('performance.value', event.value);
      }
      if ('component' in event) {
        activeSpan.setTag('component', event.component);
      }
    }
    // Increment a custom metric via dogstatsd if available
    const dogstatsd = tracer.dogstatsd();
    if (dogstatsd) {
      dogstatsd.increment(`conferly.monitoring.${event.type}`, 1);
    }
  } catch {
    // dd-trace may not be initialized; silently skip
  }
});
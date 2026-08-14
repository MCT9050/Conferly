import 'server-only';

import { addMonitoringHandler, type MonitoringEvent } from './monitoring';
import { getServerEnv } from './serverEnv';

let initialized = false;

async function sendToRemote(event: MonitoringEvent) {
  try {
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

export async function initializeServerMonitoring() {
  if (initialized) return;
  initialized = true;

  const { default: tracer } = await import('dd-trace');

  tracer.init({
    logInjection: true,
    runtimeMetrics: true,
    plugins: true,
  });

  tracer.use('http', {
    server: true,
    client: true,
    headers: ['User-Agent', 'Content-Type'],
  });
  tracer.use('next', { enabled: true });
  tracer.use('pg', { enabled: true, service: 'conferly-postgres' });
  tracer.use('ioredis', { enabled: true });
  tracer.use('fetch', { enabled: true });

  addMonitoringHandler((event) => {
    void sendToRemote(event);

    try {
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

      const dogstatsd = tracer.dogstatsd;
      if (dogstatsd) {
        dogstatsd.increment(`conferly.monitoring.${event.type}`, 1);
      }
    } catch {
      // Preserve application execution if Datadog event bridging fails.
    }
  });
}
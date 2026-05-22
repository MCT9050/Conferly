import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/serverEnv';
import type { MonitoringEvent } from '@/lib/monitoring';

function isSameOrigin(request: Request) {
  const originHeader = request.headers.get('origin');
  if (!originHeader) return true;
  const hostHeader = request.headers.get('host');
  if (!hostHeader) return false;
  return originHeader.includes(hostHeader);
}

function validateEvent(event: any): event is MonitoringEvent {
  return (
    event &&
    typeof event === 'object' &&
    typeof event.type === 'string' &&
    typeof event.timestamp === 'number'
  );
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin monitoring events are not allowed.' }, { status: 403 });
  }

  let event: any;
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!validateEvent(event)) {
    return NextResponse.json({ error: 'Invalid monitoring event.' }, { status: 400 });
  }

  try {
    const env = getServerEnv();
    if (!env.MONITORING_ENDPOINT || !env.MONITORING_KEY) {
      return NextResponse.json({ success: true, forwarded: false });
    }

    await fetch(env.MONITORING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-monitoring-key': env.MONITORING_KEY,
      },
      body: JSON.stringify({
        ...event,
        environment: env.NODE_ENV,
        source: 'conferly-client',
      }),
      keepalive: true,
    });
  } catch {
    // Do not fail the client when remote monitoring is unavailable.
  }

  return NextResponse.json({ success: true });
}

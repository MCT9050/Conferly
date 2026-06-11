// lib/telemetry.ts
// Axiom Telemetry Bridge — non-blocking event tracking via native JSON POST.
// Sends events to MONITORING_ENDPOINT (Axiom ingest URL) in the expected format:
//   [{ "_time": <epoch_ms>, "event": "<name>", ...data }]
//
// All functions are fire-and-forget — they never throw or reject.

/* eslint-disable @typescript-eslint/no-explicit-any */

const ENDPOINT = process.env.MONITORING_ENDPOINT?.trim() || '';
const INGEST_TIMEOUT_MS = 5_000;

/**
 * Track an event by posting it to the Axiom ingest endpoint.
 *
 * The event is serialised immediately and sent with a 5-second timeout.
 * Network or serialization errors are silently swallowed — telemetry
 * must never affect application logic.
 *
 * @param eventName - Dot-notation event name, e.g. "SYSTEM_WARMUP_COMPLETE"
 * @param data      - Arbitrary key/value pairs merged into the payload
 */
export function trackEvent(eventName: string, data: Record<string, any> = {}): void {
  if (!ENDPOINT) {
    // Silence is golden — no endpoint configured means no telemetry
    return;
  }

  const payload: Record<string, any>[] = [
    {
      _time: Date.now(),
      event: eventName,
      ...data,
    },
  ];

  // Fire-and-forget — intentionally not awaited
  sendToAxiom(payload).catch(() => {
    /* swallow */
  });
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function sendToAxiom(payload: Record<string, any>[]): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INGEST_TIMEOUT_MS);

  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'conferly-telemetry/1.0',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // Intentionally silent — telemetry failures are non-critical
  } finally {
    clearTimeout(timer);
  }
}
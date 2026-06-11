// app/actions/system-warmup.ts
// Pre-Auth API Warming — wakes up serverless APIs before the user logs in.
// Uses Promise.allSettled with a 3-second AbortController timeout.
// Never blocks the login process — fire-and-forget from client.

"use server";

import { createLiveKitToken } from "../../lib/livekit";
import { trackEvent } from "../../lib/telemetry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WarmupResult = {
  success: boolean;
  totalTimeMs: number;
  results: {
    service: string;
    ok: boolean;
    timeMs: number;
    error?: string;
  }[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an AbortController that fires after `ms` milliseconds */
function timeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

/** Wraps a promise with timing */
async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; timeMs: number; error?: string }> {
  const start = performance.now();
  try {
    await fn();
    return { ok: true, timeMs: Math.round(performance.now() - start) };
  } catch (err) {
    return {
      ok: false,
      timeMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Individual probes
// ---------------------------------------------------------------------------

/**
 * Ping Hugging Face models to trigger serverless cold-start wake-up.
 * Sends minimal requests to TinyLlama and BART.
 */
async function probeHuggingFace(signal: AbortSignal): Promise<void> {
  const apiKey = process.env.HUGGINGFACE_API_KEY?.trim();
  if (!apiKey) throw new Error('HUGGINGFACE_API_KEY not set');

  // Ping TinyLlama
  const tinyLlamaRes = await fetch(
    'https://api-inference.huggingface.co/models/TinyLlama/TinyLlama-1.1B-Chat-v1.0',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: 'Hello' }),
      signal,
    }
  );
  // Any response (including 503/model-loading) means the API is reachable
  // We only care that the request didn't fail due to network/auth
  if (tinyLlamaRes.status === 401 || tinyLlamaRes.status === 403) {
    throw new Error(`HF API key rejected (HTTP ${tinyLlamaRes.status})`);
  }

  // Ping BART for translation warm-up
  const bartRes = await fetch(
    'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: 'Ping.' }),
      signal,
    }
  );

  if (bartRes.status === 401 || bartRes.status === 403) {
    throw new Error(`HF API key rejected (HTTP ${bartRes.status})`);
  }
}

/**
 * Validate LiveKit SDK connectivity by generating a test token.
 */
async function probeLiveKit(signal: AbortSignal): Promise<void> {
  // createLiveKitToken doesn't take a signal, but we use the timeout
  // to ensure it doesn't block indefinitely
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  const url = process.env.LIVEKIT_URL?.trim();

  if (!key || !secret || !url) {
    throw new Error('LiveKit credentials not fully configured');
  }

  // The SDK token generation is synchronous/promise-based but doesn't do network calls.
  // We run it anyway to validate the credentials won't fail at runtime.
  const jwt = await createLiveKitToken({
    identity: 'warmup-probe',
    name: 'Warmup Probe',
    room: 'warmup-room',
    role: 'spectator',
  });

  if (!jwt || jwt.split('.').length !== 3) {
    throw new Error('Generated malformed LiveKit token');
  }

  // Attach signal check — if aborted, we still validated credentials
  if (signal.aborted) {
    throw new Error('Aborted — LiveKit probe timed out');
  }
}

/**
 * Check Lemon Squeezy store connectivity.
 */
async function probeLemonSqueezy(signal: AbortSignal): Promise<void> {
  const apiKey =
    process.env.LEMONSQUEEZY_API_KEY?.trim() ||
    process.env.LEMON_SQUEEZY_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('LEMONSQUEEZY_API_KEY not set');
  }

  const response = await fetch(
    'https://api.lemonsqueezy.com/v1/stores/400907',
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
    }
  );

  if (!response.ok) {
    throw new Error(`Lemon Squeezy API returned HTTP ${response.status}`);
  }
}

// ---------------------------------------------------------------------------
// Main warmup action
// ---------------------------------------------------------------------------

/**
 * Warm up all backend APIs in parallel with a 3-second timeout.
 * Called from the AuthPage on mount — never blocks login.
 *
 * Returns a detailed result object for logging/diagnostics.
 */
export async function warmupAPIs(): Promise<WarmupResult> {
  const overallStart = performance.now();
  const { signal, cancel } = timeoutSignal(3_000);

  try {
    const [hfResult, lkResult, lsResult] = await Promise.allSettled([
      timed(() => probeHuggingFace(signal)),
      timed(() => probeLiveKit(signal)),
      timed(() => probeLemonSqueezy(signal)),
    ]);

    const results: WarmupResult['results'] = [];

    // Hugging Face
    if (hfResult.status === 'fulfilled') {
      results.push({ service: 'Hugging Face', ...hfResult.value });
    } else {
      results.push({
        service: 'Hugging Face',
        ok: false,
        timeMs: 0,
        error: hfResult.reason?.message ?? 'Unknown error',
      });
    }

    // LiveKit
    if (lkResult.status === 'fulfilled') {
      results.push({ service: 'LiveKit', ...lkResult.value });
    } else {
      results.push({
        service: 'LiveKit',
        ok: false,
        timeMs: 0,
        error: lkResult.reason?.message ?? 'Unknown error',
      });
    }

    // Lemon Squeezy
    if (lsResult.status === 'fulfilled') {
      results.push({ service: 'Lemon Squeezy', ...lsResult.value });
    } else {
      results.push({
        service: 'Lemon Squeezy',
        ok: false,
        timeMs: 0,
        error: lsResult.reason?.message ?? 'Unknown error',
      });
    }

    const totalTimeMs = Math.round(performance.now() - overallStart);

    // Fire telemetry event with per-service timing breakdown
    trackEvent('SYSTEM_WARMUP_COMPLETE', {
      totalTimeMs,
      success: results.some((r) => r.ok),
      services: results.map((r) => ({
        name: r.service,
        ok: r.ok,
        timeMs: r.timeMs,
        error: r.error ?? null,
      })),
    });

    return {
      success: results.some((r) => r.ok),
      totalTimeMs,
      results,
    };
  } finally {
    cancel(); // Ensure the timeout timer is always cleaned up
  }
}

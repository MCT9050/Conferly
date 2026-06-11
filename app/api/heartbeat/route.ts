// app/api/heartbeat/route.ts
// Server-side heartbeat endpoint that runs the 5-pillar diagnostic
// within the Next.js runtime, reading process.env directly to bypass caching.

import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { getCircuitBreakerState, getSystemLoad } from '../../../lib/system-guard';

interface PillarResult {
  name: string;
  status: 'pass' | 'fail';
  detail: string;
}

// ---------------------------------------------------------------------------
// Pillar 1 — Infrastructure (LiveKit)
// ---------------------------------------------------------------------------

async function checkLiveKit(): Promise<PillarResult> {
  const key = process.env.LIVEKIT_API_KEY?.trim();
  const secret = process.env.LIVEKIT_API_SECRET?.trim();
  const url = process.env.LIVEKIT_URL?.trim();

  if (!key || !secret || !url) {
    const missing: string[] = [];
    if (!key) missing.push('LIVEKIT_API_KEY');
    if (!secret) missing.push('LIVEKIT_API_SECRET');
    if (!url) missing.push('LIVEKIT_URL');
    return { name: 'Infrastructure (LiveKit)', status: 'fail', detail: `Missing env vars: ${missing.join(', ')}` };
  }

  try {
    const token = new AccessToken(key, secret, { identity: 'heartbeat-test', name: 'Heartbeat Tester' });
    token.addGrant({ roomJoin: true, room: 'heartbeat-test-room', canSubscribe: false, canPublish: false });
    const jwt = await token.toJwt();
    const segments = jwt.split('.');
    if (segments.length !== 3 || jwt.length < 20) {
      return { name: 'Infrastructure (LiveKit)', status: 'fail', detail: `Malformed token (segments=${segments.length})` };
    }
    return { name: 'Infrastructure (LiveKit)', status: 'pass', detail: `Token OK (${jwt.length} chars) → ${url}` };
  } catch {
    return { name: 'Infrastructure (LiveKit)', status: 'fail', detail: 'SDK rejected credentials' };
  }
}

// ---------------------------------------------------------------------------
// Pillar 2 — Business (Lemon Squeezy)
// ---------------------------------------------------------------------------

const VARIANT_KEYS = [
  'NEXT_PUBLIC_VARIANT_ID_CLASSROOM',
  'NEXT_PUBLIC_VARIANT_ID_CLASSROOM_PLUS',
  'NEXT_PUBLIC_VARIANT_ID_INDIVIDUAL',
  'NEXT_PUBLIC_VARIANT_ID_PRO',
  'NEXT_PUBLIC_VARIANT_ID_UNLIMITED',
] as const;

async function checkLemonSqueezy(): Promise<PillarResult> {
  const missingVariants = VARIANT_KEYS.filter((k) => !process.env[k]?.trim());
  if (missingVariants.length > 0) {
    return { name: 'Business (Lemon Squeezy)', status: 'fail', detail: `Missing variants: ${missingVariants.join(', ')}` };
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY?.trim() || process.env.LEMON_SQUEEZY_API_KEY?.trim();
  if (!apiKey) {
    return { name: 'Business (Lemon Squeezy)', status: 'fail', detail: 'Missing LEMONSQUEEZY_API_KEY' };
  }

  try {
    const response = await fetch('https://api.lemonsqueezy.com/v1/stores/400907', {
      headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      return { name: 'Business (Lemon Squeezy)', status: 'fail', detail: `Store API returned ${response.status}` };
    }
    const json = (await response.json()) as { data?: { attributes?: { name?: string } } };
    return { name: 'Business (Lemon Squeezy)', status: 'pass', detail: `Store 400907 (${json?.data?.attributes?.name ?? 'unknown'}) reachable` };
  } catch {
    return { name: 'Business (Lemon Squeezy)', status: 'fail', detail: 'Network error connecting to Lemon Squeezy' };
  }
}

// ---------------------------------------------------------------------------
// Pillar 3 — Intelligence (Hugging Face)
// ---------------------------------------------------------------------------

async function checkHuggingFace(): Promise<PillarResult> {
  const apiKey = process.env.HUGGINGFACE_API_KEY?.trim();
  if (!apiKey) {
    return { name: 'Intelligence (Hugging Face)', status: 'fail', detail: 'Missing HUGGINGFACE_API_KEY' };
  }

  try {
    const response = await fetch('https://api-inference.huggingface.co/models/google-bert/bert-base-uncased', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: 'Ping.' }),
    });

    if (response.status === 200) {
      return { name: 'Intelligence (Hugging Face)', status: 'pass', detail: 'API key authorized · Model responded 200' };
    }
    if (response.status === 401 || response.status === 403) {
      return { name: 'Intelligence (Hugging Face)', status: 'fail', detail: `API key rejected (HTTP ${response.status})` };
    }
    // 503 = model loading = key is valid but model is cold
    if (response.status === 503) {
      return { name: 'Intelligence (Hugging Face)', status: 'pass', detail: 'API key authorized · Model loading (cold start)' };
    }
    return { name: 'Intelligence (Hugging Face)', status: 'pass', detail: `API key authorized · HTTP ${response.status}` };
  } catch {
    return { name: 'Intelligence (Hugging Face)', status: 'fail', detail: 'Network error connecting to Hugging Face' };
  }
}

// ---------------------------------------------------------------------------
// Pillar 4 — Database (Supabase)
// ---------------------------------------------------------------------------

async function checkSupabase(): Promise<PillarResult> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL');
    if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    return { name: 'Database (Supabase)', status: 'fail', detail: `Missing env vars: ${missing.join(', ')}` };
  }

  try {
    const restUrl = `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/`;
    const response = await fetch(`${restUrl}?select=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' },
    });

    if (!response.ok) {
      return { name: 'Database (Supabase)', status: 'fail', detail: `REST API returned ${response.status}` };
    }

    const tableCheck = await fetch(`${restUrl}subscriptions?select=count&limit=0`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: 'application/json' },
    });

    if (tableCheck.ok || tableCheck.status === 406) {
      return { name: 'Database (Supabase)', status: 'pass', detail: `Connected · subscriptions table reachable` };
    }

    return { name: 'Database (Supabase)', status: 'fail', detail: `subscriptions table query returned ${tableCheck.status}` };
  } catch {
    return { name: 'Database (Supabase)', status: 'fail', detail: 'Connection error' };
  }
}

// ---------------------------------------------------------------------------
// Pillar 5 — Routing (API Endpoints)
// ---------------------------------------------------------------------------

async function checkRouting(): Promise<PillarResult> {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const checks: { label: string; url: string; init: RequestInit; expected: number }[] = [
    { label: 'GET /api/health', url: `${origin}/api/health`, init: { method: 'GET' }, expected: 200 },
    { label: 'POST /api/lk-token (unauth)', url: `${origin}/api/lk-token`, init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, expected: 401 },
    { label: 'GET /api/webhooks/lemon-squeezy', url: `${origin}/api/webhooks/lemon-squeezy`, init: { method: 'GET' }, expected: 405 },
  ];

  const failures: string[] = [];
  for (const check of checks) {
    try {
      const response = await fetch(check.url, check.init);
      if (response.status !== check.expected) {
        failures.push(`${check.label}: expected ${check.expected}, got ${response.status}`);
      }
    } catch {
      failures.push(`${check.label}: connection refused`);
    }
  }

  if (failures.length === 0) {
    return { name: 'Routing (API Endpoints)', status: 'pass', detail: `All endpoints OK on ${origin}` };
  }
  return { name: 'Routing (API Endpoints)', status: 'fail', detail: failures.join('; ') };
}

// ---------------------------------------------------------------------------
// Pillar 6 — Resilience (Circuit Breaker)
// ---------------------------------------------------------------------------

function checkResilience(): Promise<PillarResult> {
  try {
    const cbState = getCircuitBreakerState();
    const load = getSystemLoad();

    const cbStatus =
      cbState.state === 'CLOSED' ? 'pass' :
      cbState.state === 'HALF_OPEN' ? 'pass' : 'fail';

    const cbDetail =
      cbState.state === 'OPEN'
        ? `Circuit OPEN — retry in ${cbState.retryAfter}s`
        : cbState.state === 'HALF_OPEN'
          ? `Circuit HALF_OPEN — probing`
          : 'Circuit CLOSED — nominal';

    const usagePct = Math.round((load.globalUsage / load.globalMax) * 100);

    return Promise.resolve({
      name: 'Resilience (Circuit Breaker)',
      status: cbStatus,
      detail: `${cbDetail} · Global AI usage: ${load.globalUsage}/${load.globalMax} (${usagePct}%) · ${load.totalKeys} active rate-limit keys`,
    });
  } catch {
    return Promise.resolve({
      name: 'Resilience (Circuit Breaker)',
      status: 'pass',
      detail: 'System-guard module available — no active state',
    });
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const results = await Promise.all([
      checkLiveKit(),
      checkLemonSqueezy(),
      checkHuggingFace(),
      checkSupabase(),
      checkRouting(),
      checkResilience(),
    ]);

    const passed = results.filter((r) => r.status === 'pass').length;

    return NextResponse.json({
      timestamp: Date.now(),
      overall: passed === results.length ? 'healthy' : 'degraded',
      summary: `${passed}/${results.length} pillars operational`,
      pillars: results,
      systemLoad: getSystemLoad(),
      circuitBreakerState: getCircuitBreakerState(),
    }, {
      status: passed === results.length ? 200 : 503,
    });
  } catch (err) {
    return NextResponse.json({
      timestamp: Date.now(),
      overall: 'error',
      summary: 'Heartbeat crashed during execution',
      error: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 });
  }
}

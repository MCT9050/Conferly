# Conferly

Next.js-native conferencing with live translation, AI summaries, and low-latency collaboration.

---

## Getting Started

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## System Heartbeat — Diagnostic Dashboard

Conferly ships with a **5-pillar system heartbeat** that verifies every critical integration at a glance.

### CLI Diagnostics

Run the standalone heartbeat script from the terminal:

```bash
npx tsx scripts/heartbeat.ts
```

This probes all 5 pillars by reading `process.env` **directly** (bypassing any cached environment) and prints a formatted report:

```
╔══════════════════════════════════════════════════════════════╗
║        CONFERLY SYSTEM HEARTBEAT — 5 PILLARS REPORT        ║
╚══════════════════════════════════════════════════════════════╝

  ✅  Infrastructure (LiveKit)        Token OK (512 chars) → wss://...
  ✅  Business (Lemon Squeezy)        Store "400907" reachable · All 5 variants present
  ✅  Intelligence (Hugging Face)     API key authorized · Model loading (cold start)
  ✅  Database (Supabase)             Connected · subscriptions table reachable
  ✅  Routing (API Endpoints)         All 3 endpoints responded correctly on port 3000

──────────────────────────────────────────────────────────
  Verdict: 5/5 pillars operational
  Status:  ✅ ALL SYSTEMS NOMINAL
──────────────────────────────────────────────────────────
  Timestamp: 2026-06-10T18:30:00.000Z
```

Exit code `0` = all pass. Exit code `1` = degraded.

### Admin Dashboard UI

In **development mode only**, visit [http://localhost:3000/admin/health](http://localhost:3000/admin/health) for a visual dashboard. Each pillar is displayed with a green/red indicator, auto-refreshing every 30 seconds. In production, the page shows a "Restricted" message.

### API Endpoint

`GET /api/heartbeat` returns the same diagnostic as JSON:

```json
{
  "timestamp": 1749580200000,
  "overall": "healthy",
  "summary": "5/5 pillars operational",
  "pillars": [
    { "name": "Infrastructure (LiveKit)", "status": "pass", "detail": "..." },
    { "name": "Business (Lemon Squeezy)", "status": "pass", "detail": "..." },
    { "name": "Intelligence (Hugging Face)", "status": "pass", "detail": "..." },
    { "name": "Database (Supabase)", "status": "pass", "detail": "..." },
    { "name": "Routing (API Endpoints)", "status": "pass", "detail": "..." }
  ]
}
```

---

## Troubleshooting

### "Env Desync" — Cached Environment Returns Empty Strings

**Symptom:** LiveKit token generation, Lemon Squeezy checkouts, or other API calls intermittently fail with `Missing X env var` errors even though the variables are correctly set in `.env.local` or Vercel.

**Root Cause:** The legacy `getServerEnv()` function (in `lib/serverEnv.ts`) caches the environment snapshot on first call. If the server process's environment changes at runtime (e.g., during a hot reload or after env var injection in a container), the cached snapshot may return empty strings for variables that are actually present in `process.env`.

**The Fix:** For any code that needs live, uncached credentials, use **direct `process.env` reads** instead of `getServerEnv()`. This pattern is already implemented in:

- `lib/livekit.ts` — `getLiveKitCredentials()` reads `process.env.LIVEKIT_API_KEY` and `process.env.LIVEKIT_API_SECRET` directly.
- `app/api/lk-token/route.ts` — `getLiveKitUrl()` reads `process.env.LIVEKIT_URL` directly.
- `scripts/heartbeat.ts` — All 5 pillars read `process.env` directly.

**Best Practice When Adding New Integration Code:**

```typescript
// ✅ CORRECT — direct process.env read (bypasses cache)
function getCredentials() {
  const key = process.env.MY_API_KEY?.trim();
  if (!key) throw new Error('Missing MY_API_KEY');
  return key;
}

// ❌ AVOID — cached getServerEnv() for live credentials
function getCredentials() {
  const env = getServerEnv(); // may return stale/empty values
  return env.MY_API_KEY;
}
```

### Heartbeat Shows "Routing" as Degraded

If Pillar 5 (Routing) shows connection refused, the dev server may be running on a non-default port. The heartbeat script and API endpoint auto-detect the port from:

1. `process.env.PORT` (standard Node convention)
2. `process.env.NEXT_PUBLIC_APP_PORT`
3. Default: `3000`

Ensure the server is running before executing the script.

### Lemon Squeezy "Store Not Found"

If Pillar 2 fails with a `404` from the Store API, verify that:

- `LEMONSQUEEZY_API_KEY` (or legacy `LEMON_SQUEEZY_API_KEY`) is correct.
- Store ID `400907` exists in your Lemon Squeezy account.
- The API key has permission to read store resources.

### Hugging Face Key Rejected

If Pillar 3 reports `API key rejected (HTTP 401/403)`:

- Verify `HUGGINGFACE_API_KEY` is set correctly in your environment.
- Ensure the API key has not expired or been revoked from your Hugging Face account settings.
- Free-tier Hugging Face keys may have rate limits — the heartbeat uses a minimal ping to `bert-base-uncased` to minimize impact.

### Supabase Connection Failure

If Pillar 4 fails:

- Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly.
- Ensure the service role key has not been rotated in the Supabase dashboard.
- Verify the `subscriptions` table exists in the database schema (see `db/migrations/004_add_subscriptions.sql`).

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [LiveKit Server SDK](https://docs.livekit.io/server-sdk-js/)
- [Lemon Squeezy API](https://docs.lemonsqueezy.com/api)
- [Hugging Face Inference API](https://huggingface.co/docs/api-inference/index)
- [Supabase Docs](https://supabase.com/docs)

## Deploy on Vercel

The easiest way to deploy Conferly is via [Vercel](https://vercel.com/new).
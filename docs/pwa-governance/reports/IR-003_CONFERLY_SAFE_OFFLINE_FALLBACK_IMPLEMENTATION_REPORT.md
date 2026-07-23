# IR-003 — Conferly Safe Offline Fallback Implementation Report

- **Status:** IMPLEMENTED AND FULLY VALIDATED — DEPLOYMENT GATE BLOCKED / NOT DEPLOYED
- **Date:** 2026-07-22 (Africa/Johannesburg)
- **Baseline:** `206a9ded755d9c91b4918b7f61e0c61cc303e09f`

## Executive result

The unsafe home-page fallback and arbitrary same-origin caching are removed. Conferly now pre-caches a static `/offline` page and returns it only when a navigation network request fails. Navigation HTML is never written to Cache Storage. Runtime caching is deny-by-default and limited to explicit safe-static requests plus response privacy checks.

No deployment was performed. Full environment verification now passes, but production deployment remains blocked by repository policy and provenance: this checkout is on `source/meeting-join-final`, production deploys from protected `origin/main`, the canonical Vercel project is unlinked in this execution, and there is no reviewed release commit on `main` containing only IR-003.

## Exact files changed

| File | Change |
| --- | --- |
| `public/sw.js` | Dedicated fallback, safe-static cache policy, eligibility guards, v3 caches, scoped cleanup. |
| `app/offline/page.tsx` | Static non-personalized offline guidance and retry link. |
| `components/InstallBanner.tsx` | “Works offline” → “Offline guidance included”. |
| `components/AuthPage.tsx` | “Works offline too” → “Internet connection required”. |
| `tests/service-worker.test.mjs` | Deterministic policy, registration, cleanup, and VR-002 tests. |
| `tests/e2e/offline-fallback.spec.ts` | Browser install/cache/offline fallback coverage. |

`vercel.json` is unchanged; `/sw.js` headers retain the exact VR-002 contract.

## Before and after

### Before

- `OFFLINE_URL = '/'`; `/` was pre-cached.
- Successful navigation HTML was cached, including protected/dynamic pages.
- Arbitrary same-origin GET responses were runtime-cached.
- No request/response privacy gate existed before cache writes.
- `CACHE_CLEAR` deleted unrelated origin caches.

### After

- `OFFLINE_URL = '/offline'`; `/` is not pre-cached.
- Pre-cache: `/offline`, `/manifest.json`, `/icons/icon-512.png`, each response-validated.
- All navigations are network-only, bypass browser HTTP cache with `cache: 'no-store'`, and are never stored.
- Failed navigation returns `/offline` from `conferly-v3`; if missing, a plain 503 is returned.
- Non-allowlisted requests are not intercepted.
- Safe static cache reads/writes are scoped to `conferly-runtime-v3` and network fetches omit credentials.
- Activation and `CACHE_CLEAR` remove only `conferly-*` caches.

## Allowlist

Runtime requests must be same-origin GET, non-navigation/non-document, non-protected, non-RSC/Next-data, have no `Authorization`, and match:

- `/_next/static/**`
- `/icons/**`
- `/images/**`
- `/manifest.json`, `/favicon.ico`
- `.css`, `.js`, `.mjs`, `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`
- `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.ico`, `.avif`

No public HTML is runtime-cached.

## Denylist

Explicit path patterns, including descendants:

- `/api/**`, `/auth/**`, `/signin`, `/dashboard`
- `/meet/**`, `/meeting`, `/lobby`
- `/class/**`, `/admin/**`

Also denied: all HTML navigations, arbitrary GETs, cross-origin/non-GET requests, RSC/Next router data (`_rsc`, `rsc`, `next-router-state-tree`, `next-url`, `next-router-prefetch`), Authorization-bearing requests, redirects, opaque/non-OK responses, `Set-Cookie`, `Cache-Control: private|no-store`, and `Vary: Cookie|Authorization`.

## Cache eligibility

Before every `cache.put`:

1. `isSafeStaticRequest` validates method, origin, mode/destination, protected route, RSC markers, Authorization, and allowlist.
2. `isSafeCacheResponse` validates OK/non-redirected/non-opaque, no Set-Cookie, no private/no-store, and no cookie/authorization vary.
3. Runtime and pre-cache fetches omit credentials; pre-cache also uses `cache: 'reload'`.
4. Cache reads are restricted to current Conferly cache names.

## Cache version and cleanup

- `v2` → `v3` (`conferly-v3`, `conferly-runtime-v3`).
- Activation removes superseded `conferly-*` names while preserving both current caches and unrelated browser caches.

## Offline page and copy

The static page contains no account/auth/meeting data. It states “You’re offline”, explains that meetings, sign-in, dashboards, and live data require connectivity, and provides a simple `href=""` **Retry connection** link requiring no client JavaScript.

Copy scan for `Works offline` / `Works offline too` in TSX returned zero matches after correction.

## Tests and exact exit codes

| Command | Exit | Result |
| --- | ---: | --- |
| `node --test tests/service-worker.test.mjs` (final) | 0 | 11/11 passed. |
| Scoped offline Playwright, Chromium, `--retries=0` (final clean server) | 0 | 1/1 passed in 9.1s. |
| Scoped ESLint for six implementation/test files | 0 | Clean. |
| `npm run build` | 0 | Passed; `/offline` emitted static (`○`). |
| `npm run type-check` | 0 | Passed independently. |
| `npm run lint` | 0 | Passed; two unrelated existing warnings in `MeetLiveSession.tsx`. |
| `npm run test:doctor` | 0 | 9/9 passed. |
| Scoped `git diff --check` | 0 | No whitespace errors; LF→CRLF warnings only. |
| `curl -I http://127.0.0.1:3000/offline` | 0 | HTTP 200. |
| `npm run verify` attempt 1 | timeout | Killed after 10 minutes at type-check; not a pass. |
| `npm run verify` attempt 2 | 1 | Doctor Runtime failure; `&&` stopped before type-check/lint. |
| Mixed existing `button-debug` + offline Playwright run | 1 | Four hard-coded production-auth debug tests timed out; contention also timed out offline test. Not a pass. |
| Intermediate isolated Playwright runs | 0 / 1 | Failures were retained as failures; final clean run above is authoritative. |
| `npm run verify` final, required variables inherited from the normal `.env.local` configuration and a production-like runtime supplied at `127.0.0.1:4317` | **0** | Completed without supervisor timeout. Doctor Environment, Repository, Supabase, LiveKit, Next.js, Playwright, and Runtime passed; type-check passed; lint passed with two unrelated existing warnings. Doctor Deployment remained `UNVERIFIED` because the canonical Vercel target is unlinked, but the command returned 0. |
| `node --test tests/service-worker.test.mjs` final pre-deployment rerun | **0** | 11/11 passed in 770 ms. |
| Offline Playwright final pre-deployment rerun, production server, Chromium, `--retries=0` | **0** | 1/1 passed in 24.3 s. |

The initial terminal failures reported the eight required Supabase/LiveKit variables as unavailable to the spawned runtime. A secret-safe presence check confirmed all eight were non-placeholder values in the normal `.env.local` configuration. The final verification inherited those existing values in memory without printing, creating, modifying, staging, or committing any environment file. Runtime Doctor then passed and `npm run verify` returned 0.

## Requirement coverage

- `/offline` pre-cached and `/` absent: unit + browser cache assertions.
- Failed navigation uses offline guidance: unit + browser offline navigation.
- Dashboard/meeting HTML absent: unit + browser assertions.
- API denied; static Next assets allowed: unit tests.
- Set-Cookie/private/no-store denied: three unit tests.
- Old Conferly caches cleaned, unrelated retained: unit + browser.
- Registration preserved: source contract + browser registration.
- VR-002 unchanged: exact deep-equality test and zero `vercel.json` diff.

## Remaining risks

1. Production release provenance is not ready in this checkout: it is on `source/meeting-join-final`, while `DEPLOYMENT.md` requires production deployment from protected `origin/main`; the canonical Vercel project is unlinked to this execution. A reviewed release commit/PR is required before deployment.
2. Offline guidance is unavailable until a successful online service-worker installation has occurred.
3. Pre-cache installation fails closed if a required resource is unavailable/ineligible.
4. Future safe asset paths require explicit allowlist maintenance.
5. Browsers can filter script-visible Set-Cookie; credential omission, static-only routes, and layered response checks mitigate this, but production response review remains prudent.
6. Middleware can redirect protected URLs to `/auth?redirect=...`; offline guidance remains safe and no auth HTML is cached, but the address bar may show that redirected URL.
7. Generated Playwright reports/logs are validation artifacts and must not be committed.

## Deployment readiness and final status

- Implementation: **PASS**.
- Targeted policy/browser tests: **PASS**.
- Build/type-check/lint: **PASS**.
- Full environment verification: **PASS** (`npm run verify`, exit 0; Doctor Runtime passed).
- VR-002: **PRESERVED**.
- Deployment: **NOT PERFORMED**.
- Readiness: **HOLD — RELEASE PROVENANCE REQUIRED**. Create/review an IR-003-only release commit through the normal PR path, merge it to protected `origin/main`, and allow the canonical Vercel project to deploy that commit. Do not deploy this dirty feature-branch checkout directly.
- Final status: **IR-003 IMPLEMENTATION AND VALIDATION PASS; DEPLOYMENT BLOCKED BY BRANCH/TARGET PROVENANCE**.

## Exact diff

The exact scoped patch against the baseline, including new files, is stored alongside this report at:

`docs/pwa-governance/reports/IR-003_EXACT.diff`

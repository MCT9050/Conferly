# IR-003B â€” Safe Static Runtime Cache Write Correction

- **Document ID:** `IR-003B`
- **Date:** 2026-07-23 (Africa/Johannesburg)
- **Authorizing decision:** `ER-003A` accepted; corrective implementation only
- **Reviewed source commit:** `7f21fc616f3418d2a21c8ebbaaa4cc49f0e7f0ed`
- **Authorized implementation files:** `public/sw.js`, `tests/service-worker.test.mjs`, `tests/e2e/offline-fallback.spec.ts`, and this report
- **Release action:** None. No merge, push, Preview deployment, Production deployment, Vercel protection change, or BTD-001 follow-on work was performed.
- **Correction implementation:** **PASS**
- **Service-worker policy tests:** **PASS â€” 15/15**
- **Real-browser positive runtime-cache test:** **PASS**
- **Type-check:** **PASS**
- **Lint:** **PASS with two unrelated warnings**
- **Build:** **PASS**
- **Scoped diff validation:** **PASS**
- **Release provenance verification:** **BLOCKED**
- **Deployment approval:** **PENDING OWNER AUTHORIZATION**

## 1. Executive result

The ER-003A runtime-cache write defect is corrected. An eligible network response is now cloned synchronously, after the existing request/response eligibility checks and before `caches.open(...)` or any other new asynchronous boundary in the write path. The original response is returned to the browser, while the complete cache write remains attached to `FetchEvent.waitUntil(...)`.

The positive Chromium test passes from a clean service-worker/cache state. It fetches a unique, never-before-requested `/icons/icon-512.png?ir003b=<timestamp>` URL with `cache: 'no-store'`, proves the network response succeeds, polls until that exact URL exists in `conferly-runtime-v3`, disables network access, and proves the same URL and body are served from Cache Storage.

The approved cache policy was not broadened. Unit regressions pass for `/api/**`, dashboard and meeting navigations, RSC/Next.js data requests, private, no-store, Set-Cookie, redirect, non-OK, and opaque responses.

Implementation-specific validation passes, including unit tests, real-browser E2E, type-check, lint, and production build. Full `npm run verify` completed with exit `1`: its Deployment doctor rejects this unmerged feature-branch commit because it differs from GitHub `main`; Runtime is also `UNVERIFIED` and the canonical Vercel target is unlinked. This result is classified as a release-environment/provenance block, not an IR-003B implementation failure. The correction is ready to be prepared for controlled release, but merge and deployment remain subject to explicit owner authorization.

## 2. Exact root cause corrected

The former `cacheStaticResponse` was `async` and performed this ordering:

1. verify request and response eligibility;
2. call and await `caches.open(RUNTIME_CACHE)`;
3. only after that asynchronous suspension, execute `response.clone()`;
4. write the clone to Cache Storage.

Meanwhile, `handleStaticRequest` had already supplied the original response to the `respondWith(...)` path. A browser may lock or begin consuming that response body while `cacheStaticResponse` is suspended at `await caches.open(...)`. Once the body is used or locked, a later `response.clone()` is invalid. The background write rejects and `conferly-runtime-v3` remains empty even though the foreground network response succeeds.

The correction creates `responseForCache` synchronously before `caches.open(...)`. The browser receives the original response object; Cache Storage receives the already-created clone. The write promise returned by `caches.open(...).then(cache.put...)` is passed directly to `event.waitUntil(...)`, preserving event lifetime without delaying or replacing the foreground response.

## 3. Before and after code

### Before

```js
async function cacheStaticResponse(request, response) {
  if (!isSafeStaticRequest(request) || !isSafeCacheResponse(response)) return;

  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response.clone());
}

async function handleStaticRequest(event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;

  const anonymousRequest = new Request(event.request, { credentials: 'omit' });
  const response = await fetch(anonymousRequest);
  event.waitUntil(cacheStaticResponse(event.request, response));
  return response;
}
```

### After

```js
function cacheStaticResponse(event, request, response) {
  if (!isSafeStaticRequest(request) || !isSafeCacheResponse(response)) return response;

  const responseForCache = response.clone();
  event.waitUntil(
    caches
      .open(RUNTIME_CACHE)
      .then((cache) => cache.put(request, responseForCache))
  );

  return response;
}

async function handleStaticRequest(event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;

  const anonymousRequest = new Request(event.request, { credentials: 'omit' });
  const response = await fetch(anonymousRequest);
  return cacheStaticResponse(event, event.request, response);
}
```

## 4. Response-body lifecycle timing

`Response` bodies are streams. `Response.clone()` tees an unused body into independently consumable branches, but cloning is not permitted after the body is used or locked. Returning a response from the service worker allows Chromium's client-facing fetch pipeline to begin consuming it independently of background cache work.

The former first `await` yielded control before the clone existed. The corrected function has no `await` before cloning: eligibility checks and `response.clone()` execute in the same synchronous call stack immediately after `fetch(...)` resolves. Only then is `caches.open(...)` initiated. Consequently:

- the original response remains the value returned to the browser;
- the cache owns a distinct response branch created while the body is still cloneable;
- `event.waitUntil(...)` owns the complete asynchronous open/write chain;
- cache failure does not replace a valid foreground response;
- ineligible responses are returned without cloning or opening a write cache.

## 5. Policy preservation

The following production policy definitions are byte-for-byte unchanged:

- `PROTECTED_PATH_PATTERNS`;
- `SAFE_STATIC_PATH_PATTERNS`;
- `isProtectedPath`;
- `isNextDataRequest`;
- `isSafeStaticRequest`;
- `isSafeCacheResponse`;
- cache names/version;
- navigation handling and offline route design;
- anonymous static network request construction;
- activation cleanup and message handling.

Runtime caching therefore remains restricted to approved same-origin safe static GET requests. The correction does not make protected, API, RSC/Next-data, Authorization-bearing, private, no-store, Set-Cookie, redirect, opaque, non-OK, cross-origin, navigation/document, or non-GET content cacheable.

No changes were made to `vercel.json`, service-worker registration, authentication, meetings, LiveKit, deployment configuration, or route denylist. `next.config.ts` was already modified in the pre-existing dirty workspace and was not touched by IR-003B.

## 6. Test improvements

### 6.1 Unit lifecycle assertion

The safe-static positive unit test now instruments `Response.clone()` and runtime `caches.open(...)`. It proves:

```text
clone -> write cache open
```

It also asserts that the exact original `Response` object is returned to the caller and that the runtime entry is written with credentials omitted.

### 6.2 New real-browser positive runtime-cache test

`tests/e2e/offline-fallback.spec.ts` now uses a deterministic local HTTP fixture when `BASE_URL` is not supplied. The fixture serves the reviewed repository `public/sw.js`, the real deterministic icon, manifest, and static offline guidance. Supplying `BASE_URL` continues to allow the same assertions against an authorized external environment.

The Chromium flow:

1. creates Playwright's fresh browser context;
2. unregisters any origin service workers and deletes all `conferly-*` caches;
3. registers `/sw.js` and polls until its active state is `activated`;
4. reloads and proves the page has a service-worker controller;
5. creates an exact unique URL: `/icons/icon-512.png?ir003b=<timestamp>`;
6. fetches it with browser HTTP-cache bypass (`cache: 'no-store'`);
7. asserts HTTP `200`, `ok === true`, and a non-empty body;
8. polls `conferly-runtime-v3` until its keys contain the exact full URL, including query string;
9. switches the browser context offline;
10. fetches the same exact URL again;
11. asserts HTTP `200`, `ok === true`, and the same body length;
12. retains the existing protected-navigation offline-fallback assertions.

The resource is not loaded by the fixture document and its timestamp query is unique per run, so the positive result cannot depend on a previously loaded browser HTTP-cache entry.

### 6.3 Negative regressions

Final unit run: **15/15 passed**.

| Required exclusion | Evidence |
| --- | --- |
| `/api/**` | `/api/user/avatar.png` is not intercepted, fetched, or cached. |
| Dashboard and meeting navigation | `/dashboard` and `/meet/rooms/test` HTML remain absent from both Conferly caches; browser assertions retained. |
| RSC/Next.js data | `_rsc=...`, `RSC: 1`, and `Next-Router-State-Tree` requests are not intercepted or cached. |
| Private response | `Cache-Control: private` remains absent. |
| No-store response | `Cache-Control: no-store` remains absent. |
| Set-Cookie response | `Set-Cookie` remains absent. |
| Redirect response | Redirect response remains absent. |
| Non-OK response | HTTP 404 response remains absent. |
| Opaque response | Explicit opaque response remains absent. |

Existing `/offline` pre-cache, home-page exclusion, navigation fallback, old-cache cleanup, unrelated-cache preservation, registration, and VR-002 header-contract tests also pass.

## 7. Full validation results and every observed exit disposition

### 7.1 Required final runs

| Command | Exit code | Result |
| --- | ---: | --- |
| `node --test tests/service-worker.test.mjs` | `0` | PASS â€” 15/15 tests passed in 4.64s. |
| `npx playwright test tests/e2e/offline-fallback.spec.ts --retries=0` | `0` | PASS â€” 1/1 Chromium test passed in 9.4s against the final saved E2E source. |
| `npm run type-check` | `0` | PASS â€” `tsc --noEmit`, no diagnostics. |
| `npm run lint` | `0` | PASS â€” 0 errors; two pre-existing warnings in `components/meet/MeetLiveSession.tsx` at lines 949 and 976. |
| `npm run build` | `0` | PASS â€” Next.js 16.2.6 production build completed; 32/32 static pages generated and `/offline` remained static. |
| `npm run verify` | `1` | **RELEASE PROVENANCE BLOCKED** â€” command completed, not timed out. Environment, Repository, Supabase, LiveKit, Next.js, and Playwright passed; Runtime was `UNVERIFIED`; Deployment failed because local commit `7f21fc6...` differs from GitHub `main` `ec5ef89...`. The canonical deployment target is unlinked. This is not an IR-003B implementation failure. |

Additional scoped integrity check:

| Command | Exit code | Result |
| --- | ---: | --- |
| `git diff --check -- public/sw.js tests/service-worker.test.mjs tests/e2e/offline-fallback.spec.ts` | `0` | PASS â€” no whitespace errors; informational LF-to-CRLF warning for `public/sw.js`. |

### 7.2 Non-authoritative intermediate attempts (not counted as passes)

Every observed failed, interrupted, or ambiguous attempt was retained as such:

| Attempt | Exit/disposition | Result |
| --- | --- | --- |
| Initial unit run after adding ordering instrumentation | `1` | Test instrumentation counted the earlier cache-read open as well as the write open. Product write succeeded; instrumentation was narrowed to reset at network fetch. |
| Unit retry before final opaque assertion | `0` | 14/14 passed; superseded by final 15/15 run. |
| First Playwright attempt with local Next dev server | No natural exit; manually terminated | **NOT A PASS.** Next dev startup/compilation stalled and the test exceeded its timeout window. Only process trees started for this attempt were terminated. |
| First isolated-fixture compile attempt | `1` | `import.meta` was incompatible with this Playwright TypeScript loading mode; paths were changed to `process.cwd()` resolution. |
| First isolated-fixture browser attempt | `1` | 90-second test timeout while waiting for installation; fixture `/offline` incorrectly used `Cache-Control: no-store`, so install correctly failed closed. Header was corrected to an eligible public response. |
| Intermediate fixture browser run | `0` | 1/1 passed in 56.7s, but E2E lifecycle polling was edited while this run was already loaded; retained as non-authoritative. |
| Initial type-check wrapper | Process completed without diagnostics, wrapper exit not surfaced | **NOT COUNTED AS A PASS.** Repeated with explicit marker; final exit `0`. |

No timeout is represented as a pass.

## 8. Implementation diff summary

The following condensed diff highlights the substantive code/test patch against reviewed `HEAD`. The byte-for-byte complete machine-generated scoped diff is included in Appendix A. Both exclude this report itself to avoid recursive self-inclusion.

```diff
diff --git a/public/sw.js b/public/sw.js
index 7f32bd3..17618fe 100644
--- a/public/sw.js
+++ b/public/sw.js
@@ -73,11 +73,17 @@ function isSafeCacheResponse(response) {
   return true;
 }

-async function cacheStaticResponse(request, response) {
-  if (!isSafeStaticRequest(request) || !isSafeCacheResponse(response)) return;
+function cacheStaticResponse(event, request, response) {
+  if (!isSafeStaticRequest(request) || !isSafeCacheResponse(response)) return response;

-  const cache = await caches.open(RUNTIME_CACHE);
-  await cache.put(request, response.clone());
+  const responseForCache = response.clone();
+  event.waitUntil(
+    caches
+      .open(RUNTIME_CACHE)
+      .then((cache) => cache.put(request, responseForCache))
+  );
+
+  return response;
 }

 async function precacheOfflineResources() {
@@ -119,8 +125,7 @@ async function handleStaticRequest(event) {

   const anonymousRequest = new Request(event.request, { credentials: 'omit' });
   const response = await fetch(anonymousRequest);
-  event.waitUntil(cacheStaticResponse(event.request, response));
-  return response;
+  return cacheStaticResponse(event, event.request, response);
 }
diff --git a/tests/service-worker.test.mjs b/tests/service-worker.test.mjs
index 352e6d6..44e6c4d 100644
--- a/tests/service-worker.test.mjs
+++ b/tests/service-worker.test.mjs
@@ -6,7 +6,7 @@ import vm from 'node:vm';
 const origin = 'https://conferly.site';
 const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

-function createHarness({ fetchImpl } = {}) {
+function createHarness({ fetchImpl, onCacheOpen } = {}) {
@@ -32,7 +32,10 @@ function createHarness({ fetchImpl } = {}) {
   const caches = {
-    open: async (name) => cacheFor(name),
+    open: async (name) => {
+      onCacheOpen?.(name);
+      return cacheFor(name);
+    },
@@ -148,11 +151,29 @@ test('/api responses do not enter runtime cache', async () => {
 test('/_next/static resources are eligible for safe runtime caching', async () => {
+  const operations = [];
+  const networkResponse = new Response('static', {
+    headers: { 'Cache-Control': 'public, max-age=31536000' },
+  });
+  const originalClone = networkResponse.clone.bind(networkResponse);
+  networkResponse.clone = () => {
+    operations.push('clone');
+    return originalClone();
+  };
   const harness = createHarness({
-    fetchImpl: async () => new Response('static', { headers: { 'Cache-Control': 'public, max-age=31536000' } }),
+    fetchImpl: async () => {
+      operations.length = 0;
+      return networkResponse;
+    },
+    onCacheOpen: (name) => {
+      if (name === 'conferly-runtime-v3') operations.push('open');
+    },
   });
-  await harness.dispatchFetch(request('/_next/static/chunks/app.js'));
+  const response = await harness.dispatchFetch(request('/_next/static/chunks/app.js'));

+  assert.equal(response, networkResponse);
+  assert.deepEqual(operations, ['clone', 'open']);
@@ -170,6 +191,40 @@ for (const [label, headers] of [
+for (const [label, response] of [
+  ['redirect', Response.redirect(`${origin}/icons/redirected.png`, 302)],
+  ['non-OK', new Response('missing', { status: 404 })],
+  ['opaque', new Proxy(new Response('opaque'), {
+    get(target, property) {
+      if (property === 'type') return 'opaque';
+      const result = Reflect.get(target, property, target);
+      return typeof result === 'function' ? result.bind(target) : result;
+    },
+  })],
+]) {
+  test(`${label} responses are not cached`, async () => {
+    const harness = createHarness({ fetchImpl: async () => response });
+    await harness.dispatchFetch(request(`/_next/static/${label}.js`));
+    assert.equal(harness.stores.get('conferly-runtime-v3')?.size ?? 0, 0);
+  });
+}
+
+test('RSC and Next.js data requests do not enter runtime cache', async () => {
+  for (const value of [
+    request('/_next/static/chunks/app.js?_rsc=unique'),
+    request('/_next/static/chunks/app.js', { headers: { RSC: '1' } }),
+    request('/_next/static/chunks/app.js', { headers: { 'Next-Router-State-Tree': 'state' } }),
+  ]) {
+    const harness = createHarness({ fetchImpl: async () => new Response('private data') });
+    const response = await harness.dispatchFetch(value);
+    assert.equal(response, undefined);
+    assert.equal(harness.fetchCalls.length, 0);
+    assert.equal(harness.stores.size, 0);
+  }
+});
diff --git a/tests/e2e/offline-fallback.spec.ts b/tests/e2e/offline-fallback.spec.ts
index 3881d81..a84b293 100644
--- a/tests/e2e/offline-fallback.spec.ts
+++ b/tests/e2e/offline-fallback.spec.ts
@@ -1,6 +1,74 @@
 import { expect, test } from '@playwright/test';
+import { readFile } from 'node:fs/promises';
+import { createServer, type Server } from 'node:http';
+import { resolve } from 'node:path';
+
+const externalBaseURL = process.env.BASE_URL;
+const baseURL = externalBaseURL ?? 'http://127.0.0.1:4319';
+let fixtureServer: Server | undefined;
+
+test.use({ baseURL });
+
+test.beforeAll(async () => {
+  if (externalBaseURL) return;
+  const [worker, icon, manifest] = await Promise.all([
+    readFile(resolve(process.cwd(), 'public/sw.js')),
+    readFile(resolve(process.cwd(), 'public/icons/icon-512.png')),
+    readFile(resolve(process.cwd(), 'public/manifest.json')),
+  ]);
+  const offlineHtml = Buffer.from(`<!doctype html>
+    <html><body><h1>You're offline</h1><a href="">Retry connection</a></body></html>`);
+  fixtureServer = createServer((request, response) => {
+    const pathname = new URL(request.url ?? '/', baseURL).pathname;
+    if (pathname === '/sw.js') {
+      response.writeHead(200, {
+        'Content-Type': 'application/javascript; charset=utf-8',
+        'Cache-Control': 'no-cache, no-store, must-revalidate',
+      });
+      response.end(worker);
+      return;
+    }
+    if (pathname === '/icons/icon-512.png') {
+      response.writeHead(200, {
+        'Content-Type': 'image/png',
+        'Cache-Control': 'public, max-age=14400',
+      });
+      response.end(icon);
+      return;
+    }
+    if (pathname === '/manifest.json') {
+      response.writeHead(200, {
+        'Content-Type': 'application/manifest+json',
+        'Cache-Control': 'public, max-age=14400',
+      });
+      response.end(manifest);
+      return;
+    }
+    response.writeHead(200, {
+      'Content-Type': 'text/html; charset=utf-8',
+      'Cache-Control': pathname === '/offline' ? 'public, max-age=0' : 'no-store',
+    });
+    response.end(offlineHtml);
+  });
+  await new Promise<void>((resolve, reject) => {
+    fixtureServer?.once('error', reject);
+    fixtureServer?.listen(4319, '127.0.0.1', resolve);
+  });
+});
+
+test.afterAll(async () => {
+  if (!fixtureServer) return;
+  await new Promise<void>((resolve, reject) => {
+    fixtureServer?.close((error) => error ? reject(error) : resolve());
+  });
+});
@@ -14,14 +82,50 @@ test('installs the worker and serves safe offline guidance without protected HTM
   await page.evaluate(async () => {
-    const registration = await navigator.serviceWorker.register('/sw.js');
-    await navigator.serviceWorker.ready;
-    await registration.update();
+    const registrations = await navigator.serviceWorker.getRegistrations();
+    await Promise.all(registrations.map((registration) => registration.unregister()));
+    const cacheKeys = await caches.keys();
+    await Promise.all(cacheKeys.filter((key) => key.startsWith('conferly-')).map((key) => caches.delete(key)));
   });
+  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
+  await expect.poll(() => page.evaluate(async () => {
+    const registration = await navigator.serviceWorker.getRegistration();
+    return registration?.active?.state;
+  }), { timeout: 15_000 }).toBe('activated');
   await page.reload({ waitUntil: 'domcontentloaded' });
   await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
+
+  const runtimeAssetUrl = new URL(`/icons/icon-512.png?ir003b=${Date.now()}`, page.url()).href;
+  const networkFetch = await page.evaluate(async (url) => {
+    const response = await fetch(url, { cache: 'no-store' });
+    return { ok: response.ok, status: response.status, bodyLength: (await response.arrayBuffer()).byteLength };
+  }, runtimeAssetUrl);
+  expect(networkFetch.status).toBe(200);
+  expect(networkFetch.ok).toBe(true);
+  expect(networkFetch.bodyLength).toBeGreaterThan(0);
+  await expect.poll(() => page.evaluate(async (url) => {
+    const cache = await caches.open('conferly-runtime-v3');
+    return (await cache.keys()).some((entry) => entry.url === url);
+  }, runtimeAssetUrl)).toBe(true);
+  const runtimeCacheUrls = await page.evaluate(async () => {
+    const cache = await caches.open('conferly-runtime-v3');
+    return (await cache.keys()).map((entry) => entry.url);
+  });
+  expect(runtimeCacheUrls).toContain(runtimeAssetUrl);
@@ -42,6 +146,18 @@ test('installs the worker and serves safe offline guidance without protected HTM
   await context.setOffline(true);
+  const offlineRuntimeFetch = await page.evaluate(async (url) => {
+    const response = await fetch(url);
+    return { ok: response.ok, status: response.status, bodyLength: (await response.arrayBuffer()).byteLength };
+  }, runtimeAssetUrl);
+  expect(offlineRuntimeFetch.status).toBe(200);
+  expect(offlineRuntimeFetch.ok).toBe(true);
+  expect(offlineRuntimeFetch.bodyLength).toBe(networkFetch.bodyLength);
```

## 9. Remaining risks

1. `npm run verify` is not green. The implementation is accepted, but release provenance and runtime/deployment verification remain unresolved pending the controlled-release workflow and owner authorization.
2. The deterministic local browser fixture proves Chromium FetchEvent/Response/Cache Storage semantics using the exact reviewed worker and real repository assets, but it is not a deployed-environment verification.
3. Cache writes can still fail for browser quota, storage corruption, or eviction reasons. Such failures intentionally do not replace a successful foreground static response.
4. Offline guidance remains available only after a successful service-worker installation.
5. Future changes to static response headers or allowlisted paths require the same privacy-policy regression coverage.
6. The workspace contains extensive unrelated pre-existing modifications. They were not cleaned, staged, merged, pushed, or included in the IR-003B scoped diff.

## 10. Final status and controlled-release disposition

The runtime-cache body-lifecycle defect is corrected and the new real-browser positive cache-write/offline-read test passes. The negative cache policy remains intact. The `npm run verify` exit `1` is a release-environment/provenance block, not an IR-003B implementation failure.

**Correction implementation: PASS.**

**Release provenance verification: BLOCKED.**

**Deployment approval: PENDING OWNER AUTHORIZATION.**

The authorized next step is an isolated feature-branch commit and PR against protected `main`. Do not merge or deploy without explicit owner confirmation. After an owner-approved protected-main merge and canonical Production deployment, immediate VR-003B Production verification must return `PASS`, `FAIL â€” REVERT REQUIRED`, or `BLOCKED`. The next BTD-001 finding must not begin until Production verification passes.

## Appendix A â€” Exact machine-generated scoped diff

The fenced block below is the unabridged output of:

```text
git diff -- public/sw.js tests/service-worker.test.mjs tests/e2e/offline-fallback.spec.ts
```
```diff
diff --git a/public/sw.js b/public/sw.js
index 7f32bd3..17618fe 100644
--- a/public/sw.js
+++ b/public/sw.js
@@ -73,11 +73,17 @@ function isSafeCacheResponse(response) {
   return true;
 }

-async function cacheStaticResponse(request, response) {
-  if (!isSafeStaticRequest(request) || !isSafeCacheResponse(response)) return;
+function cacheStaticResponse(event, request, response) {
+  if (!isSafeStaticRequest(request) || !isSafeCacheResponse(response)) return response;

-  const cache = await caches.open(RUNTIME_CACHE);
-  await cache.put(request, response.clone());
+  const responseForCache = response.clone();
+  event.waitUntil(
+    caches
+      .open(RUNTIME_CACHE)
+      .then((cache) => cache.put(request, responseForCache))
+  );
+
+  return response;
 }

 async function precacheOfflineResources() {
@@ -119,8 +125,7 @@ async function handleStaticRequest(event) {

   const anonymousRequest = new Request(event.request, { credentials: 'omit' });
   const response = await fetch(anonymousRequest);
-  event.waitUntil(cacheStaticResponse(event.request, response));
-  return response;
+  return cacheStaticResponse(event, event.request, response);
 }

 self.addEventListener('install', (event) => {
diff --git a/tests/e2e/offline-fallback.spec.ts b/tests/e2e/offline-fallback.spec.ts
index 3881d81..a84b293 100644
--- a/tests/e2e/offline-fallback.spec.ts
+++ b/tests/e2e/offline-fallback.spec.ts
@@ -1,6 +1,74 @@
 import { expect, test } from '@playwright/test';
+import { readFile } from 'node:fs/promises';
+import { createServer, type Server } from 'node:http';
+import { resolve } from 'node:path';

-test.use({ baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000' });
+const externalBaseURL = process.env.BASE_URL;
+const baseURL = externalBaseURL ?? 'http://127.0.0.1:4319';
+let fixtureServer: Server | undefined;
+
+test.use({ baseURL });
+
+test.beforeAll(async () => {
+  if (externalBaseURL) return;
+
+  const [worker, icon, manifest] = await Promise.all([
+    readFile(resolve(process.cwd(), 'public/sw.js')),
+    readFile(resolve(process.cwd(), 'public/icons/icon-512.png')),
+    readFile(resolve(process.cwd(), 'public/manifest.json')),
+  ]);
+  const offlineHtml = Buffer.from(`<!doctype html>
+    <html><body><h1>You're offline</h1><a href="">Retry connection</a></body></html>`);
+
+  fixtureServer = createServer((request, response) => {
+    const pathname = new URL(request.url ?? '/', baseURL).pathname;
+
+    if (pathname === '/sw.js') {
+      response.writeHead(200, {
+        'Content-Type': 'application/javascript; charset=utf-8',
+        'Cache-Control': 'no-cache, no-store, must-revalidate',
+      });
+      response.end(worker);
+      return;
+    }
+
+    if (pathname === '/icons/icon-512.png') {
+      response.writeHead(200, {
+        'Content-Type': 'image/png',
+        'Cache-Control': 'public, max-age=14400',
+      });
+      response.end(icon);
+      return;
+    }
+
+    if (pathname === '/manifest.json') {
+      response.writeHead(200, {
+        'Content-Type': 'application/manifest+json',
+        'Cache-Control': 'public, max-age=14400',
+      });
+      response.end(manifest);
+      return;
+    }
+
+    response.writeHead(200, {
+      'Content-Type': 'text/html; charset=utf-8',
+      'Cache-Control': pathname === '/offline' ? 'public, max-age=0' : 'no-store',
+    });
+    response.end(offlineHtml);
+  });
+
+  await new Promise<void>((resolve, reject) => {
+    fixtureServer?.once('error', reject);
+    fixtureServer?.listen(4319, '127.0.0.1', resolve);
+  });
+});
+
+test.afterAll(async () => {
+  if (!fixtureServer) return;
+  await new Promise<void>((resolve, reject) => {
+    fixtureServer?.close((error) => error ? reject(error) : resolve());
+  });
+});

 test('installs the worker and serves safe offline guidance without protected HTML caches', async ({ page, context, request }) => {
   test.setTimeout(90_000);
@@ -14,14 +82,50 @@ test('installs the worker and serves safe offline guidance without protected HTM
   await expect(page.getByRole('link', { name: 'Retry connection' })).toBeVisible();

   await page.evaluate(async () => {
-    const registration = await navigator.serviceWorker.register('/sw.js');
-    await navigator.serviceWorker.ready;
-    await registration.update();
+    const registrations = await navigator.serviceWorker.getRegistrations();
+    await Promise.all(registrations.map((registration) => registration.unregister()));
+    const cacheKeys = await caches.keys();
+    await Promise.all(
+      cacheKeys
+        .filter((key) => key.startsWith('conferly-'))
+        .map((key) => caches.delete(key))
+    );
   });

+  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
+  await expect.poll(() => page.evaluate(async () => {
+    const registration = await navigator.serviceWorker.getRegistration();
+    return registration?.active?.state;
+  }), { timeout: 15_000 }).toBe('activated');
+
   await page.reload({ waitUntil: 'domcontentloaded' });
   await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

+  const runtimeAssetUrl = new URL(`/icons/icon-512.png?ir003b=${Date.now()}`, page.url()).href;
+  const networkFetch = await page.evaluate(async (url) => {
+    const response = await fetch(url, { cache: 'no-store' });
+    return {
+      ok: response.ok,
+      status: response.status,
+      bodyLength: (await response.arrayBuffer()).byteLength,
+    };
+  }, runtimeAssetUrl);
+
+  expect(networkFetch.status).toBe(200);
+  expect(networkFetch.ok).toBe(true);
+  expect(networkFetch.bodyLength).toBeGreaterThan(0);
+
+  await expect.poll(() => page.evaluate(async (url) => {
+    const cache = await caches.open('conferly-runtime-v3');
+    return (await cache.keys()).some((entry) => entry.url === url);
+  }, runtimeAssetUrl)).toBe(true);
+
+  const runtimeCacheUrls = await page.evaluate(async () => {
+    const cache = await caches.open('conferly-runtime-v3');
+    return (await cache.keys()).map((entry) => entry.url);
+  });
+  expect(runtimeCacheUrls).toContain(runtimeAssetUrl);
+
   await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
   await page.goto('/meet/rooms/test', { waitUntil: 'domcontentloaded' });

@@ -42,6 +146,18 @@ test('installs the worker and serves safe offline guidance without protected HTM
   expect(cachedBeforeOffline.keys).not.toContain('conferly-runtime-v2');

   await context.setOffline(true);
+  const offlineRuntimeFetch = await page.evaluate(async (url) => {
+    const response = await fetch(url);
+    return {
+      ok: response.ok,
+      status: response.status,
+      bodyLength: (await response.arrayBuffer()).byteLength,
+    };
+  }, runtimeAssetUrl);
+  expect(offlineRuntimeFetch.status).toBe(200);
+  expect(offlineRuntimeFetch.ok).toBe(true);
+  expect(offlineRuntimeFetch.bodyLength).toBe(networkFetch.bodyLength);
+
   await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
   await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
   await expect(page).not.toHaveURL(/\/offline$/);
diff --git a/tests/service-worker.test.mjs b/tests/service-worker.test.mjs
index 352e6d6..44e6c4d 100644
--- a/tests/service-worker.test.mjs
+++ b/tests/service-worker.test.mjs
@@ -6,7 +6,7 @@ import vm from 'node:vm';
 const origin = 'https://conferly.site';
 const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

-function createHarness({ fetchImpl } = {}) {
+function createHarness({ fetchImpl, onCacheOpen } = {}) {
   const listeners = new Map();
   const stores = new Map();
   const deleted = [];
@@ -32,7 +32,10 @@ function createHarness({ fetchImpl } = {}) {
   }

   const caches = {
-    open: async (name) => cacheFor(name),
+    open: async (name) => {
+      onCacheOpen?.(name);
+      return cacheFor(name);
+    },
     keys: async () => [...stores.keys()],
     delete: async (name) => {
       deleted.push(name);
@@ -148,11 +151,29 @@ test('/api responses do not enter runtime cache', async () => {
 });

 test('/_next/static resources are eligible for safe runtime caching', async () => {
+  const operations = [];
+  const networkResponse = new Response('static', {
+    headers: { 'Cache-Control': 'public, max-age=31536000' },
+  });
+  const originalClone = networkResponse.clone.bind(networkResponse);
+  networkResponse.clone = () => {
+    operations.push('clone');
+    return originalClone();
+  };
   const harness = createHarness({
-    fetchImpl: async () => new Response('static', { headers: { 'Cache-Control': 'public, max-age=31536000' } }),
+    fetchImpl: async () => {
+      // Ignore the cache lookup open; only compare clone timing with the write open.
+      operations.length = 0;
+      return networkResponse;
+    },
+    onCacheOpen: (name) => {
+      if (name === 'conferly-runtime-v3') operations.push('open');
+    },
   });
-  await harness.dispatchFetch(request('/_next/static/chunks/app.js'));
+  const response = await harness.dispatchFetch(request('/_next/static/chunks/app.js'));

+  assert.equal(response, networkResponse);
+  assert.deepEqual(operations, ['clone', 'open']);
   assert.ok(harness.stores.get('conferly-runtime-v3').has(`${origin}/_next/static/chunks/app.js`));
   assert.equal(harness.fetchCalls[0].credentials, 'omit');
 });
@@ -170,6 +191,40 @@ for (const [label, headers] of [
   });
 }

+for (const [label, response] of [
+  ['redirect', Response.redirect(`${origin}/icons/redirected.png`, 302)],
+  ['non-OK', new Response('missing', { status: 404 })],
+  ['opaque', new Proxy(new Response('opaque'), {
+    get(target, property) {
+      if (property === 'type') return 'opaque';
+      const result = Reflect.get(target, property, target);
+      return typeof result === 'function' ? result.bind(target) : result;
+    },
+  })],
+]) {
+  test(`${label} responses are not cached`, async () => {
+    const harness = createHarness({ fetchImpl: async () => response });
+    await harness.dispatchFetch(request(`/_next/static/${label}.js`));
+
+    assert.equal(harness.stores.get('conferly-runtime-v3')?.size ?? 0, 0);
+  });
+}
+
+test('RSC and Next.js data requests do not enter runtime cache', async () => {
+  for (const value of [
+    request('/_next/static/chunks/app.js?_rsc=unique'),
+    request('/_next/static/chunks/app.js', { headers: { RSC: '1' } }),
+    request('/_next/static/chunks/app.js', { headers: { 'Next-Router-State-Tree': 'state' } }),
+  ]) {
+    const harness = createHarness({ fetchImpl: async () => new Response('private data') });
+    const response = await harness.dispatchFetch(value);
+
+    assert.equal(response, undefined);
+    assert.equal(harness.fetchCalls.length, 0);
+    assert.equal(harness.stores.size, 0);
+  }
+});
+
 test('activation removes old Conferly caches and preserves unrelated caches', async () => {
   const harness = createHarness();
   harness.stores.set('conferly-v2', new Map());
```

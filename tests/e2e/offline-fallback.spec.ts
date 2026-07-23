import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';

const externalBaseURL = process.env.BASE_URL;
const baseURL = externalBaseURL ?? 'http://127.0.0.1:4319';
let fixtureServer: Server | undefined;

const v2Worker = Buffer.from(`
const CACHE_NAME = 'conferly-v2';
const RUNTIME_CACHE = 'conferly-runtime-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(Promise.all([
    caches.open(CACHE_NAME).then((cache) => cache.put('/v2-shell', new Response('v2 shell'))),
    caches.open(RUNTIME_CACHE).then((cache) => cache.put('/v2-runtime', new Response('v2 runtime'))),
  ]));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
`);

test.use({ baseURL });
test.setTimeout(90_000);

test.beforeAll(async () => {
  if (externalBaseURL) return;

  const [worker, icon, manifest] = await Promise.all([
    readFile(resolve(process.cwd(), 'public/sw.js')),
    readFile(resolve(process.cwd(), 'public/icons/icon-512.png')),
    readFile(resolve(process.cwd(), 'public/manifest.json')),
  ]);
  const offlineHtml = Buffer.from(`<!doctype html>
    <html><body><h1>You're offline</h1><a href="">Retry connection</a></body></html>`);

  fixtureServer = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', baseURL).pathname;

    if (pathname === '/sw.js' || pathname === '/sw-v3.js') {
      response.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      response.end(worker);
      return;
    }

    if (pathname === '/sw-v2.js') {
      response.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      response.end(v2Worker);
      return;
    }

    if (pathname === '/icons/icon-512.png') {
      response.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=14400',
      });
      response.end(icon);
      return;
    }

    if (pathname === '/manifest.json') {
      response.writeHead(200, {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=14400',
      });
      response.end(manifest);
      return;
    }

    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': pathname === '/offline' ? 'public, max-age=0' : 'no-store',
    });
    response.end(offlineHtml);
  });

  await new Promise<void>((resolve, reject) => {
    fixtureServer?.once('error', reject);
    fixtureServer?.listen(4319, '127.0.0.1', resolve);
  });
});

test.afterAll(async () => {
  if (!fixtureServer) return;
  await new Promise<void>((resolve, reject) => {
    fixtureServer?.close((error) => error ? reject(error) : resolve());
  });
});

test('installs the worker and serves safe offline guidance without protected HTML caches', async ({ page, context, request }) => {
  const workerResponse = await request.get('/sw.js');
  expect(workerResponse.status()).toBe(200);
  expect(workerResponse.headers()['content-type'].toLowerCase()).toBe('application/javascript; charset=utf-8');

  await page.goto('/offline', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retry connection' })).toBeVisible();

  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    const cacheKeys = await caches.keys();
    await Promise.all(
      cacheKeys
        .filter((key) => key.startsWith('conferly-'))
        .map((key) => caches.delete(key))
    );
  });

  await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.active?.state;
  }), { timeout: 15_000 }).toBe('activated');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const runtimeAssetUrl = new URL(`/icons/icon-512.png?ir003b=${Date.now()}`, page.url()).href;
  const networkFetch = await page.evaluate(async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    return {
      ok: response.ok,
      status: response.status,
      bodyLength: (await response.arrayBuffer()).byteLength,
    };
  }, runtimeAssetUrl);

  expect(networkFetch.status).toBe(200);
  expect(networkFetch.ok).toBe(true);
  expect(networkFetch.bodyLength).toBeGreaterThan(0);

  await expect.poll(() => page.evaluate(async (url) => {
    const cache = await caches.open('conferly-runtime-v3');
    return (await cache.keys()).some((entry) => entry.url === url);
  }, runtimeAssetUrl)).toBe(true);

  const runtimeCacheUrls = await page.evaluate(async () => {
    const cache = await caches.open('conferly-runtime-v3');
    return (await cache.keys()).map((entry) => entry.url);
  });
  expect(runtimeCacheUrls).toContain(runtimeAssetUrl);

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.goto('/meet/rooms/test', { waitUntil: 'domcontentloaded' });

  const cachedBeforeOffline = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = (await Promise.all(keys.map(async (key) => {
      const cache = await caches.open(key);
      return (await cache.keys()).map((entry) => new URL(entry.url).pathname);
    }))).flat();
    return { keys, urls };
  });

  expect(cachedBeforeOffline.urls).toContain('/offline');
  expect(cachedBeforeOffline.urls).not.toContain('/');
  expect(cachedBeforeOffline.urls).not.toContain('/dashboard');
  expect(cachedBeforeOffline.urls).not.toContain('/meet/rooms/test');
  expect(cachedBeforeOffline.keys).not.toContain('conferly-v2');
  expect(cachedBeforeOffline.keys).not.toContain('conferly-runtime-v2');

  await context.setOffline(true);
  const offlineRuntimeFetch = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return {
      ok: response.ok,
      status: response.status,
      bodyLength: (await response.arrayBuffer()).byteLength,
    };
  }, runtimeAssetUrl);
  expect(offlineRuntimeFetch.status).toBe(200);
  expect(offlineRuntimeFetch.ok).toBe(true);
  expect(offlineRuntimeFetch.bodyLength).toBe(networkFetch.bodyLength);

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
  await expect(page).not.toHaveURL(/\/offline$/);
  await context.setOffline(false);
});

test('upgrades an existing v2 worker and removes every obsolete Conferly cache', async ({ page }) => {
  test.skip(Boolean(externalBaseURL), 'The upgrade regression requires the deterministic local v2 and reviewed v3 fixtures.');

  await page.goto('/offline', { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
  });

  const expectedV2ScriptURL = new URL('/sw-v2.js', page.url()).href;
  const expectedV3ScriptURL = new URL('/sw-v3.js', page.url()).href;

  await page.evaluate(() => navigator.serviceWorker.register('/sw-v2.js', { scope: '/' }));
  await expect.poll(() => page.evaluate((expectedScriptURL) => {
    const controller = navigator.serviceWorker.controller;
    return controller?.scriptURL === expectedScriptURL && controller.state === 'activated';
  }, expectedV2ScriptURL), { timeout: 15_000 }).toBe(true);

  const seededKeys = await page.evaluate(async () => {
    const v1 = await caches.open('conferly-v1');
    await v1.put('/v1-sentinel', new Response('v1 sentinel'));
    const unrelated = await caches.open('unrelated-sentinel-cache');
    await unrelated.put('/sentinel', new Response('preserve me'));
    return (await caches.keys()).sort();
  });
  expect(seededKeys).toEqual(expect.arrayContaining([
    'conferly-v1',
    'conferly-v2',
    'conferly-runtime-v2',
    'unrelated-sentinel-cache',
  ]));

  await page.evaluate(() => navigator.serviceWorker.register('/sw-v3.js', { scope: '/' }));

  await expect.poll(() => page.evaluate(async (expectedScriptURL) => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const registration = registrations[0];
    const active = registration?.active;

    return {
      registrationCount: registrations.length,
      scope: registration?.scope ?? null,
      activeScriptURL: active?.scriptURL ?? null,
      activeState: active?.state ?? null,
      hasInstallingWorker: registration?.installing !== null,
      hasWaitingWorker: registration?.waiting !== null,
      activationComplete:
        registrations.length === 1 &&
        registration?.scope === new URL('/', location.href).href &&
        active?.scriptURL === expectedScriptURL &&
        active.state === 'activated' &&
        registration.installing === null &&
        registration.waiting === null,
    };
  }, expectedV3ScriptURL), { timeout: 15_000 }).toMatchObject({ activationComplete: true });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(async (expectedScriptURL) => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const registration = registrations[0];
    const active = registration?.active;
    const controller = navigator.serviceWorker.controller;

    return {
      complete:
        registrations.length === 1 &&
        registration?.scope === new URL('/', location.href).href &&
        active?.scriptURL === expectedScriptURL &&
        active.state === 'activated' &&
        registration.installing === null &&
        registration.waiting === null &&
        controller?.scriptURL === expectedScriptURL &&
        controller.state === 'activated',
    };
  }, expectedV3ScriptURL), { timeout: 15_000 }).toMatchObject({ complete: true });

  const runtimeAssetUrl = new URL(`/icons/icon-512.png?ir003c=${Date.now()}`, page.url()).href;
  await page.evaluate(async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to populate v3 runtime cache: ${response.status}`);
    await response.arrayBuffer();
  }, runtimeAssetUrl);
  await expect.poll(() => page.evaluate(async (url) => {
    const cache = await caches.open('conferly-runtime-v3');
    return (await cache.keys()).some((entry) => entry.url === url);
  }, runtimeAssetUrl)).toBe(true);

  const postActivation = await page.evaluate(async () => {
    const keys = (await caches.keys()).sort();
    const sentinel = await (await caches.open('unrelated-sentinel-cache')).match('/sentinel');
    return { keys, sentinelBody: await sentinel?.text() };
  });
  expect(postActivation.keys).not.toContain('conferly-v1');
  expect(postActivation.keys).not.toContain('conferly-v2');
  expect(postActivation.keys).not.toContain('conferly-runtime-v2');
  expect(postActivation.keys).toContain('conferly-v3');
  expect(postActivation.keys).toContain('conferly-runtime-v3');
  expect(postActivation.keys).toContain('unrelated-sentinel-cache');
  expect(postActivation.sentinelBody).toBe('preserve me');

  const v1RecreationSamples = await page.evaluate(async () => {
    const samples: Array<{ elapsedMs: number; present: boolean }> = [];
    const startedAt = performance.now();
    while (performance.now() - startedAt < 5_000) {
      samples.push({
        elapsedMs: Math.round(performance.now() - startedAt),
        present: (await caches.keys()).includes('conferly-v1'),
      });
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    samples.push({
      elapsedMs: Math.round(performance.now() - startedAt),
      present: (await caches.keys()).includes('conferly-v1'),
    });
    return samples;
  });
  expect(v1RecreationSamples.length).toBeGreaterThan(1);
  expect(v1RecreationSamples.at(-1)?.elapsedMs).toBeGreaterThanOrEqual(5_000);
  expect(v1RecreationSamples.every((sample) => !sample.present)).toBe(true);
});
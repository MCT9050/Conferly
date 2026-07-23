import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';

const externalBaseURL = process.env.BASE_URL;
const baseURL = externalBaseURL ?? 'http://127.0.0.1:4319';
let fixtureServer: Server | undefined;

test.use({ baseURL });

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

    if (pathname === '/sw.js') {
      response.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      response.end(worker);
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
  test.setTimeout(90_000);

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
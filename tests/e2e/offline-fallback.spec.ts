import { expect, test } from '@playwright/test';

test.use({ baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:3000' });

test('installs the worker and serves safe offline guidance without protected HTML caches', async ({ page, context, request }) => {
  test.setTimeout(90_000);

  const workerResponse = await request.get('/sw.js');
  expect(workerResponse.status()).toBe(200);
  expect(workerResponse.headers()['content-type'].toLowerCase()).toBe('application/javascript; charset=utf-8');

  await page.goto('/offline', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retry connection' })).toBeVisible();

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    await registration.update();
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

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
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
  await expect(page).not.toHaveURL(/\/offline$/);
  await context.setOffline(false);
});
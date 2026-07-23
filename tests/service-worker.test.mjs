import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const origin = 'https://conferly.site';
const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

function createHarness({ fetchImpl, onCacheOpen } = {}) {
  const listeners = new Map();
  const stores = new Map();
  const deleted = [];
  const fetchCalls = [];

  function cacheFor(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      match: async (request) => {
        const key = typeof request === 'string' ? new URL(request, origin).href : request.url;
        return store.get(key);
      },
      put: async (request, response) => {
        const key = typeof request === 'string' ? new URL(request, origin).href : request.url;
        store.set(key, response);
      },
      delete: async (request) => {
        const key = typeof request === 'string' ? new URL(request, origin).href : request.url;
        return store.delete(key);
      },
    };
  }

  const caches = {
    open: async (name) => {
      onCacheOpen?.(name);
      return cacheFor(name);
    },
    keys: async () => [...stores.keys()],
    delete: async (name) => {
      deleted.push(name);
      return stores.delete(name);
    },
    match: async (request) => {
      const key = typeof request === 'string' ? new URL(request, origin).href : request.url;
      for (const store of stores.values()) {
        if (store.has(key)) return store.get(key);
      }
      return undefined;
    },
  };

  const self = {
    location: { origin },
    addEventListener: (type, listener) => listeners.set(type, listener),
    skipWaiting: () => undefined,
    clients: { claim: () => undefined },
  };

  const context = vm.createContext({
    self,
    caches,
    Request,
    Response,
    URL,
    console,
    fetch: async (request) => {
      fetchCalls.push(request);
      if (fetchImpl) return fetchImpl(request);
      return new Response(`network:${new URL(request.url).pathname}`);
    },
  });
  vm.runInContext(source, context, { filename: 'public/sw.js' });

  async function dispatchExtendable(type) {
    const pending = [];
    listeners.get(type)({ waitUntil: (promise) => pending.push(promise) });
    await Promise.all(pending);
  }

  async function dispatchFetch(request) {
    const pending = [];
    let responsePromise;
    listeners.get('fetch')({
      request,
      respondWith: (promise) => { responsePromise = Promise.resolve(promise); },
      waitUntil: (promise) => pending.push(promise),
    });
    const response = responsePromise ? await responsePromise : undefined;
    await Promise.all(pending);
    return response;
  }

  return { stores, deleted, fetchCalls, dispatchExtendable, dispatchFetch };
}

function request(path, options = {}) {
  const { navigation = false, ...requestOptions } = options;
  const value = new Request(`${origin}${path}`, requestOptions);
  if (!navigation) return value;

  return new Proxy(value, {
    get(target, property) {
      if (property === 'mode') return 'navigate';
      if (property === 'destination') return 'document';
      const result = Reflect.get(target, property, target);
      return typeof result === 'function' ? result.bind(target) : result;
    },
  });
}

test('/offline is pre-cached and the home page is not', async () => {
  const harness = createHarness();
  await harness.dispatchExtendable('install');

  const precache = harness.stores.get('conferly-v3');
  assert.ok(precache.has(`${origin}/offline`));
  assert.equal(precache.has(`${origin}/`), false);
});

test('failed navigation returns /offline rather than /', async () => {
  const harness = createHarness({
    fetchImpl: async (value) => {
      if (new URL(value.url).pathname === '/dashboard') throw new TypeError('offline');
      return new Response(`network:${new URL(value.url).pathname}`);
    },
  });
  await harness.dispatchExtendable('install');

  const response = await harness.dispatchFetch(request('/dashboard', { navigation: true }));
  assert.equal(await response.text(), 'network:/offline');
});

test('protected navigation HTML is never stored', async () => {
  const harness = createHarness({ fetchImpl: async () => new Response('protected html') });

  await harness.dispatchFetch(request('/dashboard', { navigation: true }));
  await harness.dispatchFetch(request('/meet/rooms/test', { navigation: true }));

  assert.equal(harness.stores.get('conferly-v3')?.size ?? 0, 0);
  assert.equal(harness.stores.get('conferly-runtime-v3')?.size ?? 0, 0);
});

test('/api responses do not enter runtime cache', async () => {
  const harness = createHarness({ fetchImpl: async () => new Response('{}') });
  const response = await harness.dispatchFetch(request('/api/user/avatar.png'));

  assert.equal(response, undefined);
  assert.equal(harness.fetchCalls.length, 0);
  assert.equal(harness.stores.size, 0);
});

test('/_next/static resources are eligible for safe runtime caching', async () => {
  const operations = [];
  const networkResponse = new Response('static', {
    headers: { 'Cache-Control': 'public, max-age=31536000' },
  });
  const originalClone = networkResponse.clone.bind(networkResponse);
  networkResponse.clone = () => {
    operations.push('clone');
    return originalClone();
  };
  const harness = createHarness({
    fetchImpl: async () => {
      // Ignore the cache lookup open; only compare clone timing with the write open.
      operations.length = 0;
      return networkResponse;
    },
    onCacheOpen: (name) => {
      if (name === 'conferly-runtime-v3') operations.push('open');
    },
  });
  const response = await harness.dispatchFetch(request('/_next/static/chunks/app.js'));

  assert.equal(response, networkResponse);
  assert.deepEqual(operations, ['clone', 'open']);
  assert.ok(harness.stores.get('conferly-runtime-v3').has(`${origin}/_next/static/chunks/app.js`));
  assert.equal(harness.fetchCalls[0].credentials, 'omit');
});

for (const [label, headers] of [
  ['Set-Cookie', { 'Set-Cookie': 'session=secret' }],
  ['private', { 'Cache-Control': 'private, max-age=60' }],
  ['no-store', { 'Cache-Control': 'no-store' }],
]) {
  test(`responses marked ${label} are not cached`, async () => {
    const harness = createHarness({ fetchImpl: async () => new Response('asset', { headers }) });
    await harness.dispatchFetch(request(`/_next/static/${label}.js`));

    assert.equal(harness.stores.get('conferly-runtime-v3')?.size ?? 0, 0);
  });
}

for (const [label, response] of [
  ['redirect', Response.redirect(`${origin}/icons/redirected.png`, 302)],
  ['non-OK', new Response('missing', { status: 404 })],
  ['opaque', new Proxy(new Response('opaque'), {
    get(target, property) {
      if (property === 'type') return 'opaque';
      const result = Reflect.get(target, property, target);
      return typeof result === 'function' ? result.bind(target) : result;
    },
  })],
]) {
  test(`${label} responses are not cached`, async () => {
    const harness = createHarness({ fetchImpl: async () => response });
    await harness.dispatchFetch(request(`/_next/static/${label}.js`));

    assert.equal(harness.stores.get('conferly-runtime-v3')?.size ?? 0, 0);
  });
}

test('RSC and Next.js data requests do not enter runtime cache', async () => {
  for (const value of [
    request('/_next/static/chunks/app.js?_rsc=unique'),
    request('/_next/static/chunks/app.js', { headers: { RSC: '1' } }),
    request('/_next/static/chunks/app.js', { headers: { 'Next-Router-State-Tree': 'state' } }),
  ]) {
    const harness = createHarness({ fetchImpl: async () => new Response('private data') });
    const response = await harness.dispatchFetch(value);

    assert.equal(response, undefined);
    assert.equal(harness.fetchCalls.length, 0);
    assert.equal(harness.stores.size, 0);
  }
});

test('activation removes old Conferly caches and preserves unrelated caches', async () => {
  const harness = createHarness();
  harness.stores.set('conferly-v2', new Map());
  harness.stores.set('conferly-runtime-v2', new Map());
  harness.stores.set('other-app-v1', new Map());
  harness.stores.set('conferly-v3', new Map());

  await harness.dispatchExtendable('activate');

  assert.deepEqual(harness.deleted.sort(), ['conferly-runtime-v2', 'conferly-v2']);
  assert.ok(harness.stores.has('other-app-v1'));
  assert.ok(harness.stores.has('conferly-v3'));
});

test('the application registers /sw.js', async () => {
  const registration = await readFile(new URL('../components/ServiceWorkerRegistration.tsx', import.meta.url), 'utf8');
  assert.match(registration, /navigator\.serviceWorker\.register\(['"]\/sw\.js['"]\)/);
});

test('VR-002 /sw.js header contract remains unchanged', async () => {
  const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const swRule = vercel.headers.find((rule) => rule.source === '/sw.js');
  assert.deepEqual(swRule, {
    source: '/sw.js',
    headers: [
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
    ],
  });
});
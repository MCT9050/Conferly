// Conferly Service Worker — install support with safe offline guidance only.
// Authentication, dashboards, classrooms, and live meetings remain network-only.

const CACHE_VERSION = 'v3';
const CACHE_NAME = `conferly-${CACHE_VERSION}`;
const RUNTIME_CACHE = `conferly-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

const PRE_CACHE = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-512.png',
];

const PROTECTED_PATH_PATTERNS = [
  /^\/api(?:\/|$)/,
  /^\/auth(?:\/|$)/,
  /^\/signin(?:\/|$)/,
  /^\/dashboard(?:\/|$)/,
  /^\/meet(?:\/|$)/,
  /^\/meeting(?:\/|$)/,
  /^\/lobby(?:\/|$)/,
  /^\/class(?:\/|$)/,
  /^\/admin(?:\/|$)/,
];

const SAFE_STATIC_PATH_PATTERNS = [
  /^\/_next\/static\//,
  /^\/icons\//,
  /^\/images\//,
  /^\/(?:manifest\.json|favicon\.ico)$/,
  /\.(?:css|js|mjs|woff2?|ttf|otf|eot)$/i,
  /\.(?:png|jpe?g|gif|webp|svg|ico|avif)$/i,
];

function isProtectedPath(pathname) {
  return PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isNextDataRequest(request, url) {
  return (
    url.searchParams.has('_rsc') ||
    request.headers.get('rsc') === '1' ||
    request.headers.has('next-router-state-tree') ||
    request.headers.has('next-url') ||
    request.headers.has('next-router-prefetch')
  );
}

function isSafeStaticRequest(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (request.mode === 'navigate' || request.destination === 'document') return false;
  if (isProtectedPath(url.pathname) || isNextDataRequest(request, url)) return false;
  if (request.headers.has('authorization')) return false;

  return SAFE_STATIC_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

function isSafeCacheResponse(response) {
  if (!response || !response.ok || response.redirected) return false;
  if (response.type === 'opaque' || response.type === 'opaqueredirect') return false;
  if (response.headers.has('set-cookie')) return false;

  const cacheControl = (response.headers.get('cache-control') || '').toLowerCase();
  if (/\b(?:private|no-store)\b/.test(cacheControl)) return false;

  const vary = (response.headers.get('vary') || '').toLowerCase();
  if (/\b(?:cookie|authorization)\b/.test(vary)) return false;

  return true;
}

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

async function precacheOfflineResources() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(PRE_CACHE.map(async (url) => {
    const request = new Request(new URL(url, self.location.origin), {
      credentials: 'omit',
      cache: 'reload',
    });
    const response = await fetch(request);
    if (!isSafeCacheResponse(response)) {
      throw new Error(`Refusing to pre-cache an ineligible response: ${url}`);
    }
    await cache.put(url, response);
  }));
}

async function handleNavigation(request) {
  try {
    // Bypass the browser HTTP cache so an offline navigation cannot resolve to
    // previously stored protected HTML or an authentication redirect.
    return await fetch(new Request(request, { cache: 'no-store' }));
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const offlineResponse = await cache.match(OFFLINE_URL);
    return offlineResponse || new Response('You are offline.', {
      status: 503,
      statusText: 'Offline',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function handleStaticRequest(event) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(event.request);
  if (cached) return cached;

  const anonymousRequest = new Request(event.request, { credentials: 'omit' });
  const response = await fetch(anonymousRequest);
  return cacheStaticResponse(event, event.request, response);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheOfflineResources());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith('conferly-') && key !== CACHE_NAME && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  if (request.mode === 'navigate') {
    // Navigation HTML is always network-only. This prevents account, meeting,
    // authentication, and other dynamic pages from ever entering a SW cache.
    event.respondWith(handleNavigation(request));
    return;
  }

  // All non-navigation requests are network-owned unless they match the
  // explicit static allowlist and pass response-level privacy checks.
  if (isSafeStaticRequest(request)) {
    event.respondWith(handleStaticRequest(event));
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_INVALIDATE') {
    const { urls } = event.data;
    if (urls && Array.isArray(urls)) {
      event.waitUntil(
        caches.open(RUNTIME_CACHE).then((cache) => Promise.all(
          urls.map((url) => cache.delete(url))
        ))
      );
    }
  }

  if (event.data && event.data.type === 'CACHE_CLEAR') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('conferly-'))
          .map((key) => caches.delete(key))
      ))
    );
  }
});

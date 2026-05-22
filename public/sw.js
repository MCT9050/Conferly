// Conferly Service Worker — enables PWA install + offline shell
// Phase 12D: PWA & Offline Resilience - Versioned cache strategy

const CACHE_VERSION = 'v2';
const CACHE_NAME = `conferly-${CACHE_VERSION}`;
const OFFLINE_URL = '/';

// Assets to pre-cache on install
const PRE_CACHE = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/images/app-mockup.png',
];

// Runtime cache - dynamically cached resources
const RUNTIME_CACHE = `conferly-runtime-${CACHE_VERSION}`;

// Install: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRE_CACHE);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) =>
          key !== CACHE_NAME &&
          key !== RUNTIME_CACHE &&
          key.startsWith('conferly-')
        ).map((key) => caches.delete(key))
      );
    })
  );
  // Claim all clients so the SW is active right away
  self.clients.claim();
});

// Fetch: network-first with cache fallback, versioned cache strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (API calls, translation, etc.)
  if (!request.url.startsWith(self.location.origin)) return;

  // For navigation requests, use network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the response
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => {
          // Network failed — serve from cache
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // For static assets (images, icons, etc.), use cache-first with network fallback
  if (request.url.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Check if cache is stale (older than 24 hours)
          const cacheDate = cached.headers.get('date');
          if (cacheDate) {
            const cacheTime = new Date(cacheDate).getTime();
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            if (now - cacheTime > maxAge) {
              // Cache is stale, fetch from network
              return fetch(request).then((response) => {
                const clone = response.clone();
                caches.open(RUNTIME_CACHE).then((cache) => {
                  cache.put(request, clone);
                });
                return response;
              }).catch(() => cached);
            }
          }
          return cached;
        }
        // Not in cache, fetch from network
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        });
      })
    );
    return;
  }

  // For other requests, use network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone and cache the response
        const clone = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, clone);
        });
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

// Handle message from client (for cache invalidation)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_INVALIDATE') {
    // Invalidate specific cache entries
    const { urls } = event.data;
    if (urls && Array.isArray(urls)) {
      event.waitUntil(
        caches.open(RUNTIME_CACHE).then((cache) => {
          return Promise.all(
            urls.map(url => cache.delete(url))
          );
        })
      );
    }
  }

  if (event.data && event.data.type === 'CACHE_CLEAR') {
    // Clear all caches
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => caches.delete(key))
        );
      })
    );
  }
});

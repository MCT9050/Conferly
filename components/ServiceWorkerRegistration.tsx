"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !('serviceWorker' in navigator)) {
      return;
    }

    // Defer service worker registration until after the full page load
    // to avoid competing for network & CPU during the critical rendering path.
    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('Service worker registered');
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    const onLoad = () => {
      // register asynchronously after load
      registerServiceWorker();
    };

    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad, { once: true });
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);

  return null;
}

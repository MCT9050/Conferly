"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !('serviceWorker' in navigator)) {
      return;
    }

    // Defer service worker registration until the browser is idle and the
    // document is in a stable state. Using requestIdleCallback avoids the
    // "InvalidStateError: The document is in an invalid state" that can
    // occur in Next.js 16 when registration is attempted during hydration.
    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('Service worker registered');
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    const scheduleRegistration = () => {
      // Use requestIdleCallback if available, fall back to setTimeout
      if ('requestIdleCallback' in window) {
        requestIdleCallback(
          () => {
            registerServiceWorker();
          },
          { timeout: 5000 }
        );
      } else {
        // Fallback to a generous delay for older browsers
        setTimeout(() => {
          registerServiceWorker();
        }, 3000);
      }
    };

    // Wait for the document to be fully interactive before scheduling
    if (document.readyState === 'complete') {
      scheduleRegistration();
    } else {
      // Use DOMContentLoaded for a more reliable ready-state than 'load'
      const onReady = () => {
        scheduleRegistration();
      };
      document.addEventListener('DOMContentLoaded', onReady, { once: true });
      return () => document.removeEventListener('DOMContentLoaded', onReady);
    }
  }, []);

  return null;
}
import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'conferly_install_dismissed';

// Safe localStorage access with SSR guard
function getDismissedTime(): number | null {
  if (typeof localStorage === 'undefined') return null;
  const value = localStorage.getItem(DISMISSED_KEY);
  if (!value) return null;
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

function setDismissedTime(time: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DISMISSED_KEY, time.toString());
}

// Safe navigator access
function getUserAgent(): string {
  return typeof navigator !== 'undefined' ? navigator.userAgent : '';
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Guard: must be in browser
    if (typeof window === 'undefined') return;

    // Check standalone mode
    const ua = getUserAgent();
    if (window.matchMedia?.('(display-mode: standalone)')?.matches || 
        (navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Check localStorage
    const dismissed = getDismissedTime();
    if (dismissed && Date.now() - dismissed < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    });

    // iOS delayed banner
    if (/iPad|iPhone|iPod/.test(ua) && !isInstalled) {
      setTimeout(() => setShowBanner(true), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [isInstalled]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setShowBanner(false);
    setDismissedTime(Date.now());
  }, []);

  const ua = getUserAgent();
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const canInstallNatively = !!deferredPrompt;

  return {
    showBanner: showBanner && !isInstalled,
    isInstalled,
    isIOS,
    canInstallNatively,
    install,
    dismiss,
  };
}

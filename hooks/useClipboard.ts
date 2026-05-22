"use client";

import { useCallback, useState } from 'react';

/**
 * Isolates navigator.clipboard API
 * Provides copy-to-clipboard functionality with success feedback
 */
export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = useCallback(async (text: string) => {
    if (typeof window === 'undefined' || !navigator?.clipboard) {
      setError('Clipboard API not available in this browser');
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(null);
      
      // Reset copied state after 2 seconds
      const timeout = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timeout);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to copy to clipboard';
      setError(msg);
      return false;
    }
  }, []);

  return { copy, copied, error };
}

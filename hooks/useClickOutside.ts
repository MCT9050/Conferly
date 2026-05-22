"use client";

import { useEffect, RefObject } from 'react';

/**
 * Isolates document event listener API
 * Detects clicks outside a referenced element and calls callback
 * Commonly used for dropdown menus, modals, etc.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  callback: () => void
) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, callback]);
}

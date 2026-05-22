"use client";

import { useCallback } from 'react';

/**
 * Isolates document.getElementById and element.scrollIntoView APIs
 * Provides smooth scrolling to elements by ID
 */
export function useScrollToId() {
  return useCallback((id: string) => {
    if (typeof document === 'undefined') return;

    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);
}

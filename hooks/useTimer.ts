"use client";

import { useCallback, useEffect, useState } from 'react';

/**
 * Isolates window.setInterval and window.setTimeout APIs
 * Provides controlled timer functionality for meeting duration tracking
 */
export function useTimer(interval = 1000, autoStart = true) {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(autoStart);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setElapsed(current => current + 1);
    }, interval);

    return () => window.clearInterval(timer);
  }, [isRunning, interval]);

  const pause = useCallback(() => setIsRunning(false), []);
  const resume = useCallback(() => setIsRunning(true), []);
  const reset = useCallback(() => {
    setElapsed(0);
    setIsRunning(false);
  }, []);

  return { elapsed, isRunning, pause, resume, reset, setElapsed };
}

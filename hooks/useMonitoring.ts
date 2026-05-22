// hooks/useMonitoring.ts
// React hook for Conferly monitoring integration

import { useEffect, useRef } from 'react';
import { addMonitoringHandler, removeMonitoringHandler, MonitoringEvent } from '../lib/monitoring';

export function useMonitoring(onEvent?: (event: MonitoringEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!handlerRef.current) return;
    const handler = (event: MonitoringEvent) => handlerRef.current?.(event);
    addMonitoringHandler(handler);
    return () => removeMonitoringHandler(handler);
  }, []);
}

// Usage:
// useMonitoring(event => { ... });

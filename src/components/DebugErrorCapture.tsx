/**
 * GLOBAL RUNTIME ERROR CAPTURE SYSTEM
 * Captures all runtime errors, unhandled rejections, and React errors
 */

// Store for captured errors
window.__RUNTIME_ERRORS__ = window.__RUNTIME_ERRORS__ || [];

// 1. window.onerror - catches runtime errors
window.onerror = (message, source, lineno, colno, error) => {
  const errorInfo = {
    type: 'uncaught_error',
    message: String(message),
    source,
    lineno,
    colno,
    stack: error?.stack,
    timestamp: Date.now(),
    userAgent: navigator.userAgent
  };
  window.__RUNTIME_ERRORS__.push(errorInfo);
  console.error('[RUNTIME_ERROR]', errorInfo);
  return false; // Let default handling also happen
};

// 2. window.onunhandledrejection - catches async errors
window.onunhandledrejection = (event) => {
  const errorInfo = {
    type: 'unhandled_rejection',
    message: event.reason?.message || String(event.reason),
    stack: event.reason?.stack,
    timestamp: Date.now()
  };
  window.__RUNTIME_ERRORS__.push(errorInfo);
  console.error('[UNHANDLED_REJECTION]', event.reason);
};

// 3. Interceptor for console.error
const originalConsoleError = console.error;
console.error = (...args) => {
  // Check for React error patterns
  const message = args[0];
  if (message && typeof message === 'string') {
    if (message.includes('Error:') || message.includes('before initialization') || message.includes('Cannot read')) {
      const errorInfo = {
        type: 'console_error',
        message: args.map(a => String(a)).join(' '),
        timestamp: Date.now()
      };
      window.__RUNTIME_ERRORS__.push(errorInfo);
    }
  }
  originalConsoleError.apply(console, args);
};

console.log('[ERROR_CAPTURE] System initialized', Date.now());
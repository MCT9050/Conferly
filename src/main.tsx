import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// ============================================
// IMPORT VALIDATION
// ============================================

// Validate App was loaded
if (!App || typeof App !== 'function') {
  throw new Error(`App import failed - got: ${typeof App}`);
}
console.log('✅ App imported:', typeof App);

// ============================================
// GLOBAL ERROR CAPTURE - FORCE ALL ERRORS VISIBLE
// ============================================

// 1. Force development mode errors in console
const originalConsoleError = console.error;
console.error = function(...args) {
  // Detect minified React errors and expand them
  const message = args[0];
  if (typeof message === 'string' && message.includes('Minified React error #')) {
    console.group('🚨 MINIFIED REACT ERROR DETECTED');
    console.error('Full Error:', message);
    console.error('Stack:', new Error().stack);
    console.error('Args:', args.slice(1));
    console.groupEnd();
  }
  // @ts-ignore
  originalConsoleError.apply(console, args);
};

// 2. Global JS error handler
window.onerror = function(message, source, lineno, colno, error) {
  console.group('🚨 GLOBAL JS ERROR');
  console.error('Message:', message);
  console.error('Source:', source);
  console.error('Line:', lineno, 'Col:', colno);
  console.error('Error object:', error);
  console.error('Stack:', error?.stack);
  console.groupEnd();
  return false; // Allow default handling
};

// 3. Unhandled promise rejection
window.onunhandledrejection = function(event) {
  console.group('🚨 UNHANDLED PROMISE REJECTION');
  console.error('Reason:', event.reason);
  console.error('Stack:', event.reason?.stack);
  console.groupEnd();
};

// 4. Version tracking for stale bundle detection
const BUNDLE_VERSION = '1.0.2'; // Update this on each deploy
window.__APP_VERSION__ = BUNDLE_VERSION;
console.log('🔥 APP VERSION:', BUNDLE_VERSION, '| Timestamp:', Date.now());

// Check if the loaded bundle matches expected hash (dynamic - extract from current script src)
(() => {
  const script = document.querySelector('script[type="module"][crossorigin]');
  const src = script?.getAttribute('src') || '';
  const match = src.match(/index-([a-zA-Z0-9]+)\.js/);
  if (match) {
    console.log('📦 Bundle hash:', match[1]);
  }
})();

// ============================================
// RENDER APP
// ============================================

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(<App />);

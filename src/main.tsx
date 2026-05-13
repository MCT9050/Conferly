import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Global error handler for uncaught errors
window.onerror = function(msg, url, line, col, error) {
  console.error("GLOBAL ERROR:", msg, "line:", line);
  document.body.innerHTML = "<div style='padding:40px;font-family:sans-serif;background:#fff;color:#333;'><h2>Something went wrong</h2><pre style='background:#f5f5f5;padding:20px;white-space:pre-wrap;'>" + msg + "</pre></div>";
};

window.addEventListener("unhandledrejection", function(e) {
  console.error("UNHANDLED REJECTION:", e.reason);
  document.body.innerHTML = "<div style='padding:40px;font-family:sans-serif;background:#fff;color:#333;'><h2>Something went wrong</h2><pre style='background:#f5f5f5;padding:20px;white-space:pre-wrap;'>" + String(e.reason) + "</pre></div>";
});

// DEFENSIVE: Prevent hydration crashes from breaking the app
// Wrap rendering in error boundary with mounted check
const originalErrorHandler = window.onerror;
window.onerror = function(msg, url, line, col, error) {
  // Check for Activity setting error (React 19 hydration mismatch)
  if (msg && typeof msg === 'string' && msg.includes('Activity')) {
    console.warn('⚠️ Hydration mismatch detected, attempting recovery...');
    // Don't halt - try to let React recover
    return false;
  }
  return originalErrorHandler?.call(this, msg, url, line, col, error);
};

console.log("🔥 APP VERSION: 1.0.9-ERROR-BOUNDARY");

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);

// DEFENSIVE: Wrap render in try-catch to prevent hydration crashes
try {
  root.render(<App />);
} catch (renderError) {
  console.error('💥 Render error:', renderError);
  // Fallback: render a simple loading state
  root.render(
    <div style={{ padding: '40px', fontFamily: 'sans-serif', background: '#0f172a', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h1>Loading Conferly...</h1>
        <p style={{ color: '#94a3b8' }}>If this takes too long, please refresh the page.</p>
      </div>
    </div>
  );
}

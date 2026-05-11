import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.simple";

console.log('🔥 APP VERSION: 1.0.3-dev');

// Global error handling
window.onerror = (message, source, lineno, colno, error) => {
  console.error('🚨 GLOBAL JS ERROR:', message);
  console.error('Source:', source, 'Line:', lineno);
  return false;
};

window.onunhandledrejection = (event) => {
  console.error('🚨 UNHANDLED REJECTION:', event.reason);
};

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found');
}

// Render with error boundary
try {
  const root = createRoot(rootElement);
  root.render(<App />);
} catch (e: any) {
  console.error('Render error:', e);
  rootElement.innerHTML = '<div class="p-8 text-white"><h1>Error</h1><pre class="mt-4">' + e.message + '</pre></div>';
}

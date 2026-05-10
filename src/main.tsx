import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// Global error handling - catch rendering errors
window.onerror = (message, source, lineno, colno, error) => {
  console.error('🚨 GLOBAL JS ERROR:', message);
  console.error('Source:', source);
  console.error('Line:', lineno, 'Col:', colno);
  console.error('Error:', error);
  return false;
};

// Handle unhandled promise rejections
window.onunhandledrejection = (event) => {
  console.error('🚨 UNHANDLED REJECTION:', event.reason);
};

// Try-catch wrapper for rendering
let App;
try {
  const AppModule = require('./App.simple');
  App = AppModule.default;
} catch (e) {
  console.error('Failed to load App:', e);
  App = () => React.createElement('div', { className: 'p-4' }, 'Error loading app');
}

console.log('🔥 APP VERSION: 1.0.3-dev');

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found');
}

// Wrap render in try-catch
try {
  const root = createRoot(rootElement);
  root.render(React.createElement(App));
} catch (e) {
  console.error('Render error:', e);
  rootElement.innerHTML = '<div class="p-8"><h1>Error</h1><p>' + e.message + '</p></div>';
}

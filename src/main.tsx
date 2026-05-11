import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.simple";

console.log('🔥 APP VERSION: 1.0.4-min');

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found');
}

// Simpler render
const root = createRoot(rootElement);
root.render(<App />);

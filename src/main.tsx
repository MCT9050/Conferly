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

console.log("🔥 APP VERSION: 1.0.9-ERROR-BOUNDARY");

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);
root.render(<App />);

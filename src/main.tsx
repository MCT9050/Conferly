import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

console.log("🔥 APP VERSION: 1.0.6-FIX-CACHE");

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);
root.render(<App />);
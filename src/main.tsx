import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import MobileErrorBoundary from "./components/MobileErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MobileErrorBoundary>
      <App />
    </MobileErrorBoundary>
  </StrictMode>
);

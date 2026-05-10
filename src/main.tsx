import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import MobileErrorBoundary from "./components/MobileErrorBoundary";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <MobileErrorBoundary>
      <App />
    </MobileErrorBoundary>
  );
}

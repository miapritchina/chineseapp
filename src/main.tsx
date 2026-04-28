import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

// On-page error overlay. Mobile users can't open dev tools, so when the app
// blanks out we want the actual error visible on the page itself. Captures:
//   - Synchronous render errors (via the ErrorBoundary below)
//   - window.onerror (uncaught exceptions outside React)
//   - unhandledrejection (broken promises)
function showError(label: string, err: unknown) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ""}` : String(err);
  let box = document.getElementById("error-overlay");
  if (!box) {
    box = document.createElement("div");
    box.id = "error-overlay";
    box.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:#fff8e1;color:#7a3b00;" +
      "font:13px/1.4 ui-monospace,Menlo,monospace;padding:16px;overflow:auto;" +
      "white-space:pre-wrap;word-break:break-word;";
    document.body.appendChild(box);
  }
  box.textContent = `${label}\n\n${msg}\n\n${box.textContent ?? ""}`.slice(0, 8000);
}

window.addEventListener("error", (e) => showError("window error", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => showError("unhandled rejection", e.reason));

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { err: unknown }
> {
  state = { err: null as unknown };
  static getDerivedStateFromError(err: unknown) {
    return { err };
  }
  componentDidCatch(err: unknown) {
    showError("react render error", err);
  }
  render() {
    if (this.state.err) return null; // overlay handles display
    return this.props.children;
  }
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

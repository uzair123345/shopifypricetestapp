import { startTransition, StrictMode } from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import { RemixBrowser } from "@remix-run/react";

function hydrate() {
  startTransition(() => {
    try {
      hydrateRoot(document, <StrictMode><RemixBrowser /></StrictMode>);
    } catch (error) {
      console.warn("Hydration mismatch, switching to client render.", error);
      const container = document.documentElement;
      const root = createRoot(container);
      root.render(<StrictMode><RemixBrowser /></StrictMode>);
    }
  });
}

if (window.requestIdleCallback) {
  window.requestIdleCallback(hydrate);
} else {
  window.setTimeout(hydrate, 1);
}



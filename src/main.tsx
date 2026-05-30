import React from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import "./styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found");
}

if (!convexUrl) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <main className="boot-error">
        <div>
          <p className="boot-error__eyebrow">Convex not configured</p>
          <h1>Add VITE_CONVEX_URL to .env.local</h1>
          <p>
            Run <code>npx convex dev</code> from this directory to provision a
            deployment, then restart the dev server.
          </p>
        </div>
      </main>
    </React.StrictMode>,
  );
} else {
  const convex = new ConvexReactClient(convexUrl);
  createRoot(rootElement).render(
    <React.StrictMode>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </React.StrictMode>,
  );
}

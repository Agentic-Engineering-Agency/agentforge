import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { routeTree } from "./routeTree.gen";
import "./styles/globals.css";

// Create router
const router = createRouter({ routeTree });

// Type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Initialize Convex client
const convexUrl =
  (import.meta as any).env?.VITE_CONVEX_URL ||
  "https://hip-cardinal-943.convex.cloud";
const convex = new ConvexReactClient(convexUrl);

// Render
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ConvexProvider client={convex}>
        <RouterProvider router={router} />
      </ConvexProvider>
    </React.StrictMode>
  );
}

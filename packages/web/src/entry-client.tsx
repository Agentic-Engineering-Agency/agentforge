import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/start";
import { createRouter } from "./router";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL || "https://hip-cardinal-943.convex.cloud"
);
const router = createRouter();

hydrateRoot(
  document.getElementById("root")!,
  <ConvexProvider client={convex}>
    <StartClient router={router} />
  </ConvexProvider>
);

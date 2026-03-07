import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

function resolveConvexRoot(): string {
  const candidates = [
    path.resolve(__dirname, "../convex"),
    path.resolve(__dirname, "../../convex"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@convex": resolveConvexRoot(),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

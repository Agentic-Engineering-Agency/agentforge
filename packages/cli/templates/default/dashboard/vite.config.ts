import fs from "node:fs";
import { defineConfig, loadEnv } from "vite";
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
  const convexRoot = resolveConvexRoot();
  const envDir = path.dirname(convexRoot);
  const env = loadEnv("", envDir, "");
  const convexUrl = env.VITE_CONVEX_URL || env.CONVEX_URL || "";

  return {
    envDir,
    plugins: [react(), tsconfigPaths()],
    resolve: {
      alias: {
        "@convex": convexRoot,
      },
    },
    define: {
      "import.meta.env.VITE_CONVEX_URL": JSON.stringify(convexUrl),
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
  };
});

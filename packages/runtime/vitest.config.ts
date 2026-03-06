import { defineConfig } from "vitest/config";
import path from "node:path";

const runtimeDir = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: {
      "@agentforge-ai/core": path.resolve(runtimeDir, "../core/src"),
      "@agentforge-ai/cli": path.resolve(runtimeDir, "../cli/src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: [path.join(runtimeDir, "**/*.test.ts")],
    testTimeout: 30_000,
  },
});

import { defineConfig } from 'vitest/config';
import path from 'node:path';

const convexDir = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: {
      '@agentforge-ai/core': path.resolve(convexDir, '../packages/core/src'),
      '@agentforge-ai/cli': path.resolve(convexDir, '../packages/cli/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [path.join(convexDir, '**/*.test.ts')],
    testTimeout: 30_000,
  },
});

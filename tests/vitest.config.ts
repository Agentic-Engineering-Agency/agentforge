import { defineConfig } from 'vitest/config';
import path from 'node:path';

const testsDir = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: [
      { find: '@agentforge-ai/core', replacement: path.resolve(testsDir, '../packages/core/src') },
      { find: /^@agentforge-ai\/cli\/src\/(.*)\.js$/, replacement: path.resolve(testsDir, '../packages/cli/src/$1.ts') },
      { find: /^@agentforge-ai\/cli\/src/, replacement: path.resolve(testsDir, '../packages/cli/src') },
      { find: '@agentforge-ai/cli', replacement: path.resolve(testsDir, '../packages/cli/src') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      path.join(testsDir, '*.test.ts'),
      path.join(testsDir, 'e2e/**/*.test.ts'),
    ],
    testTimeout: 120_000,
  },
});

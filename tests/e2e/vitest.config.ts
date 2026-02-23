import { defineConfig } from 'vitest/config';
import path from 'node:path';

const e2eDir = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: {
      '@agentforge-ai/core': path.resolve(e2eDir, '../../packages/core/src'),
      '@agentforge-ai/cli/src': path.resolve(e2eDir, '../../packages/cli/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [path.join(e2eDir, '**/*.test.ts')],
    testTimeout: 120_000, // E2E tests may take longer
    hookTimeout: 60_000,
    // Setup runs pre-flight checks for Cloud connectivity.
    // Skipped for local-only test runs (they handle Cloud absence gracefully).
    // setupFiles: [path.join(e2eDir, 'helpers/setup.ts')],

    // Run E2E tests sequentially — they share cloud state
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    // Resolve @agentforge-ai/* imports to source
    alias: {
      '@agentforge-ai/core': path.resolve(e2eDir, '../../packages/core/src'),
      '@agentforge-ai/cli/src': path.resolve(e2eDir, '../../packages/cli/src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'packages/core/src/**/*.ts',
        'packages/cli/src/**/*.ts',
        'convex/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        '**/node_modules/**',
      ],
    },
    env: {
      NODE_ENV: 'test',
      E2E_TEST: '1',
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: [
        'src/convex-agent.ts',
        'src/convex-mcp-server.ts',
        'src/convex-vault.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/types.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});

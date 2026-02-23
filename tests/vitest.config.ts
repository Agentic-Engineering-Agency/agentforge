import { defineConfig } from 'vitest/config';
import path from 'node:path';

const testsDir = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [path.join(testsDir, '*.test.ts')],
    testTimeout: 30_000,
  },
});

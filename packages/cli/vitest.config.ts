import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@agentforge-ai/core/workspace',
        replacement: path.resolve(__dirname, '../core/src/workspace.ts'),
      },
      {
        find: '@agentforge-ai/core',
        replacement: path.resolve(__dirname, '../core/src/index.ts'),
      },
      {
        find: '@agentforge-ai/runtime',
        replacement: path.resolve(__dirname, '../runtime/src/index.ts'),
      },
    ],
  },
});

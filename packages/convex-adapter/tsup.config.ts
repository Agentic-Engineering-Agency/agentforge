import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/convex-agent.ts',
    'src/convex-mcp-server.ts',
    'src/convex-vault.ts',
    'src/types.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['convex', '@agentforge-ai/core', 'zod', 'node:crypto'],
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/agent.ts',
    'src/sandbox.ts',
    'src/mcp-server.ts',
  ],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'es2022',
  external: ['@mastra/core', '@e2b/code-interpreter'],
});

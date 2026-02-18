import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/docker-sandbox.ts',
    'src/container-pool.ts',
    'src/sandbox-manager.ts',
    'src/security.ts',
    'src/types.ts',
  ],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'node18',
  platform: 'node',
  external: [
    'dockerode',
    'node:path',
    'node:fs',
    'node:url',
    'node:crypto',
    'node:stream',
    'node:events',
    'node:os',
    'node:util',
    'node:net',
  ],
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'es2022',
  external: [
    '@mastra/core', '@mastra/core/agent', '@mastra/core/processors', '@mastra/core/llm',
    '@mastra/memory', '@mastra/convex',
    '@ai-sdk/moonshotai',
    'hono', 'hono/streaming', '@hono/node-server',
    'discord.js', 'grammy', 'jsdom',
    'zod',
    // Node builtins
    'node:path', 'node:fs', 'node:url', 'node:http', 'node:https', 'node:crypto',
    'node:child_process', 'node:os', 'node:stream', 'node:events', 'node:util',
    'path', 'fs', 'url', 'http', 'https', 'crypto', 'child_process', 'os', 'stream', 'events', 'util', 'net', 'tty',
  ],
});

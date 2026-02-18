import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/convex-agent.ts',
    'src/convex-mcp-server.ts',
    'src/convex-vault.ts',
    'src/model-resolver.ts',
    'src/types.ts',
    'src/provider-registry.ts',
    'src/failover-chain.ts',
  ],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'es2022',
  external: [
    '@mastra/core',
    'convex',
    'convex/values',
    'convex/server',
    '@agentforge-ai/core',
    '@ai-sdk/openai',
    '@ai-sdk/anthropic',
    '@ai-sdk/google',
    '@ai-sdk/openai-compatible',
    'ai',
    'zod',
  ],
});

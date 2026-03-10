import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/agent.ts',
    'src/sandbox.ts',
    'src/mcp-server.ts',
    'src/browser-tool.ts',
    'src/workspace.ts',
    'src/workspace-factory.ts',
    'src/providers/r2-provider.ts',
    'src/providers/s3-signer.ts',
    'src/channels/telegram.ts',
    'src/channels/whatsapp.ts',
    'src/voice/index.ts',
  ],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'es2022',
  external: ['@mastra/core', '@mastra/s3', '@e2b/code-interpreter', 'playwright', 'playwright-core', 'typescript'],
});

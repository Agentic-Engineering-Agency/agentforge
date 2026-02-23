import type { WorkspaceProvider, WorkspaceConfig } from './workspace.js';
import { LocalWorkspaceProvider } from './workspace.js';

export function createWorkspaceProvider(config: WorkspaceConfig): WorkspaceProvider {
  switch (config.type) {
    case 'local':
      return new LocalWorkspaceProvider(config.basePath ?? './workspace');
    case 'r2': {
      try {
        const { R2WorkspaceProvider } = require('./providers/r2-provider.js');
        return new R2WorkspaceProvider({
          bucket: config.bucket!,
          region: config.region ?? 'auto',
          accessKeyId: config.credentials?.accessKeyId,
          secretAccessKey: config.credentials?.secretAccessKey,
        });
      } catch {
        throw new Error(
          'R2 workspace provider not available. Check that @agentforge-ai/core is properly built.'
        );
      }
    }
    default:
      throw new Error(`Unknown workspace type: ${(config as WorkspaceConfig).type}`);
  }
}

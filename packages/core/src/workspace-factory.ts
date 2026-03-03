/**
 * @module workspace-factory
 * Creates workspace providers based on config or environment.
 */

import { LocalWorkspaceProvider, type WorkspaceConfig, type WorkspaceProvider } from './workspace.js';
import { R2WorkspaceProvider } from './providers/r2-provider.js';

export function createWorkspaceProvider(config: WorkspaceConfig = {}): WorkspaceProvider {
  const storage = config.storage ?? (process.env.AGENTFORGE_STORAGE as WorkspaceConfig['storage']) ?? 'local';

  switch (storage) {
    case 'local':
      return new LocalWorkspaceProvider(config.basePath ?? './workspace');
    case 'r2':
    case 's3':
      return new R2WorkspaceProvider({
        bucket: config.bucket ?? '',
        region: config.region,
        endpoint: config.endpoint,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      });
    default:
      throw new Error(`Unknown storage type: ${storage as string}`);
  }
}

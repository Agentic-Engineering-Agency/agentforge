/**
 * @module workspace/index
 *
 * Workspace factory with S3/R2 filesystem support.
 * Supports local, S3, and R2 storage backends via AGENTFORGE_STORAGE environment variable.
 */

import { LocalWorkspaceProvider } from '../workspace.js';
import { R2WorkspaceProvider } from '../providers/r2-provider.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// Re-export from parent for convenience (actual implementation is in workspace.ts)

export interface WorkspaceConfig {
  /** Storage backend type. Defaults to AGENTFORGE_STORAGE env var or 'local' */
  storage?: 'local' | 's3' | 'r2';
  /** Base path for local storage */
  basePath?: string;
  /** S3/R2 bucket name */
  bucket?: string;
  /** S3 region or 'auto' for R2 */
  region?: string;
  /** S3-compatible endpoint URL (required for R2) */
  endpoint?: string;
  /** Access key ID for S3/R2 */
  accessKeyId?: string;
  /** Secret access key for S3/R2 */
  secretAccessKey?: string;
}

export interface Workspace {
  read(path: string): Promise<string>;
  write(path: string, content: string | Buffer): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

/**
 * Creates a workspace with the specified storage backend.
 *
 * Storage type can be specified via:
 * - `config.storage` parameter
 * - `AGENTFORGE_STORAGE` environment variable
 * - Defaults to 'local'
 *
 * @param config - Workspace configuration
 * @returns A workspace instance with read/write/list/delete/exists methods
 *
 * @example
 * ```typescript
 * // Local workspace
 * const local = createWorkspace({ storage: 'local', basePath: './workspace' });
 *
 * // R2 workspace
 * const r2 = createWorkspace({
 *   storage: 'r2',
 *   bucket: 'my-bucket',
 *   endpoint: 'https://example.com',
 *   accessKeyId: 'key',
 *   secretAccessKey: 'secret',
 * });
 *
 * // S3 workspace
 * const s3 = createWorkspace({
 *   storage: 's3',
 *   bucket: 'my-bucket',
 *   region: 'us-east-1',
 *   accessKeyId: 'key',
 *   secretAccessKey: 'secret',
 * });
 * ```
 */
export function createWorkspace(config: WorkspaceConfig = {}): Workspace {
  // Determine storage type from config, env, or default
  const storage = config.storage ??
    process.env.AGENTFORGE_STORAGE as WorkspaceConfig['storage'] ??
    'local';

  switch (storage) {
    case 'local': {
      const provider = new LocalWorkspaceProvider(config.basePath ?? './workspace');
      return {
        read: (path) => provider.read(path),
        write: (path, content) => provider.write(path, content),
        list: (prefix) => provider.list(prefix),
        delete: (path) => provider.delete(path),
        exists: (path) => provider.exists(path),
      };
    }

    case 'r2': {
      const provider = new R2WorkspaceProvider({
        bucket: config.bucket ?? '',
        region: config.region ?? 'auto',
        endpoint: config.endpoint,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      });
      return {
        read: (path) => provider.read(path),
        write: (path, content) => provider.write(path, content),
        list: (prefix) => provider.list(prefix),
        delete: (path) => provider.delete(path),
        exists: (path) => provider.exists(path),
      };
    }

    case 's3': {
      // S3 uses the same R2 provider (S3-compatible)
      const provider = new R2WorkspaceProvider({
        bucket: config.bucket ?? '',
        region: config.region ?? 'us-east-1',
        endpoint: config.endpoint,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      });
      return {
        read: (path) => provider.read(path),
        write: (path, content) => provider.write(path, content),
        list: (prefix) => provider.list(prefix),
        delete: (path) => provider.delete(path),
        exists: (path) => provider.exists(path),
      };
    }

    default:
      throw new Error(`Unknown storage type: ${(storage as string)}`);
  }
}

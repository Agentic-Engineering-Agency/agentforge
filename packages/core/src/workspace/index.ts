/**
 * @module workspace/index
 *
 * Mastra-native Workspace factory with S3/R2 filesystem support.
 * Supports local, S3, and R2 storage backends via AGENTFORGE_STORAGE environment variable.
 *
 * @example
 * ```typescript
 * import { createWorkspace } from '@agentforge-ai/core/workspace';
 *
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
 * ```
 */

import { Workspace, LocalFilesystem, LocalSkillSource } from '@mastra/core/workspace';
import { S3Filesystem } from '@mastra/s3';

export interface WorkspaceConfig {
  /** Storage backend type. Defaults to AGENTFORGE_STORAGE env var or 'local' */
  storage?: 'local' | 's3' | 'r2';
  /** Base path for local storage */
  basePath?: string;
  /** Workspace-mounted skills paths (defaults to ['/skills']) */
  skillsPath?: string | string[];
  /** Local path backing the default /skills mount */
  skillsBasePath?: string;
  /** Enable BM25 search for indexed content */
  bm25?: boolean;
  /** Paths to auto-index on init */
  autoIndexPaths?: string[];
  /** Optional workspace name */
  name?: string;
  /** Optional search index name */
  searchIndexName?: string;

  // S3/R2 config
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

/**
 * Creates a Mastra-native Workspace with the specified storage backend.
 *
 * Storage type can be specified via:
 * - `config.storage` parameter
 * - `AGENTFORGE_STORAGE` environment variable
 * - Defaults to 'local'
 *
 * @param config - Workspace configuration
 * @returns A Mastra Workspace instance with filesystem and skills configured
 *
 * @example
 * ```typescript
 * // Local workspace with default paths
 * const local = createWorkspace();
 *
 * // Local workspace with custom base path
 * const customLocal = createWorkspace({
 *   storage: 'local',
 *   basePath: './my-workspace',
 *   skillsPath: '/custom-skills',
 * });
 *
 * // S3 workspace
 * const s3 = createWorkspace({
 *   storage: 's3',
 *   bucket: 'my-bucket',
 *   region: 'us-west-2',
 *   accessKeyId: process.env.S3_ACCESS_KEY_ID,
 *   secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
 * });
 *
 * // R2 workspace (Cloudflare R2)
 * const r2 = createWorkspace({
 *   storage: 'r2',
 *   bucket: 'my-r2-bucket',
 *   endpoint: 'https://example.r2.cloudflarestorage.com',
 *   accessKeyId: process.env.R2_ACCESS_KEY_ID,
 *   secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
 * });
 * ```
 */
export function createWorkspace(config: WorkspaceConfig = {}): Workspace {
  // Determine storage type from config, env, or default
  const storage =
    config.storage ??
    (process.env.AGENTFORGE_STORAGE as WorkspaceConfig['storage']) ??
    'local';

  const skillsPaths = Array.isArray(config.skillsPath)
    ? config.skillsPath
    : config.skillsPath
      ? [config.skillsPath]
      : ['/skills'];

  switch (storage) {
    case 'local': {
      const useDedicatedSkillSource =
        !!config.skillsBasePath &&
        skillsPaths.length === 1 &&
        skillsPaths[0] === '/skills';

      return new Workspace({
        name: config.name,
        filesystem: new LocalFilesystem({
          basePath: config.basePath ?? './workspace',
        }),
        skillSource: useDedicatedSkillSource
          ? new LocalSkillSource({
              basePath: config.skillsBasePath,
            })
          : undefined,
        skills: useDedicatedSkillSource ? ['.'] : skillsPaths,
        bm25: config.bm25,
        autoIndexPaths: config.autoIndexPaths,
        searchIndexName: config.searchIndexName,
      });
    }

    case 'r2':
    case 's3': {
      return new Workspace({
        name: config.name,
        filesystem: new S3Filesystem({
          bucket: config.bucket ?? '',
          region:
            storage === 'r2'
              ? 'auto' // R2 requires region: 'auto'
              : config.region ?? 'us-east-1',
          endpoint: config.endpoint,
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        }),
        skills: skillsPaths,
        bm25: config.bm25,
        autoIndexPaths: config.autoIndexPaths,
        searchIndexName: config.searchIndexName,
      });
    }

    default:
      throw new Error(`Unknown storage type: ${(storage as string)}`);
  }
}

// Re-export types for convenience
export type { Workspace };

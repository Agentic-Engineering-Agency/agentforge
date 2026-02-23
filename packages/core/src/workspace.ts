/**
 * @module workspace
 *
 * AgentForge Workspace — powered by Mastra Workspace.
 *
 * Provides agents with persistent file storage, command execution,
 * skill discovery, and content search. Wraps Mastra's Workspace API
 * with sensible defaults for local development and Cloudflare R2 deployment.
 *
 * @example
 * ```typescript
 * import { AgentForgeWorkspace } from '@agentforge-ai/core/workspace';
 *
 * // Local development workspace
 * const workspace = AgentForgeWorkspace.local({
 *   basePath: './workspace',
 *   skills: ['/skills'],
 *   search: true,
 * });
 *
 * // Cloud workspace with S3/R2
 * const cloudWorkspace = AgentForgeWorkspace.cloud({
 *   bucket: 'my-agent-files',
 *   region: 'auto',
 *   endpoint: process.env.R2_ENDPOINT,
 *   accessKeyId: process.env.R2_ACCESS_KEY_ID,
 *   secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
 *   skills: ['/skills'],
 * });
 * ```
 */

import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface WorkspaceProvider {
  read(path: string): Promise<string>;
  write(path: string, content: string | Buffer): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ size: number; modified: Date; isDirectory: boolean } | null>;
}

export interface WorkspaceConfig {
  type: 'local' | 'r2' | 'gcs';
  basePath?: string;
  bucket?: string;
  region?: string;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    keyFilePath?: string;
  };
}

export class LocalWorkspaceProvider implements WorkspaceProvider {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private resolve(filePath: string): string {
    return path.join(this.basePath, filePath);
  }

  async read(filePath: string): Promise<string> {
    return fs.readFile(this.resolve(filePath), 'utf8');
  }

  async write(filePath: string, content: string | Buffer): Promise<void> {
    const fullPath = this.resolve(filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  async list(prefix?: string): Promise<string[]> {
    const dir = prefix ? this.resolve(prefix) : this.basePath;
    try {
      return await listRecursive(dir, this.basePath);
    } catch {
      return [];
    }
  }

  async delete(filePath: string): Promise<void> {
    await fs.rm(this.resolve(filePath), { recursive: true, force: true });
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(filePath));
      return true;
    } catch {
      return false;
    }
  }

  async stat(filePath: string): Promise<{ size: number; modified: Date; isDirectory: boolean } | null> {
    try {
      const s = await fs.stat(this.resolve(filePath));
      return { size: s.size, modified: s.mtime, isDirectory: s.isDirectory() };
    } catch {
      return null;
    }
  }
}

async function listRecursive(dir: string, basePath: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listRecursive(fullPath, basePath));
    } else {
      results.push(path.relative(basePath, fullPath));
    }
  }
  return results;
}

/**
 * Configuration for a local AgentForge workspace.
 */
export interface LocalWorkspaceConfig {
  /** Base directory for file storage. Defaults to './workspace'. */
  basePath?: string;
  /** Directories containing agent skills. Defaults to ['/skills']. */
  skills?: string[];
  /** Enable BM25 keyword search over workspace content. Defaults to true. */
  search?: boolean;
  /** Paths to auto-index for search on initialization. */
  autoIndexPaths?: string[];
  /** Enable sandbox for command execution. Defaults to true. */
  sandbox?: boolean;
  /** Whether filesystem is read-only. Defaults to false. */
  readOnly?: boolean;
  /** Whether to contain file access within basePath. Defaults to true. */
  contained?: boolean;
  /** Tool configuration overrides. */
  tools?: WorkspaceToolConfig;
}

/**
 * Configuration for a cloud (S3/R2) AgentForge workspace.
 */
export interface CloudWorkspaceConfig {
  /** S3 bucket name. */
  bucket: string;
  /** S3 region. Use 'auto' for Cloudflare R2. */
  region?: string;
  /** S3-compatible endpoint URL (required for R2). */
  endpoint?: string;
  /** AWS/R2 access key ID. */
  accessKeyId?: string;
  /** AWS/R2 secret access key. */
  secretAccessKey?: string;
  /** Directories containing agent skills. */
  skills?: string[];
  /** Enable BM25 keyword search. Defaults to true. */
  search?: boolean;
  /** Paths to auto-index for search. */
  autoIndexPaths?: string[];
  /** Tool configuration overrides. */
  tools?: WorkspaceToolConfig;
}

/**
 * Tool-level configuration for workspace capabilities.
 */
export interface WorkspaceToolConfig {
  /** Enable or disable all tools. */
  enabled?: boolean;
  /** Require user approval before any tool execution. */
  requireApproval?: boolean;
  /** Per-tool overrides. */
  overrides?: Record<string, {
    enabled?: boolean;
    requireApproval?: boolean;
    requireReadBeforeWrite?: boolean;
  }>;
}

/**
 * AgentForgeWorkspace wraps Mastra's Workspace with opinionated defaults
 * for the AgentForge framework. It provides factory methods for local
 * development and cloud (S3/R2) deployment patterns.
 */
export class AgentForgeWorkspace {
  /** The underlying Mastra Workspace instance. */
  public readonly workspace: Workspace;

  private constructor(workspace: Workspace) {
    this.workspace = workspace;
  }

  /**
   * Creates a local development workspace with filesystem, sandbox, skills, and search.
   *
   * This is the recommended setup for local development. Files are stored on disk,
   * commands execute locally, and BM25 search is enabled by default for skill discovery.
   *
   * @param config - Local workspace configuration.
   * @returns A configured AgentForgeWorkspace instance.
   *
   * @example
   * ```typescript
   * const workspace = AgentForgeWorkspace.local({
   *   basePath: './workspace',
   *   skills: ['/skills'],
   *   search: true,
   *   autoIndexPaths: ['/docs', '/skills'],
   * });
   *
   * // Assign to an agent
   * const agent = new Agent({
   *   id: 'dev-agent',
   *   name: 'Dev Agent',
   *   instructions: 'You are a helpful assistant.',
   *   model: 'openai/gpt-4o',
   *   workspace: workspace.workspace,
   * });
   * ```
   */
  static local(config: LocalWorkspaceConfig = {}): AgentForgeWorkspace {
    const {
      basePath = './workspace',
      skills = ['/skills'],
      search = true,
      autoIndexPaths,
      sandbox = true,
      readOnly = false,
      contained = true,
      tools,
    } = config;

    const workspaceConfig: Record<string, unknown> = {
      filesystem: new LocalFilesystem({
        basePath,
        readOnly,
        contained,
      }),
      skills,
    };

    if (sandbox) {
      workspaceConfig.sandbox = new LocalSandbox({
        workingDirectory: basePath,
      });
    }

    if (search) {
      workspaceConfig.bm25 = true;
    }

    if (autoIndexPaths) {
      workspaceConfig.autoIndexPaths = autoIndexPaths;
    }

    if (tools) {
      workspaceConfig.tools = buildToolConfig(tools);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workspace = new Workspace(workspaceConfig as any);
    return new AgentForgeWorkspace(workspace);
  }

  /**
   * Creates a cloud workspace using S3-compatible storage (Cloudflare R2, AWS S3, MinIO).
   *
   * This is the recommended setup for production deployment on Cloudflare.
   * Files are stored in R2, and BM25 search is enabled by default.
   *
   * Note: Cloud workspaces do not include a sandbox by default.
   * For command execution in production, use E2B sandboxes separately.
   *
   * @param config - Cloud workspace configuration.
   * @returns A configured AgentForgeWorkspace instance.
   *
   * @example
   * ```typescript
   * const workspace = AgentForgeWorkspace.cloud({
   *   bucket: 'agent-files',
   *   region: 'auto',
   *   endpoint: process.env.R2_ENDPOINT,
   *   accessKeyId: process.env.R2_ACCESS_KEY_ID,
   *   secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
   *   skills: ['/skills'],
   * });
   * ```
   */
  static cloud(config: CloudWorkspaceConfig): AgentForgeWorkspace {
    const {
      bucket,
      region = 'auto',
      endpoint,
      accessKeyId,
      secretAccessKey,
      skills = ['/skills'],
      search = true,
      autoIndexPaths,
      tools,
    } = config;

    // Dynamic import pattern — S3Filesystem is from @mastra/s3
    // Users must install @mastra/s3 for cloud workspaces
    const workspaceConfig: Record<string, unknown> = {
      skills,
    };

    // Store cloud filesystem config for lazy initialization
    // This avoids requiring @mastra/s3 as a hard dependency
    const s3Config = {
      bucket,
      region,
      ...(endpoint ? { endpoint } : {}),
      ...(accessKeyId ? { accessKeyId } : {}),
      ...(secretAccessKey ? { secretAccessKey } : {}),
    };

    // We'll use a local filesystem as fallback and document that
    // users need @mastra/s3 for actual cloud deployment
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { S3Filesystem } = require('@mastra/s3');
      workspaceConfig.filesystem = new S3Filesystem(s3Config);
    } catch {
      console.warn(
        '[AgentForge] @mastra/s3 not installed. Using local filesystem as fallback.\n' +
        'Install @mastra/s3 for cloud storage: pnpm add @mastra/s3'
      );
      workspaceConfig.filesystem = new LocalFilesystem({
        basePath: './workspace',
      });
    }

    if (search) {
      workspaceConfig.bm25 = true;
    }

    if (autoIndexPaths) {
      workspaceConfig.autoIndexPaths = autoIndexPaths;
    }

    if (tools) {
      workspaceConfig.tools = buildToolConfig(tools);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workspace = new Workspace(workspaceConfig as any);
    return new AgentForgeWorkspace(workspace);
  }

  /**
   * Creates a minimal workspace with only filesystem access (no sandbox, no search).
   * Useful for agents that only need to read/write files.
   *
   * @param basePath - Directory for file storage.
   * @param readOnly - Whether the filesystem is read-only.
   * @returns A configured AgentForgeWorkspace instance.
   */
  static filesOnly(basePath = './workspace', readOnly = false): AgentForgeWorkspace {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workspace = new Workspace({
      filesystem: new LocalFilesystem({ basePath, readOnly }),
    } as any);
    return new AgentForgeWorkspace(workspace);
  }

  /**
   * Initializes the workspace (triggers auto-indexing if configured).
   * Call this after creating the workspace and before using search.
   */
  async init(): Promise<void> {
    if (typeof (this.workspace as unknown as { init: () => Promise<void> }).init === 'function') {
      await (this.workspace as unknown as { init: () => Promise<void> }).init();
    }
  }

  /**
   * Searches indexed workspace content.
   *
   * @param query - The search query string.
   * @param options - Search options (topK, mode, minScore).
   * @returns Array of search results ranked by relevance.
   */
  async search(query: string, options?: {
    topK?: number;
    mode?: 'bm25' | 'vector' | 'hybrid';
    minScore?: number;
  }): Promise<Array<{
    id: string;
    content: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>> {
    if (typeof (this.workspace as unknown as { search: (q: string, o?: unknown) => Promise<unknown[]> }).search === 'function') {
      return (this.workspace as unknown as { search: (q: string, o?: unknown) => Promise<Array<{ id: string; content: string; score: number; metadata?: Record<string, unknown> }>> }).search(query, options);
    }
    return [];
  }

  /**
   * Manually indexes content for search.
   *
   * @param id - Unique document identifier (typically file path).
   * @param content - The text content to index.
   * @param metadata - Optional metadata to store with the document.
   */
  async index(id: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    if (typeof (this.workspace as unknown as { index: (id: string, content: string, meta?: unknown) => Promise<void> }).index === 'function') {
      await (this.workspace as unknown as { index: (id: string, content: string, meta?: unknown) => Promise<void> }).index(id, content, metadata ? { metadata } : undefined);
    }
  }
}

/**
 * Converts AgentForge tool config to Mastra Workspace tool config format.
 */
function buildToolConfig(config: WorkspaceToolConfig): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (config.enabled !== undefined) {
    result.enabled = config.enabled;
  }
  if (config.requireApproval !== undefined) {
    result.requireApproval = config.requireApproval;
  }
  if (config.overrides) {
    for (const [toolName, override] of Object.entries(config.overrides)) {
      result[toolName] = override;
    }
  }

  return result;
}

/**
 * @module workspace
 * Core workspace types and LocalWorkspaceProvider implementation.
 * Uses node:fs/promises — no external deps.
 *
 * @deprecated Use Mastra's native Workspace from '@mastra/core/workspace' instead.
 * Import { createWorkspace } from '@agentforge-ai/core/workspace' for the recommended implementation.
 * This custom implementation will be removed in a future version.
 */

import { readFile, writeFile, readdir, rm, access, mkdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';

export interface LocalWorkspaceConfig {
  type: 'local';
  basePath?: string;
}

export interface CloudWorkspaceConfig {
  type: 's3' | 'r2';
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export type WorkspaceToolConfig = LocalWorkspaceConfig | CloudWorkspaceConfig;

export interface WorkspaceProvider {
  read(path: string): Promise<string>;
  write(path: string, content: string | Buffer): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface WorkspaceConfig {
  storage?: 'local' | 's3' | 'r2';
  basePath?: string;
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/**
 * @deprecated Use Mastra's native Workspace from '@mastra/core/workspace' instead.
 * Import { createWorkspace } from '@agentforge-ai/core/workspace' for the recommended implementation.
 * This custom implementation will be removed in a future version.
 */
export class AgentForgeWorkspace {
  private indexedDocuments = new Map<string, string>();

  constructor(private provider: WorkspaceProvider) {}

  /** Self-reference for backward compatibility with tests expecting workspace.workspace */
  get workspace(): this { return this; }

  read(path: string) { return this.provider.read(path); }
  write(path: string, content: string | Buffer) { return this.provider.write(path, content); }
  list(prefix?: string) { return this.provider.list(prefix); }
  delete(path: string) { return this.provider.delete(path); }
  exists(path: string) { return this.provider.exists(path); }

  /**
   * Backward-compatible in-memory indexing for legacy tests and callers.
   * The Mastra-native workspace owns real search; this keeps the deprecated wrapper usable
   * until the remaining contract tests migrate.
   */
  async index(id: string, content: string): Promise<void> {
    this.indexedDocuments.set(id, content);
  }

  async search(query: string): Promise<Array<{ id: string; content: string; score: number }>> {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    if (terms.length === 0) {
      return [];
    }

    return Array.from(this.indexedDocuments.entries())
      .map(([id, content]) => {
        const haystack = content.toLowerCase();
        const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
        return { id, content, score };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  /** Factory: local filesystem workspace (default path: ./workspace) */
  static local(config?: { basePath?: string }): AgentForgeWorkspace {
    return new AgentForgeWorkspace(new LocalWorkspaceProvider(config?.basePath));
  }

  /** Factory: files-only local workspace at a specific path */
  static filesOnly(basePath: string): AgentForgeWorkspace {
    return new AgentForgeWorkspace(new LocalWorkspaceProvider(basePath));
  }

  /** Factory: cloud workspace (R2/S3). Falls back to local if endpoint not reachable. */
  static cloud(config: { bucket: string; accessKeyId?: string; secretAccessKey?: string; endpoint?: string; region?: string }): AgentForgeWorkspace {
    // Lazy-import R2/S3 provider — falls back to local if @mastra/s3 is unavailable
    try {
      const { R2WorkspaceProvider } = require('./workspace-r2.js');
      return new AgentForgeWorkspace(new R2WorkspaceProvider(config));
    } catch {
      // Graceful fallback: use local workspace when cloud deps aren't installed
      const localPath = `./workspace-${config.bucket}`;
      return new AgentForgeWorkspace(new LocalWorkspaceProvider(localPath));
    }
  }
}

export class LocalWorkspaceProvider implements WorkspaceProvider {
  private basePath: string;

  constructor(basePath: string = './workspace') {
    this.basePath = resolve(basePath);
  }

  private safePath(relativePath: string): string {
    const resolved = resolve(join(this.basePath, relativePath));
    if (!resolved.startsWith(this.basePath)) {
      throw new Error(`Path traversal attempt blocked: ${relativePath}`);
    }
    return resolved;
  }

  async read(path: string): Promise<string> {
    return readFile(this.safePath(path), 'utf-8');
  }

  async write(path: string, content: string | Buffer): Promise<void> {
    const full = this.safePath(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
  }

  async list(prefix?: string): Promise<string[]> {
    const dir = prefix ? this.safePath(prefix) : this.basePath;
    const results: string[] = [];

    const walk = async (currentDir: string, relBase: string) => {
      try {
        const entries = await readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            await walk(join(currentDir, entry.name), rel);
          } else if (entry.isFile()) {
            results.push(rel);
          }
        }
      } catch {
        // directory doesn't exist — return empty
      }
    };

    await walk(dir, prefix ?? '');
    // Strip prefix from paths if provided
    if (prefix) {
      return results.map(p => p.startsWith(`${prefix}/`) ? p.slice(prefix.length + 1) : p);
    }
    return results;
  }

  async delete(path: string): Promise<void> {
    await rm(this.safePath(path), { force: true });
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(this.safePath(path));
      return true;
    } catch {
      return false;
    }
  }
}

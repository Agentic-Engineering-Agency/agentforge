/**
 * @module providers/gcs-provider
 *
 * Google Cloud Storage WorkspaceProvider implementation.
 *
 * Uses `@google-cloud/storage` which is dynamically imported so it remains
 * an optional dependency — users install it only when they need GCS storage.
 *
 * @example
 * ```typescript
 * import { GCSWorkspaceProvider } from '@agentforge-ai/core/providers/gcs-provider';
 *
 * const provider = new GCSWorkspaceProvider({
 *   bucket: 'my-agent-files',
 *   projectId: process.env.GCP_PROJECT_ID,
 *   keyFilePath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
 * });
 * ```
 */

import type { WorkspaceProvider } from '../workspace.js';

export interface GCSProviderConfig {
  bucket: string;
  keyFilePath?: string;
  projectId?: string;
}

export class GCSWorkspaceProvider implements WorkspaceProvider {
  private config: GCSProviderConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _bucket: any | null = null;

  constructor(config: GCSProviderConfig) {
    this.config = config;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getBucket(): Promise<any> {
    if (this._bucket) return this._bucket;

    let Storage: unknown;
    try {
      const mod = await import('@google-cloud/storage');
      Storage = (mod as { Storage: unknown }).Storage;
    } catch {
      throw new Error(
        '[AgentForge] @google-cloud/storage is required for GCSWorkspaceProvider.\n' +
        'Install it with: pnpm add @google-cloud/storage'
      );
    }

    const storageOptions: Record<string, unknown> = {};

    if (this.config.projectId) {
      storageOptions.projectId = this.config.projectId;
    }

    if (this.config.keyFilePath) {
      storageOptions.keyFilename = this.config.keyFilePath;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = new (Storage as any)(storageOptions);
    this._bucket = storage.bucket(this.config.bucket);
    return this._bucket;
  }

  async read(path: string): Promise<string> {
    const bucket = await this.getBucket();
    const file = bucket.file(path);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [contents]: any[] = await file.download();
    return contents.toString('utf8');
  }

  async write(path: string, content: string | Buffer): Promise<void> {
    const bucket = await this.getBucket();
    const file = bucket.file(path);

    await file.save(content);
  }

  async list(prefix?: string): Promise<string[]> {
    const bucket = await this.getBucket();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [files]: any[][] = await bucket.getFiles(prefix ? { prefix } : {});

    return files.map((f: { name: string }) => f.name);
  }

  async delete(path: string): Promise<void> {
    const bucket = await this.getBucket();
    const file = bucket.file(path);

    await file.delete();
  }

  async exists(path: string): Promise<boolean> {
    try {
      const bucket = await this.getBucket();
      const file = bucket.file(path);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [exists]: any[] = await file.exists();
      return exists as boolean;
    } catch {
      return false;
    }
  }

  async stat(path: string): Promise<{ size: number; modified: Date; isDirectory: boolean } | null> {
    try {
      const bucket = await this.getBucket();
      const file = bucket.file(path);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [metadata]: any[] = await file.getMetadata();

      return {
        size: parseInt(String(metadata.size ?? '0'), 10),
        modified: new Date(metadata.updated ?? metadata.timeCreated ?? Date.now()),
        isDirectory: false, // GCS has no real directories
      };
    } catch (err: unknown) {
      const code = (err as { code?: number | string }).code;
      if (code === 404 || code === '404') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Generates a signed URL for direct access to a GCS object.
   *
   * @param path - The object name in the bucket.
   * @param expiresIn - Expiry time in seconds. Defaults to 3600 (1 hour).
   * @returns A signed URL string.
   */
  async getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
    const bucket = await this.getBucket();
    const file = bucket.file(path);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [url]: any[] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });

    return url as string;
  }
}

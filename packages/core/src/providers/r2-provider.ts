/**
 * @module providers/r2-provider
 *
 * Cloudflare R2 WorkspaceProvider implementation.
 *
 * Uses native `fetch()` with AWS SigV4 signing via `./s3-signer.ts`.
 * No external SDK dependencies required. Runtime-agnostic (Workers, Node, Deno, Bun).
 *
 * @deprecated The SigV4 signing layer will be replaced by native Cloudflare Workers
 * R2 bindings (`env.BUCKET.get()`) in Phase 3 (Sprint 3.2, AGE-17).
 *
 * @example
 * ```typescript
 * import { R2WorkspaceProvider } from '@agentforge-ai/core/providers/r2-provider';
 *
 * const provider = new R2WorkspaceProvider({
 *   bucket: 'my-agent-files',
 *   endpoint: process.env.R2_ENDPOINT,
 *   accessKeyId: process.env.R2_ACCESS_KEY_ID,
 *   secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
 * });
 * ```
 */

import { signRequest, createPresignedUrl } from './s3-signer.js';
import type { WorkspaceProvider } from '../workspace.js';

const encoder = new TextEncoder();

export interface R2ProviderConfig {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface LifecycleRule {
  id: string;
  prefix?: string;
  expirationDays?: number;
  status?: 'Enabled' | 'Disabled';
}

export class R2WorkspaceProvider implements WorkspaceProvider {
  private config: R2ProviderConfig;

  constructor(config: R2ProviderConfig) {
    this.config = config;
  }

  /** Builds the full HTTPS URL for a given object key. */
  private objectUrl(key: string): string {
    const endpoint =
      this.config.endpoint ?? `https://s3.${this.config.region ?? 'auto'}.amazonaws.com`;
    const base = endpoint.replace(/\/$/, '');
    const encodedKey = key
      .split('/')
      .map(encodeURIComponent)
      .join('/');
    return `${base}/${this.config.bucket}/${encodedKey}`;
  }

  /** Builds the bucket-level URL (for list, lifecycle, etc.) */
  private bucketUrl(): string {
    const endpoint =
      this.config.endpoint ?? `https://s3.${this.config.region ?? 'auto'}.amazonaws.com`;
    return endpoint.replace(/\/$/, '') + `/${this.config.bucket}`;
  }

  private get accessKeyId(): string {
    return this.config.accessKeyId ?? '';
  }

  private get secretAccessKey(): string {
    return this.config.secretAccessKey ?? '';
  }

  private get region(): string {
    return this.config.region ?? 'auto';
  }

  /**
   * Builds signed fetch options for a request.
   * Uses Web Crypto API (async) for SigV4 signing.
   */
  private async buildSignedRequest(
    method: string,
    url: string,
    body?: string | Uint8Array,
    extraHeaders?: Record<string, string>,
  ): Promise<{ url: string; init: RequestInit }> {
    const signed = await signRequest({
      method,
      url,
      body,
      headers: extraHeaders,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
    });

    const headers: Record<string, string> = {
      host: signed.host,
      'x-amz-date': signed['x-amz-date'],
      'x-amz-content-sha256': signed['x-amz-content-sha256'],
      authorization: signed.authorization,
      ...extraHeaders,
    };

    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      init.body = typeof body === 'string' ? body : body.buffer as ArrayBuffer;
    }

    return { url, init };
  }

  async read(path: string): Promise<string> {
    const url = this.objectUrl(path);
    const { url: reqUrl, init } = await this.buildSignedRequest('GET', url);

    const response = await fetch(reqUrl, init);
    if (!response.ok) {
      throw new Error(
        `[R2WorkspaceProvider] Failed to read "${path}": HTTP ${response.status} ${response.statusText}`,
      );
    }

    return response.text();
  }

  async write(path: string, content: string | Uint8Array): Promise<void> {
    const url = this.objectUrl(path);
    const body = typeof content === 'string' ? content : content;
    const { url: reqUrl, init } = await this.buildSignedRequest('PUT', url, body);

    const response = await fetch(reqUrl, init);
    if (!response.ok) {
      throw new Error(
        `[R2WorkspaceProvider] Failed to write "${path}": HTTP ${response.status} ${response.statusText}`,
      );
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const baseUrl = this.bucketUrl();
      const params = new URLSearchParams({ 'list-type': '2' });
      if (prefix) params.set('prefix', prefix);
      if (continuationToken) params.set('continuation-token', continuationToken);

      const url = `${baseUrl}?${params.toString()}`;
      const { url: reqUrl, init } = await this.buildSignedRequest('GET', url);

      const response = await fetch(reqUrl, init);
      if (!response.ok) {
        throw new Error(
          `[R2WorkspaceProvider] Failed to list objects: HTTP ${response.status} ${response.statusText}`,
        );
      }

      const xml = await response.text();

      // Extract all <Key> elements
      const keyMatches = xml.matchAll(/<Key>([^<]*)<\/Key>/g);
      for (const match of keyMatches) {
        keys.push(match[1]);
      }

      // Check pagination
      const isTruncatedMatch = xml.match(/<IsTruncated>([^<]*)<\/IsTruncated>/);
      const isTruncated = isTruncatedMatch?.[1]?.toLowerCase() === 'true';

      if (isTruncated) {
        const tokenMatch = xml.match(
          /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/,
        );
        continuationToken = tokenMatch?.[1];
      } else {
        continuationToken = undefined;
      }
    } while (continuationToken);

    return keys;
  }

  async delete(path: string): Promise<void> {
    const url = this.objectUrl(path);
    const { url: reqUrl, init } = await this.buildSignedRequest('DELETE', url);

    const response = await fetch(reqUrl, init);
    if (response.status !== 204 && response.status !== 200) {
      throw new Error(
        `[R2WorkspaceProvider] Failed to delete "${path}": HTTP ${response.status} ${response.statusText}`,
      );
    }
  }

  async exists(path: string): Promise<boolean> {
    const result = await this.stat(path);
    return result !== null;
  }

  async stat(
    path: string,
  ): Promise<{ size: number; modified: Date; isDirectory: boolean } | null> {
    const url = this.objectUrl(path);
    const { url: reqUrl, init } = await this.buildSignedRequest('HEAD', url);

    const response = await fetch(reqUrl, init);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `[R2WorkspaceProvider] Failed to stat "${path}": HTTP ${response.status} ${response.statusText}`,
      );
    }

    const contentLength = response.headers.get('content-length');
    const lastModified = response.headers.get('last-modified');

    return {
      size: contentLength ? parseInt(contentLength, 10) : 0,
      modified: lastModified ? new Date(lastModified) : new Date(),
      isDirectory: false,
    };
  }

  /**
   * Generates a pre-signed URL for direct upload or download from R2.
   *
   * @param path - Object key in the bucket.
   * @param expiresIn - Expiry in seconds (default: 3600).
   */
  async getPresignedUrl(path: string, expiresIn = 3600): Promise<string> {
    const url = this.objectUrl(path);
    return createPresignedUrl({
      method: 'GET',
      url,
      expiresIn,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
    });
  }

  /**
   * Sets lifecycle rules on the bucket for automatic object expiration.
   */
  async setBucketLifecycle(rules: LifecycleRule[]): Promise<void> {
    const xmlBody = buildLifecycleXml(rules);
    const url = `${this.bucketUrl()}?lifecycle`;

    const { url: reqUrl, init } = await this.buildSignedRequest(
      'PUT',
      url,
      encoder.encode(xmlBody),
      { 'content-type': 'application/xml' },
    );

    const response = await fetch(reqUrl, init);
    if (!response.ok) {
      throw new Error(
        `[R2WorkspaceProvider] Failed to set bucket lifecycle: HTTP ${response.status} ${response.statusText}`,
      );
    }
  }
}

/** Builds the XML body for a PutBucketLifecycleConfiguration request. */
function buildLifecycleXml(rules: LifecycleRule[]): string {
  const rulesXml = rules.map((rule) => {
    const filter =
      rule.prefix !== undefined
        ? `<Filter><Prefix>${escapeXml(rule.prefix)}</Prefix></Filter>`
        : `<Filter><Prefix></Prefix></Filter>`;

    const expiration =
      rule.expirationDays !== undefined
        ? `<Expiration><Days>${rule.expirationDays}</Days></Expiration>`
        : '';

    return [
      '<Rule>',
      `<ID>${escapeXml(rule.id)}</ID>`,
      filter,
      `<Status>${rule.status ?? 'Enabled'}</Status>`,
      expiration,
      '</Rule>',
    ].join('');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<LifecycleConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">',
    ...rulesXml,
    '</LifecycleConfiguration>',
  ].join('');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

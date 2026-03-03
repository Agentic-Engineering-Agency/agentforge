/**
 * @module providers/r2-provider
 * R2/S3-compatible workspace provider using native fetch + SigV4.
 * No AWS SDK — uses Web Crypto API per project conventions (Lesson 11/12).
 */

import type { WorkspaceProvider } from '../workspace.js';

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
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function buildSigV4Headers(
  method: string,
  url: URL,
  body: string | Uint8Array,
  region: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<Record<string, string>> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateStamp = amzDate.slice(0, 8);
  const bodyStr = typeof body === 'string' ? body : new TextDecoder().decode(body);
  const payloadHash = await sha256Hex(bodyStr);

  const headers: Record<string, string> = {
    host: url.host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  };

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.entries(headers).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v.trim()}`).join('\n') + '\n';
  const canonicalRequest = [method, url.pathname, url.search.slice(1),
    canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope,
    await sha256Hex(canonicalRequest)].join('\n');

  const encoder = new TextEncoder();
  let sigKey: ArrayBuffer = encoder.encode(`AWS4${secretAccessKey}`).buffer as ArrayBuffer;
  for (const part of [dateStamp, region, 's3', 'aws4_request']) {
    sigKey = await hmacSha256(sigKey, part);
  }
  const signature = Array.from(new Uint8Array(await hmacSha256(sigKey, stringToSign)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`,
  };
}

export class R2WorkspaceProvider implements WorkspaceProvider {
  private config: Required<R2ProviderConfig>;

  constructor(config: R2ProviderConfig) {
    this.config = {
      bucket: config.bucket,
      region: config.region ?? 'auto',
      endpoint: config.endpoint ?? `https://s3.${config.region ?? 'us-east-1'}.amazonaws.com`,
      accessKeyId: config.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: config.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? '',
    };
  }

  private objectUrl(key: string): URL {
    return new URL(`/${this.config.bucket}/${key}`, this.config.endpoint);
  }

  async read(path: string): Promise<string> {
    const url = this.objectUrl(path);
    const headers = await buildSigV4Headers(
      'GET', url, '', this.config.region, this.config.accessKeyId, this.config.secretAccessKey
    );
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`R2 read failed: ${res.status} ${path}`);
    return res.text();
  }

  async write(path: string, content: string | Buffer): Promise<void> {
    const url = this.objectUrl(path);
    const body = typeof content === 'string' ? content : new TextDecoder().decode(content);
    const headers = await buildSigV4Headers(
      'PUT', url, body, this.config.region, this.config.accessKeyId, this.config.secretAccessKey
    );
    const res = await fetch(url.toString(), { method: 'PUT', headers, body });
    if (!res.ok) throw new Error(`R2 write failed: ${res.status} ${path}`);
  }

  async list(prefix?: string): Promise<string[]> {
    const url = new URL(`/${this.config.bucket}`, this.config.endpoint);
    url.searchParams.set('list-type', '2');
    if (prefix) url.searchParams.set('prefix', prefix);
    const headers = await buildSigV4Headers(
      'GET', url, '', this.config.region, this.config.accessKeyId, this.config.secretAccessKey
    );
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`R2 list failed: ${res.status}`);
    const xml = await res.text();
    const keys: string[] = [];
    const matches = xml.matchAll(/<Key>([^<]+)<\/Key>/g);
    for (const m of matches) keys.push(m[1]);
    return keys;
  }

  async delete(path: string): Promise<void> {
    const url = this.objectUrl(path);
    const headers = await buildSigV4Headers(
      'DELETE', url, '', this.config.region, this.config.accessKeyId, this.config.secretAccessKey
    );
    const res = await fetch(url.toString(), { method: 'DELETE', headers });
    if (!res.ok && res.status !== 204) throw new Error(`R2 delete failed: ${res.status} ${path}`);
  }

  async exists(path: string): Promise<boolean> {
    const url = this.objectUrl(path);
    const headers = await buildSigV4Headers(
      'HEAD', url, '', this.config.region, this.config.accessKeyId, this.config.secretAccessKey
    );
    const res = await fetch(url.toString(), { method: 'HEAD', headers });
    return res.ok;
  }
}

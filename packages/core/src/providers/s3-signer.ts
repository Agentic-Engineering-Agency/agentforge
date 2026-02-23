/**
 * @module providers/s3-signer
 *
 * Lightweight AWS Signature Version 4 implementation using the Web Crypto API.
 * Works in any modern runtime: Cloudflare Workers, Deno, Bun, Node 18+, browsers.
 * No external dependencies, no Node.js-specific APIs.
 *
 * Supports:
 * - `signRequest()` — Header-based signing for direct API calls
 * - `createPresignedUrl()` — Query-string-based signing for presigned URLs
 *
 * @deprecated This signer will be removed in Phase 3 (Sprint 3.2) when AgentForge
 * migrates to Cloudflare Workers with native R2 bindings (`env.BUCKET.get()`).
 * SigV4 is only needed for accessing R2 from outside Workers.
 */

export interface SignRequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  service?: string;
}

export interface SignedHeaders {
  authorization: string;
  'x-amz-date': string;
  'x-amz-content-sha256': string;
  host: string;
}

export interface PresignedUrlOptions {
  method?: string;
  url: string;
  expiresIn?: number;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  service?: string;
}

// --- Web Crypto helpers (runtime-agnostic) ---

const encoder = new TextEncoder();

/** Convert Uint8Array to ArrayBuffer (compatible with all Web Crypto runtimes) */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // Slice creates a new ArrayBuffer, avoiding SharedArrayBuffer type issues
  return new Uint8Array(bytes).buffer as ArrayBuffer;
}

/** SHA-256 hash → hex string */
async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const input = typeof data === 'string' ? encoder.encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', toArrayBuffer(input));
  return hexEncode(new Uint8Array(hash));
}

/** HMAC-SHA256 with raw key bytes → raw result bytes */
async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, toArrayBuffer(encoder.encode(data)));
  return new Uint8Array(sig);
}

/** HMAC-SHA256 → hex string */
async function hmacSha256Hex(key: Uint8Array, data: string): Promise<string> {
  return hexEncode(await hmacSha256(key, data));
}

/** Uint8Array → lowercase hex string */
function hexEncode(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

// SHA-256 of empty string (precomputed)
const EMPTY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

// --- Timestamp helpers ---

function getTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function getDateScope(timestamp: string): string {
  return timestamp.slice(0, 8);
}

// --- URI encoding (SigV4-compliant) ---

function uriEncodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function uriEncodePath(urlPath: string): string {
  return urlPath
    .split('/')
    .map((seg) => (seg === '' ? '' : uriEncodeSegment(seg)))
    .join('/');
}

function canonicalQueryString(searchParams: URLSearchParams): string {
  const params: Array<[string, string]> = [];
  searchParams.forEach((value, key) => {
    params.push([uriEncodeSegment(key), uriEncodeSegment(value)]);
  });
  params.sort(([a], [b]) => a.localeCompare(b));
  return params.map(([k, v]) => `${k}=${v}`).join('&');
}

// --- Signing key derivation ---

async function deriveSigningKey(
  secretAccessKey: string,
  date: string,
  region: string,
  service: string,
): Promise<Uint8Array> {
  const kDate = await hmacSha256(encoder.encode(`AWS4${secretAccessKey}`), date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

// --- Public API ---

/**
 * Signs an HTTP request with AWS Signature Version 4 header-based signing.
 *
 * Returns headers that must be included in the request:
 * - `authorization` — The SigV4 Authorization header value
 * - `x-amz-date` — The request timestamp
 * - `x-amz-content-sha256` — SHA-256 hash of the request body
 * - `host` — The request host
 */
export async function signRequest(options: SignRequestOptions): Promise<SignedHeaders> {
  const {
    method,
    url,
    headers = {},
    body,
    accessKeyId,
    secretAccessKey,
    region = 'auto',
    service = 's3',
  } = options;

  const parsed = new URL(url);
  const host = parsed.host;
  const timestamp = getTimestamp();
  const dateScope = getDateScope(timestamp);

  // Compute payload hash
  const payloadHash = body
    ? await sha256Hex(typeof body === 'string' ? encoder.encode(body) : body)
    : EMPTY_HASH;

  // Build canonical headers
  const canonicalHeadersMap: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': timestamp,
  };

  for (const [k, v] of Object.entries(headers)) {
    const lk = k.toLowerCase();
    if (lk !== 'host' && lk !== 'x-amz-date' && lk !== 'x-amz-content-sha256') {
      canonicalHeadersMap[lk] = v;
    }
  }

  const sortedHeaderKeys = Object.keys(canonicalHeadersMap).sort();
  const canonicalHeaders =
    sortedHeaderKeys.map((k) => `${k}:${canonicalHeadersMap[k].trim()}`).join('\n') + '\n';
  const signedHeaders = sortedHeaderKeys.join(';');

  // Build canonical request
  const canonicalUri = uriEncodePath(parsed.pathname) || '/';
  const canonicalQuery = canonicalQueryString(parsed.searchParams);

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  // String to sign
  const credentialScope = `${dateScope}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  // Derive signing key and compute signature
  const signingKey = await deriveSigningKey(secretAccessKey, dateScope, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  return {
    authorization:
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`,
    'x-amz-date': timestamp,
    'x-amz-content-sha256': payloadHash,
    host,
  };
}

/**
 * Creates a presigned URL using SigV4 query-string authentication.
 *
 * @param options.method - HTTP method (default: 'GET')
 * @param options.url - The base object URL to presign
 * @param options.expiresIn - Expiry in seconds (default: 3600)
 *
 * @deprecated Will be replaced by native R2 bindings in Phase 3 (Sprint 3.2).
 */
export async function createPresignedUrl(options: PresignedUrlOptions): Promise<string> {
  const {
    method = 'GET',
    url,
    expiresIn = 3600,
    accessKeyId,
    secretAccessKey,
    region = 'auto',
    service = 's3',
  } = options;

  const parsed = new URL(url);
  const host = parsed.host;
  const timestamp = getTimestamp();
  const dateScope = getDateScope(timestamp);

  const credentialScope = `${dateScope}/${region}/${service}/aws4_request`;

  parsed.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  parsed.searchParams.set('X-Amz-Credential', `${accessKeyId}/${credentialScope}`);
  parsed.searchParams.set('X-Amz-Date', timestamp);
  parsed.searchParams.set('X-Amz-Expires', String(expiresIn));
  parsed.searchParams.set('X-Amz-SignedHeaders', 'host');

  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';

  const canonicalUri = uriEncodePath(parsed.pathname) || '/';
  const canonicalQuery = canonicalQueryString(parsed.searchParams);

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await deriveSigningKey(secretAccessKey, dateScope, region, service);
  const signature = await hmacSha256Hex(signingKey, stringToSign);

  parsed.searchParams.set('X-Amz-Signature', signature);

  return parsed.toString();
}

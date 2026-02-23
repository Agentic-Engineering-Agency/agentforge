/**
 * @module providers/s3-signer
 *
 * Lightweight AWS Signature Version 4 implementation using only Node.js built-ins.
 * No external dependencies — only `node:crypto` and `node:url`.
 *
 * Supports:
 * - `signRequest()` — Header-based signing for direct API calls
 * - `createPresignedUrl()` — Query-string-based signing for presigned URLs
 */

import crypto from 'node:crypto';

export interface SignRequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
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

// SHA-256 hash of empty string — used for GET/DELETE/HEAD payload hash
const EMPTY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function hmacSha256Hex(key: Buffer | string, data: string): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Returns a compact ISO 8601 timestamp: `20260223T120000Z`
 * (no dashes or colons, always UTC).
 */
function getTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Returns the date portion of a compact timestamp: `20260223`
 */
function getDateScope(timestamp: string): string {
  return timestamp.slice(0, 8);
}

/**
 * URI-encodes a single path segment (does NOT encode `/`).
 * Encodes all characters except unreserved ones: A-Z a-z 0-9 - _ . ~
 */
function uriEncodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * URI-encodes a full path, encoding each segment individually but
 * preserving `/` separators.
 */
function uriEncodePath(urlPath: string): string {
  return urlPath
    .split('/')
    .map((seg) => (seg === '' ? '' : uriEncodeSegment(seg)))
    .join('/');
}

/**
 * Parses a URL and returns sorted, encoded query string for canonical request.
 * Returns empty string if no query parameters exist.
 */
function canonicalQueryString(searchParams: URLSearchParams): string {
  const params: Array<[string, string]> = [];
  searchParams.forEach((value, key) => {
    params.push([uriEncodeSegment(key), uriEncodeSegment(value)]);
  });
  params.sort(([a], [b]) => a.localeCompare(b));
  return params.map(([k, v]) => `${k}=${v}`).join('&');
}

/**
 * Derives the SigV4 signing key via the HMAC key derivation chain.
 */
function deriveSigningKey(secretAccessKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, date);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  return kSigning;
}

/**
 * Signs an HTTP request with AWS Signature Version 4 header-based signing.
 *
 * Returns headers that must be included in the request:
 * - `authorization` — The SigV4 Authorization header value
 * - `x-amz-date` — The request timestamp
 * - `x-amz-content-sha256` — SHA-256 hash of the request body
 * - `host` — The request host (required for signing)
 */
export function signRequest(options: SignRequestOptions): SignedHeaders {
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
    ? sha256Hex(typeof body === 'string' ? Buffer.from(body, 'utf8') : body)
    : EMPTY_HASH;

  // Build canonical headers (must include host and x-amz-date at minimum)
  const canonicalHeadersMap: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': timestamp,
  };

  // Merge any extra headers (lowercase keys)
  for (const [k, v] of Object.entries(headers)) {
    const lk = k.toLowerCase();
    if (lk !== 'host' && lk !== 'x-amz-date' && lk !== 'x-amz-content-sha256') {
      canonicalHeadersMap[lk] = v;
    }
  }

  const sortedHeaderKeys = Object.keys(canonicalHeadersMap).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${canonicalHeadersMap[k].trim()}`)
    .join('\n') + '\n';
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

  // Build string to sign
  const credentialScope = `${dateScope}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  // Derive signing key and compute signature
  const signingKey = deriveSigningKey(secretAccessKey, dateScope, region, service);
  const signature = hmacSha256Hex(signingKey, stringToSign);

  // Build Authorization header
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  return {
    authorization,
    'x-amz-date': timestamp,
    'x-amz-content-sha256': payloadHash,
    host,
  };
}

/**
 * Creates a presigned URL using SigV4 query-string authentication.
 *
 * The returned URL is self-authenticating and can be shared for direct
 * upload or download without exposing credentials.
 *
 * @param options.method - HTTP method (default: 'GET')
 * @param options.url - The base object URL to presign
 * @param options.expiresIn - Expiry in seconds (default: 3600)
 */
export function createPresignedUrl(options: PresignedUrlOptions): string {
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

  // Add SigV4 query parameters (must come before computing the signature)
  parsed.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  parsed.searchParams.set('X-Amz-Credential', `${accessKeyId}/${credentialScope}`);
  parsed.searchParams.set('X-Amz-Date', timestamp);
  parsed.searchParams.set('X-Amz-Expires', String(expiresIn));
  parsed.searchParams.set('X-Amz-SignedHeaders', 'host');

  // For presigned URLs the payload is always UNSIGNED-PAYLOAD
  const payloadHash = 'UNSIGNED-PAYLOAD';

  // Canonical headers — only `host` is signed for presigned URLs
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
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = deriveSigningKey(secretAccessKey, dateScope, region, service);
  const signature = hmacSha256Hex(signingKey, stringToSign);

  parsed.searchParams.set('X-Amz-Signature', signature);

  return parsed.toString();
}

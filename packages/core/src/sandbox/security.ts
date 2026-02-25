/**
 * @module security
 *
 * Security helpers for the Docker sandbox implementation.
 *
 * Centralised in one module so policy changes propagate everywhere.
 * All validation functions throw {@link SecurityError} on violations.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Host-side paths that must never be bind-mounted into a sandbox container.
 * Mounting these paths would allow container-escape or privilege escalation.
 */
export const BLOCKED_BIND_PREFIXES: readonly string[] = [
  '/var/run/docker.sock',
  '/etc',
  '/proc',
  '/sys',
  '/dev',
  '/boot',
  '/root',
];

/**
 * Linux capabilities dropped by default for every sandbox container.
 * We start with no capabilities at all (drop "ALL") then add nothing back.
 */
export const DEFAULT_CAP_DROP: readonly string[] = ['ALL'];

/**
 * Allowed image name patterns (non-arbitrary image names in production).
 * Only images that match one of these prefixes are permitted.
 * In test / dev the list can be extended via AGENTFORGE_ALLOWED_IMAGES env var.
 */
const BASE_ALLOWED_IMAGE_PREFIXES: readonly string[] = [
  'node:',
  'python:',
  'ubuntu:',
  'debian:',
  'alpine:',
  'agentforge/',
];

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

/**
 * Throws if the provided bind-mount spec contains a blocked host path.
 *
 * @param bind - A bind-mount spec in `host:container[:mode]` format.
 * @throws {SecurityError} when the host path is on the block-list.
 */
export function validateBind(bind: string): void {
  const hostPath = bind.split(':')[0];
  if (!hostPath) {
    throw new SecurityError(`Invalid bind mount spec: "${bind}"`);
  }

  for (const blocked of BLOCKED_BIND_PREFIXES) {
    if (hostPath === blocked || hostPath.startsWith(blocked + '/') || hostPath.startsWith(blocked)) {
      throw new SecurityError(
        `Bind mount "${bind}" is blocked. Host path "${hostPath}" matches blocked prefix "${blocked}".`,
      );
    }
  }
}

/**
 * Validate all bind mounts in the provided array.
 * @throws {SecurityError} on the first violation found.
 */
export function validateBinds(binds: string[]): void {
  for (const bind of binds) {
    validateBind(bind);
  }
}

/**
 * Validate that an image name is on the allow-list.
 *
 * In production (NODE_ENV === 'production') only known safe images are allowed.
 * In development/test any image name that passes format validation is accepted.
 *
 * Additional allowed prefixes can be injected via the
 * `AGENTFORGE_ALLOWED_IMAGES` env var (comma-separated prefixes).
 *
 * @param image - Docker image name, e.g. `node:22-slim`.
 * @throws {SecurityError} if the image is not permitted.
 */
export function validateImageName(image: string): void {
  if (!image || typeof image !== 'string') {
    throw new SecurityError('Image name must be a non-empty string.');
  }

  // Reject obviously dangerous patterns (shell metacharacters)
  if (/[;&|`$(){}[\]<>]/.test(image)) {
    throw new SecurityError(`Image name "${image}" contains forbidden characters.`);
  }

  if (process.env['NODE_ENV'] !== 'production') {
    // In dev/test, just ensure the name is a plausible Docker image reference
    return;
  }

  // Build the full allow-list (base + env-configured extras)
  const extraPrefixes = (process.env['AGENTFORGE_ALLOWED_IMAGES'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allowedPrefixes = [...BASE_ALLOWED_IMAGE_PREFIXES, ...extraPrefixes];

  const allowed = allowedPrefixes.some((prefix) => image.startsWith(prefix));
  if (!allowed) {
    throw new SecurityError(
      `Image "${image}" is not on the allow-list. ` +
        `Allowed prefixes: ${allowedPrefixes.join(', ')}. ` +
        `Add custom prefixes via AGENTFORGE_ALLOWED_IMAGES env var.`,
    );
  }
}

/**
 * Validate that a command does not contain obvious escape attempts.
 * This is a defense-in-depth measure — the container itself is the primary boundary.
 *
 * @param command - The shell command to validate.
 * @throws {SecurityError} if the command contains dangerous patterns.
 */
export function validateCommand(command: string): void {
  if (!command || typeof command !== 'string') {
    throw new SecurityError('Command must be a non-empty string.');
  }

  // Block attempts to access the Docker socket from within the container
  const dangerousPatterns = [
    /docker\.sock/i,
    /nsenter\s/i,
    /mount\s+-t\s+proc/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      throw new SecurityError(
        `Command contains a potentially dangerous pattern: ${pattern.source}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/**
 * A structured error type for sandbox security violations.
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

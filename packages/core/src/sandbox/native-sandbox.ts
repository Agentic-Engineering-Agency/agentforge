/**
 * @module native-sandbox
 *
 * NativeSandbox — a lightweight process-level sandbox using platform-native
 * isolation mechanisms as an alternative to Docker.
 *
 * Platform support:
 * - macOS: `sandbox-exec` with Apple Seatbelt profiles (.sb)
 * - Linux: `bwrap` (Bubblewrap) if available
 * - Fallback: plain child_process with timeout + env filtering (no isolation)
 *
 * Security note: spawn() is used intentionally here because this module is the
 * sandbox itself. Commands are passed through isolation wrappers (sandbox-exec /
 * bwrap) that enforce the security policy. The env is sanitized before use.
 */

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { ExecOptions, ExecResult, SandboxProvider } from './types.js';
import type { NativeSandboxConfig, SandboxProfile } from './types.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Default profile
// ---------------------------------------------------------------------------

/**
 * Conservative default profile for native sandboxes.
 * Network access is disabled; only /tmp is accessible.
 */
export const DEFAULT_SANDBOX_PROFILE: SandboxProfile = {
  allowNetwork: false,
  allowFS: ['/tmp'],
  timeout: 30,
  memory: 512,
};

// ---------------------------------------------------------------------------
// Availability detection
// ---------------------------------------------------------------------------

/**
 * Detects which native isolation method is available on the current platform.
 *
 * @returns An object indicating availability and the method found.
 */
export async function isNativeSandboxAvailable(): Promise<{
  available: boolean;
  method: 'sandbox-exec' | 'bwrap' | 'none';
}> {
  if (process.platform === 'darwin') {
    try {
      // sandbox-exec is a built-in macOS tool; 'which' confirms it is on PATH
      await execFileAsync('which', ['sandbox-exec'], { timeout: 5000 });
      return { available: true, method: 'sandbox-exec' };
    } catch (error) {
      console.debug('[isNativeSandboxAvailable] sandbox-exec not found:', error instanceof Error ? error.message : error);
    }
  }

  if (process.platform === 'linux') {
    try {
      await execFileAsync('which', ['bwrap'], { timeout: 5000 });
      return { available: true, method: 'bwrap' };
    } catch (error) {
      console.debug('[isNativeSandboxAvailable] bwrap not found:', error instanceof Error ? error.message : error);
    }
  }

  return { available: false, method: 'none' };
}

// ---------------------------------------------------------------------------
// Seatbelt profile generation (macOS)
// ---------------------------------------------------------------------------

/**
 * Generates an Apple Seatbelt (.sb) profile string from a {@link SandboxProfile}.
 *
 * The profile uses deny-default policy and selectively allows operations
 * based on the provided configuration.
 */
function generateSeatbeltProfile(profile: SandboxProfile): string {
  const lines: string[] = [
    '(version 1)',
    '(deny default)',
    // Always allow process execution so /bin/sh -c works
    '(allow process-exec)',
    '(allow process-fork)',
    // Allow reading system libraries and frameworks
    '(allow file-read* (subpath "/usr/lib"))',
    '(allow file-read* (subpath "/usr/libexec"))',
    '(allow file-read* (subpath "/System/Library"))',
    '(allow file-read* (subpath "/Library/Preferences"))',
    '(allow file-read* (literal "/dev/null"))',
    '(allow file-read* (literal "/dev/urandom"))',
    '(allow file-read* (literal "/dev/random"))',
    // Allow sysctl reads (needed by many programs)
    '(allow sysctl-read)',
    // Allow signal sending to self
    '(allow signal (target self))',
    // Allow mach operations needed for basic process functionality
    '(allow mach-lookup)',
  ];

  // Filesystem access
  for (const allowedPath of profile.allowFS) {
    lines.push(`(allow file-read* (subpath "${allowedPath}"))`);
    lines.push(`(allow file-write* (subpath "${allowedPath}"))`);
  }

  // Network access
  if (profile.allowNetwork) {
    lines.push('(allow network*)');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// bwrap argument generation (Linux)
// ---------------------------------------------------------------------------

/**
 * Builds the bwrap (Bubblewrap) argument list for the given profile and command.
 */
function buildBwrapArgs(profile: SandboxProfile, command: string, cwd?: string): string[] {
  const args: string[] = [
    '--ro-bind', '/', '/',
    '--dev', '/dev',
    '--proc', '/proc',
    '--tmpfs', '/tmp',
  ];

  // Bind allowed writable paths
  for (const allowedPath of profile.allowFS) {
    // Skip /tmp since we already have --tmpfs /tmp
    if (allowedPath === '/tmp') continue;
    args.push('--bind', allowedPath, allowedPath);
  }

  // Network isolation
  if (!profile.allowNetwork) {
    args.push('--unshare-net');
  }

  // User namespace isolation
  args.push('--unshare-user', '--unshare-pid', '--unshare-ipc', '--unshare-uts');

  if (cwd) {
    args.push('--chdir', cwd);
  }

  args.push('--', '/bin/sh', '-c', command);

  return args;
}

// ---------------------------------------------------------------------------
// NativeSandbox
// ---------------------------------------------------------------------------

/**
 * A sandbox provider that uses platform-native process isolation instead of Docker.
 *
 * Isolation strategy (in priority order):
 * 1. macOS: `sandbox-exec` with Apple Seatbelt profiles
 * 2. Linux: `bwrap` (Bubblewrap)
 * 3. Fallback: plain child_process with timeout + env filtering (no isolation)
 */
export class NativeSandbox implements SandboxProvider {
  private readonly config: NativeSandboxConfig;
  private readonly profile: SandboxProfile;
  private readonly id: string;
  private running = false;
  private isolationMethod: 'sandbox-exec' | 'bwrap' | 'none' = 'none';

  constructor(config: NativeSandboxConfig) {
    this.config = config;
    this.profile = config.profile ?? { ...DEFAULT_SANDBOX_PROFILE };
    this.id = `native-${randomUUID()}`;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    const { method } = await isNativeSandboxAvailable();
    this.isolationMethod = method;

    if (method === 'none') {
      console.warn(
        '[NativeSandbox] No native isolation available (sandbox-exec / bwrap not found). ' +
          'Running with limited isolation (timeout + env filtering only). ' +
          'For stronger isolation, install Docker or use bwrap on Linux.',
      );
    } else {
      console.info(`[NativeSandbox] Using isolation method: ${method}`);
    }

    // Ensure working directory exists if specified
    if (this.config.workingDirectory) {
      await fs.mkdir(this.config.workingDirectory, { recursive: true });
    }

    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  async destroy(): Promise<void> {
    this.running = false;
  }

  // ---------------------------------------------------------------------------
  // Execution
  // ---------------------------------------------------------------------------

  async exec(command: string, options?: ExecOptions): Promise<ExecResult> {
    // timeout in ExecOptions is in milliseconds; profile.timeout is in seconds
    const timeoutMs = options?.timeout ?? this.profile.timeout * 1000;
    const cwd = options?.cwd ?? this.config.workingDirectory ?? os.tmpdir();
    const extraEnv = options?.env ?? {};

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const env = this._buildSafeEnv(extraEnv);

      // spawn() is used intentionally — this IS the sandbox layer. Commands
      // are wrapped by platform isolation (sandbox-exec / bwrap) that enforce
      // the security policy before the shell ever runs.
      let proc: ReturnType<typeof spawn>;

      if (this.isolationMethod === 'sandbox-exec') {
        const sbProfile = generateSeatbeltProfile(this.profile);
        proc = spawn('sandbox-exec', ['-p', sbProfile, '/bin/sh', '-c', command], {
          cwd,
          env,
          timeout: timeoutMs,
        });
      } else if (this.isolationMethod === 'bwrap') {
        const bwrapArgs = buildBwrapArgs(this.profile, command, cwd);
        proc = spawn('bwrap', bwrapArgs, {
          env,
          timeout: timeoutMs,
        });
      } else {
        // Fallback: no OS-level isolation, but env is sanitized and timeout enforced
        proc = spawn('/bin/sh', ['-c', command], {
          cwd,
          env,
          timeout: timeoutMs,
        });
      }

      proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on('error', (err) => {
        reject(new Error(`[NativeSandbox] exec error: ${err.message}`));
      });

      proc.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 1,
        });
      });
    });
  }

  // ---------------------------------------------------------------------------
  // File I/O (with path validation)
  // ---------------------------------------------------------------------------

  async readFile(filePath: string): Promise<string> {
    this._validatePath(filePath);
    return fs.readFile(filePath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this._validatePath(filePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  async isRunning(): Promise<boolean> {
    return this.running;
  }

  getContainerId(): string | null {
    return this.running ? this.id : null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Validates that a file path is within the allowed filesystem paths defined
   * in the sandbox profile. Throws if the path is not allowed.
   */
  private _validatePath(filePath: string): void {
    const resolved = path.resolve(filePath);
    const allowed = this.profile.allowFS.some((allowedPath) => {
      const resolvedAllowed = path.resolve(allowedPath);
      return resolved.startsWith(resolvedAllowed + path.sep) || resolved === resolvedAllowed;
    });

    if (!allowed) {
      throw new Error(
        `[NativeSandbox] Access denied: path "${filePath}" is not within allowed filesystem paths: ` +
          JSON.stringify(this.profile.allowFS),
      );
    }
  }

  /**
   * Builds a sanitized environment for child processes.
   * Removes sensitive variables (secrets, tokens, credentials) and merges
   * any additional environment variables provided by the caller.
   */
  private _buildSafeEnv(extra: Record<string, string>): Record<string, string> {
    const SENSITIVE_PATTERNS = [
      /SECRET/i,
      /TOKEN/i,
      /PASSWORD/i,
      /PASSWD/i,
      /API_KEY/i,
      /PRIVATE_KEY/i,
      /CREDENTIAL/i,
      /AUTH/i,
      /AWS_/i,
      /GCP_/i,
      /AZURE_/i,
    ];

    const safeEnv: Record<string, string> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      const isSensitive = SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
      if (!isSensitive) {
        safeEnv[key] = value;
      }
    }

    // Merge caller-provided env vars
    Object.assign(safeEnv, extra);

    return safeEnv;
  }
}

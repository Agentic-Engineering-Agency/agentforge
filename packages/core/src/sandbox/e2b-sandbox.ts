/**
 * E2B Cloud Sandbox integration for AgentForge.
 *
 * @e2b/code-interpreter is an OPTIONAL dependency.
 * Install it only when you need cloud sandboxing:
 *   npm install @e2b/code-interpreter
 *
 * For local/Docker sandboxing, use @agentforge-ai/sandbox instead.
 */

/**
 * Configuration for the SandboxManager.
 */
export interface SandboxConfig {
  /**
   * The default execution timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;
}

/**
 * Options for a specific sandbox run.
 */
export interface SandboxRunOptions {
  /**
   * The execution timeout in milliseconds for this specific run.
   */
  timeout?: number;
}

/**
 * Represents the result of a sandbox code execution.
 */
export interface SandboxResult {
  /** The output/results from the code execution. */
  output: unknown;
  /** Stdout logs produced during execution. */
  stdout?: string[];
  /** Stderr logs produced during execution. */
  stderr?: string[];
}

/**
 * A custom error class for sandbox timeouts.
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * A custom error class for sandbox execution errors.
 */
export class SandboxExecutionError extends Error {
  /** The name of the execution error (e.g., 'SyntaxError'). */
  public readonly errorName: string;
  /** The raw traceback from the sandbox. */
  public readonly traceback: string;

  constructor(name: string, value: string, traceback: string) {
    super(`${name}: ${value}`);
    this.name = 'SandboxExecutionError';
    this.errorName = name;
    this.traceback = traceback;
  }
}

/**
 * Manages the lifecycle of E2B cloud sandboxes for secure code execution.
 *
 * Requires @e2b/code-interpreter to be installed (optional dependency).
 * For local/Docker sandboxing, use @agentforge-ai/sandbox instead.
 *
 * @example
 * ```typescript
 * const manager = new SandboxManager({ timeout: 10000 });
 * const result = await manager.runCode('1 + 1');
 * console.log(result); // { output: [...], stdout: [], stderr: [] }
 * ```
 */
export class SandboxManager {
  private sandbox: unknown = null;
  private defaultTimeout: number;

  constructor(config: SandboxConfig = {}) {
    this.defaultTimeout = config.timeout ?? 30000;
  }

  /**
   * Executes a snippet of code within a secure E2B cloud sandbox.
   *
   * @throws Error if @e2b/code-interpreter is not installed
   * @throws {SandboxExecutionError} If the code throws an error.
   */
  async runCode(code: string, options?: SandboxRunOptions): Promise<SandboxResult> {
    const timeoutMs = options?.timeout ?? this.defaultTimeout;

    let E2BSandbox: { create: () => Promise<unknown> };
    try {
      const mod = await import('@e2b/code-interpreter');
      E2BSandbox = mod.Sandbox as typeof E2BSandbox;
    } catch {
      throw new Error(
        '@e2b/code-interpreter is not installed. ' +
        'Run: npm install @e2b/code-interpreter\n' +
        'For local/Docker sandboxing, use @agentforge-ai/sandbox instead.'
      );
    }

    try {
      this.sandbox = await E2BSandbox.create();
      const sb = this.sandbox as {
        runCode: (code: string, opts: { timeoutMs: number }) => Promise<{
          error?: { name: string; value: string; traceback: string };
          results: unknown;
          logs: { stdout: string[]; stderr: string[] };
        }>;
        kill: () => Promise<void>;
      };
      const execution = await sb.runCode(code, { timeoutMs });

      if (execution.error) {
        throw new SandboxExecutionError(
          execution.error.name,
          execution.error.value,
          execution.error.traceback,
        );
      }

      return {
        output: execution.results,
        stdout: execution.logs.stdout,
        stderr: execution.logs.stderr,
      };
    } finally {
      if (this.sandbox) {
        const sb = this.sandbox as { kill: () => Promise<void> };
        await sb.kill();
        this.sandbox = null;
      }
    }
  }

  /**
   * Terminates the sandbox and releases all associated resources.
   */
  async cleanup(): Promise<void> {
    if (this.sandbox) {
      const sb = this.sandbox as { kill: () => Promise<void> };
      await sb.kill();
      this.sandbox = null;
    }
  }
}

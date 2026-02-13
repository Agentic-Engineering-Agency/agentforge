import { Sandbox } from '@e2b/code-interpreter';

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
 * Manages the lifecycle of E2B sandboxes for secure code execution.
 *
 * All tool code execution in AgentForge MUST occur within an E2B sandbox
 * to ensure security isolation and prevent malicious code from affecting
 * the host system.
 *
 * @example
 * ```typescript
 * const manager = new SandboxManager({ timeout: 10000 });
 * const result = await manager.runCode('1 + 1');
 * console.log(result); // { output: [...], stdout: [], stderr: [] }
 * ```
 */
export class SandboxManager {
  private sandbox: Sandbox | null = null;
  private defaultTimeout: number;

  /**
   * Creates a new SandboxManager.
   * @param config - The configuration for the sandbox manager.
   */
  constructor(config: SandboxConfig = {}) {
    this.defaultTimeout = config.timeout ?? 30000;
  }

  /**
   * Executes a snippet of code within a secure E2B sandbox.
   *
   * @param code - The code to execute.
   * @param options - Options for this specific run.
   * @returns A promise that resolves to the result of the code execution.
   * @throws {SandboxExecutionError} If the code throws an error.
   */
  async runCode(code: string, options?: SandboxRunOptions): Promise<SandboxResult> {
    const timeoutMs = options?.timeout ?? this.defaultTimeout;

    try {
      this.sandbox = await Sandbox.create();
      const execution = await this.sandbox.runCode(code, { timeoutMs });

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
        await this.sandbox.kill();
        this.sandbox = null;
      }
    }
  }

  /**
   * Terminates the sandbox and releases all associated resources.
   * @returns A promise that resolves when the cleanup is complete.
   */
  async cleanup(): Promise<void> {
    if (this.sandbox) {
      await this.sandbox.kill();
      this.sandbox = null;
    }
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SandboxManager, SandboxExecutionError } from './sandbox';

// Mock the E2B Sandbox
const mockRunCode = vi.fn();
const mockKill = vi.fn();

vi.mock('@e2b/code-interpreter', () => ({
  Sandbox: {
    create: vi.fn(() =>
      Promise.resolve({
        runCode: mockRunCode,
        kill: mockKill,
      })
    ),
  },
}));

describe('SandboxManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKill.mockResolvedValue(undefined);
  });

  it('should create a sandbox manager with default config', () => {
    const manager = new SandboxManager();
    expect(manager).toBeInstanceOf(SandboxManager);
  });

  it('should create a sandbox manager with custom timeout', () => {
    const manager = new SandboxManager({ timeout: 10000 });
    expect(manager).toBeInstanceOf(SandboxManager);
  });

  it('runCode() should execute code and return the result', async () => {
    const manager = new SandboxManager();
    mockRunCode.mockResolvedValue({
      results: [{ text: '2' }],
      error: undefined,
      logs: { stdout: ['2'], stderr: [] },
    });

    const result = await manager.runCode('1 + 1');
    expect(result.output).toEqual([{ text: '2' }]);
    expect(result.stdout).toEqual(['2']);
    expect(result.stderr).toEqual([]);
    expect(mockRunCode).toHaveBeenCalledWith('1 + 1', { timeoutMs: 30000 });
    expect(mockKill).toHaveBeenCalled();
  });

  it('runCode() should use custom timeout from options', async () => {
    const manager = new SandboxManager();
    mockRunCode.mockResolvedValue({
      results: [],
      error: undefined,
      logs: { stdout: [], stderr: [] },
    });

    await manager.runCode('code', { timeout: 5000 });
    expect(mockRunCode).toHaveBeenCalledWith('code', { timeoutMs: 5000 });
  });

  it('runCode() should throw SandboxExecutionError on code errors', async () => {
    const manager = new SandboxManager();
    mockRunCode.mockResolvedValue({
      results: [],
      error: {
        name: 'ReferenceError',
        value: 'x is not defined',
        traceback: 'Traceback...',
      },
      logs: { stdout: [], stderr: [] },
    });

    await expect(manager.runCode('x')).rejects.toThrow(SandboxExecutionError);
    await expect(manager.runCode('x')).rejects.toThrow('ReferenceError: x is not defined');
    expect(mockKill).toHaveBeenCalled();
  });

  it('cleanup() should be safe to call when no sandbox exists', async () => {
    const manager = new SandboxManager();
    await expect(manager.cleanup()).resolves.toBeUndefined();
  });
});

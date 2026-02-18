import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { runProject } from './run.js';

// Mock child_process.spawn
const mockOn = vi.fn();
const mockKill = vi.fn();
const mockSpawn = vi.fn(() => ({
  on: mockOn,
  kill: mockKill,
}));

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

describe('runProject', () => {
  let tmpDir: string;
  const originalCwd = process.cwd();
  const originalExit = process.exit;

  beforeEach(async () => {
    tmpDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-run-test-')));
    process.chdir(tmpDir);
    mockSpawn.mockClear();
    mockOn.mockClear();
    mockKill.mockClear();
    process.exit = vi.fn((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.exit = originalExit;
    await fs.remove(tmpDir);
  });

  it('should error if no package.json found', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      runProject({ port: '3000' })
    ).rejects.toThrow('process.exit(1)');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No package.json found')
    );
    consoleSpy.mockRestore();
  });

  it('should error if no convex/ directory found', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      runProject({ port: '3000' })
    ).rejects.toThrow('process.exit(1)');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No convex/ directory found')
    );
    consoleSpy.mockRestore();
  });

  it('should start the Convex dev server when project is valid', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);

    await runProject({ port: '4000' });

    expect(mockSpawn).toHaveBeenCalledWith('npx', ['convex', 'dev'], expect.objectContaining({
      cwd: tmpDir,
      stdio: 'inherit',
      shell: true,
    }));

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Starting AgentForge'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('port 4000'));

    // Verify event handlers were registered
    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('close', expect.any(Function));

    // Verify process signal handlers were registered
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));

    logSpy.mockRestore();
    processOnSpy.mockRestore();
  });

  it('should handle convex process error event', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);

    await runProject({ port: '3000' });

    // Find the error handler and invoke it
    const errorCall = mockOn.mock.calls.find((call: unknown[]) => call[0] === 'error');
    expect(errorCall).toBeDefined();
    const errorHandler = errorCall![1] as (err: Error) => void;

    expect(() => errorHandler(new Error('spawn failed'))).toThrow('process.exit(1)');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('spawn failed'));

    logSpy.mockRestore();
    errorSpy.mockRestore();
    processOnSpy.mockRestore();
  });

  it('should handle convex process close event with non-zero code', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);

    await runProject({ port: '3000' });

    // Find the close handler and invoke it
    const closeCall = mockOn.mock.calls.find((call: unknown[]) => call[0] === 'close');
    expect(closeCall).toBeDefined();
    const closeHandler = closeCall![1] as (code: number | null) => void;

    closeHandler(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('exited with code 1'));

    // Also test with code 0 (no error)
    errorSpy.mockClear();
    closeHandler(0);
    expect(errorSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
    processOnSpy.mockRestore();
  });

  it('should handle graceful shutdown via SIGINT', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);

    await runProject({ port: '3000' });

    // Find the SIGINT handler
    const sigintCall = processOnSpy.mock.calls.find((call: unknown[]) => call[0] === 'SIGINT');
    expect(sigintCall).toBeDefined();
    const shutdownHandler = sigintCall![1] as () => void;

    expect(() => shutdownHandler()).toThrow('process.exit(0)');
    expect(mockKill).toHaveBeenCalledWith('SIGTERM');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Shutting down'));

    logSpy.mockRestore();
    processOnSpy.mockRestore();
  });
});

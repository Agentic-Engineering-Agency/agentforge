import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { runProject } from './run.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    kill: vi.fn(),
  })),
}));

describe('runProject', () => {
  let tmpDir: string;
  const originalCwd = process.cwd();
  const originalExit = process.exit;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-run-test-'));
    process.chdir(tmpDir);
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

    await expect(runProject({ port: '3000' })).rejects.toThrow(
      'process.exit(1)'
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No package.json found')
    );
    consoleSpy.mockRestore();
  });

  it('should error if no convex directory found', async () => {
    // Create package.json but no convex dir
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runProject({ port: '3000' })).rejects.toThrow(
      'process.exit(1)'
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No convex/ directory found')
    );
    consoleSpy.mockRestore();
  });

  it('should start the dev server when project structure is valid', async () => {
    // Create valid project structure
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.mkdir(path.join(tmpDir, 'convex'));

    const { spawn } = await import('node:child_process');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runProject({ port: '3000' });

    expect(spawn).toHaveBeenCalledWith('npx', ['convex', 'dev'], {
      cwd: tmpDir,
      stdio: 'inherit',
      shell: true,
    });

    consoleSpy.mockRestore();
  });
});

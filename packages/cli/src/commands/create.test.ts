import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { createProject } from './create.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

describe('createProject', () => {
  let tmpDir: string;
  const originalCwd = process.cwd();
  const originalExit = process.exit;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-test-'));
    process.chdir(tmpDir);
    // Mock process.exit to throw instead of exiting
    process.exit = vi.fn((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.exit = originalExit;
    await fs.remove(tmpDir);
  });

  it('should error if directory already exists', async () => {
    const projectName = 'existing-project';
    await fs.mkdir(path.join(tmpDir, projectName));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      createProject(projectName, { template: 'default' })
    ).rejects.toThrow('process.exit(1)');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('already exists')
    );
    consoleSpy.mockRestore();
  });

  it('should error if template does not exist', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      createProject('my-project', { template: 'nonexistent-template' })
    ).rejects.toThrow('process.exit(1)');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('not found')
    );
    consoleSpy.mockRestore();
  });
});

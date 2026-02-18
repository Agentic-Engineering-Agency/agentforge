import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { createProject } from './create.js';

// Mock child_process
const mockExecSync = vi.fn();
vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

describe('createProject', () => {
  let tmpDir: string;
  const originalCwd = process.cwd();
  const originalExit = process.exit;

  beforeEach(async () => {
    tmpDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-test-')));
    process.chdir(tmpDir);
    mockExecSync.mockReset();
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

  it('should scaffold a project from the default template successfully', async () => {
    // We'll test the happy path by creating a mock template dir
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Since the template resolution is relative to __dirname of the compiled file,
    // we need to create the template in the right place.
    // The code resolves: path.resolve(__dirname, '..', 'templates', template)
    // In test context, __dirname is the source dir, so:
    const srcDir = path.dirname(new URL(import.meta.url).pathname);
    const templateDir = path.resolve(srcDir, '..', 'templates', 'test-template');
    await fs.ensureDir(templateDir);
    await fs.writeJson(path.join(templateDir, 'package.json'), { name: 'template', version: '0.0.0' }, { spaces: 2 });
    await fs.writeFile(path.join(templateDir, 'README.md'), '# Template');

    try {
      // Mock execSync to succeed
      mockExecSync.mockReturnValue(undefined);

      await createProject('test-project', { template: 'test-template' });

      // Verify the project was created
      const projectDir = path.join(tmpDir, 'test-project');
      expect(await fs.pathExists(projectDir)).toBe(true);
      expect(await fs.pathExists(path.join(projectDir, 'package.json'))).toBe(true);

      // Verify package.json was updated with project name
      const pkg = await fs.readJson(path.join(projectDir, 'package.json'));
      expect(pkg.name).toBe('test-project');

      // Verify pnpm install was called
      expect(mockExecSync).toHaveBeenCalledWith('pnpm install', expect.objectContaining({
        cwd: projectDir,
        stdio: 'inherit',
      }));

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('created successfully'));
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      await fs.remove(templateDir);
    }
  });

  it('should handle pnpm install failure gracefully', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create a fake template
    const srcDir = path.dirname(new URL(import.meta.url).pathname);
    const templateDir = path.resolve(srcDir, '..', 'templates', 'test-template2');
    await fs.ensureDir(templateDir);
    await fs.writeJson(path.join(templateDir, 'package.json'), { name: 'template', version: '0.0.0' }, { spaces: 2 });

    try {
      // Mock execSync to fail
      mockExecSync.mockImplementation(() => {
        throw new Error('pnpm not found');
      });

      await createProject('test-project-fail', { template: 'test-template2' });

      // Should still complete, just with a warning
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not install dependencies')
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('created successfully'));
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      await fs.remove(templateDir);
    }
  });

  it('should scaffold a project without package.json in template', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create a fake template without package.json
    const srcDir = path.dirname(new URL(import.meta.url).pathname);
    const templateDir = path.resolve(srcDir, '..', 'templates', 'no-pkg-template');
    await fs.ensureDir(templateDir);
    await fs.writeFile(path.join(templateDir, 'README.md'), '# No Pkg');

    try {
      mockExecSync.mockReturnValue(undefined);
      await createProject('no-pkg-project', { template: 'no-pkg-template' });

      const projectDir = path.join(tmpDir, 'no-pkg-project');
      expect(await fs.pathExists(projectDir)).toBe(true);
      // package.json should not exist since template didn't have one
      expect(await fs.pathExists(path.join(projectDir, 'package.json'))).toBe(false);
    } finally {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      await fs.remove(templateDir);
    }
  });
});

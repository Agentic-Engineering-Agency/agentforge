import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { deployProject, parseEnvFile } from './deploy.js';

// Mock child_process.execSync
const mockExecSync = vi.fn();
vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

describe('parseEnvFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-env-test-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should parse simple key=value pairs', () => {
    const envPath = path.join(tmpDir, '.env');
    fs.writeFileSync(envPath, 'API_KEY=abc123\nDB_URL=postgres://localhost');
    const vars = parseEnvFile(envPath);
    expect(vars).toEqual({ API_KEY: 'abc123', DB_URL: 'postgres://localhost' });
  });

  it('should skip comments and empty lines', () => {
    const envPath = path.join(tmpDir, '.env');
    fs.writeFileSync(envPath, '# This is a comment\n\nKEY=value\n  \n# Another comment');
    const vars = parseEnvFile(envPath);
    expect(vars).toEqual({ KEY: 'value' });
  });

  it('should handle quoted values', () => {
    const envPath = path.join(tmpDir, '.env');
    fs.writeFileSync(envPath, 'DOUBLE="hello world"\nSINGLE=\'foo bar\'');
    const vars = parseEnvFile(envPath);
    expect(vars).toEqual({ DOUBLE: 'hello world', SINGLE: 'foo bar' });
  });

  it('should handle values with equals signs', () => {
    const envPath = path.join(tmpDir, '.env');
    fs.writeFileSync(envPath, 'URL=https://example.com?a=1&b=2');
    const vars = parseEnvFile(envPath);
    expect(vars).toEqual({ URL: 'https://example.com?a=1&b=2' });
  });

  it('should skip lines without equals sign', () => {
    const envPath = path.join(tmpDir, '.env');
    fs.writeFileSync(envPath, 'VALID=yes\nINVALID_LINE\nALSO_VALID=true');
    const vars = parseEnvFile(envPath);
    expect(vars).toEqual({ VALID: 'yes', ALSO_VALID: 'true' });
  });

  it('should handle empty values', () => {
    const envPath = path.join(tmpDir, '.env');
    fs.writeFileSync(envPath, 'EMPTY=\nNONEMPTY=value');
    const vars = parseEnvFile(envPath);
    expect(vars).toEqual({ EMPTY: '', NONEMPTY: 'value' });
  });
});

describe('deployProject', () => {
  let tmpDir: string;
  const originalCwd = process.cwd();
  const originalExit = process.exit;

  const defaultOptions = {
    env: '.env.production',
    dryRun: false,
    rollback: false,
    force: false,
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-deploy-test-'));
    process.chdir(tmpDir);
    mockExecSync.mockReset();
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
      deployProject(defaultOptions)
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
      deployProject(defaultOptions)
    ).rejects.toThrow('process.exit(1)');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No convex/ directory found')
    );
    consoleSpy.mockRestore();
  });

  it('should error if env file not found for actual deployment', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      deployProject(defaultOptions)
    ).rejects.toThrow('process.exit(1)');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('not found')
    );
    consoleSpy.mockRestore();
  });

  it('should display dry-run information without executing', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));
    await fs.writeFile(path.join(tmpDir, '.env.production'), 'API_KEY=secret123\nDB_URL=postgres://prod');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await deployProject({ ...defaultOptions, dryRun: true });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Dry run'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('API_KEY'));
    expect(mockExecSync).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('should handle dry-run without env file gracefully', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await deployProject({ ...defaultOptions, dryRun: true });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Dry run'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No environment variables'));
    expect(mockExecSync).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('should execute rollback command when --rollback is set', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockExecSync.mockReturnValue(undefined);

    await deployProject({ ...defaultOptions, rollback: true });

    expect(mockExecSync).toHaveBeenCalledWith('npx convex deploy --rollback', expect.objectContaining({
      cwd: tmpDir,
      stdio: 'inherit',
    }));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Rollback completed'));

    logSpy.mockRestore();
  });

  it('should handle rollback failure', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockExecSync.mockImplementation(() => { throw new Error('rollback failed'); });

    await expect(
      deployProject({ ...defaultOptions, rollback: true })
    ).rejects.toThrow('process.exit(1)');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Rollback failed'));

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should deploy successfully with --force', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));
    await fs.writeFile(path.join(tmpDir, '.env.production'), 'API_KEY=secret123');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockExecSync.mockReturnValue(undefined);

    await deployProject({ ...defaultOptions, force: true });

    // Should have set env vars
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('npx convex env set API_KEY'),
      expect.any(Object)
    );
    // Should have deployed
    expect(mockExecSync).toHaveBeenCalledWith('npx convex deploy', expect.objectContaining({
      cwd: tmpDir,
      stdio: 'inherit',
    }));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Deployment completed'));

    logSpy.mockRestore();
  });

  it('should deploy without --force and show confirmation info', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));
    await fs.writeFile(path.join(tmpDir, '.env.production'), 'KEY=val');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockExecSync.mockReturnValue(undefined);

    await deployProject(defaultOptions);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Deployment plan'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Deployment completed'));

    logSpy.mockRestore();
  });

  it('should handle deployment failure gracefully', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));
    await fs.writeFile(path.join(tmpDir, '.env.production'), 'KEY=val');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // env set succeeds, deploy fails
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('convex deploy') && !cmd.includes('env set')) {
        throw new Error('deploy failed');
      }
      return undefined;
    });

    await expect(
      deployProject({ ...defaultOptions, force: true })
    ).rejects.toThrow('process.exit(1)');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Deployment failed'));

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should handle env var set failure gracefully', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));
    await fs.writeFile(path.join(tmpDir, '.env.production'), 'KEY1=val1\nKEY2=val2');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // First env set fails, second succeeds, deploy succeeds
    let callCount = 0;
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('env set')) {
        callCount++;
        if (callCount === 1) throw new Error('env set failed');
      }
      return undefined;
    });

    await deployProject({ ...defaultOptions, force: true });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to set KEY1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✅ KEY2'));

    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('should use custom env file path', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));
    await fs.writeFile(path.join(tmpDir, '.env.staging'), 'STAGE_KEY=staging_val');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockExecSync.mockReturnValue(undefined);

    await deployProject({ ...defaultOptions, env: '.env.staging', force: true });

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining('STAGE_KEY'),
      expect.any(Object)
    );

    logSpy.mockRestore();
  });

  it('should deploy with empty env file', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));
    await fs.writeFile(path.join(tmpDir, '.env.production'), '# Only comments\n\n');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockExecSync.mockReturnValue(undefined);

    await deployProject({ ...defaultOptions, force: true });

    // Should not have called env set
    const envSetCalls = mockExecSync.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('env set')
    );
    expect(envSetCalls).toHaveLength(0);

    // Should still deploy
    expect(mockExecSync).toHaveBeenCalledWith('npx convex deploy', expect.any(Object));

    logSpy.mockRestore();
  });

  it('should mask env var values in dry-run output', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));
    await fs.writeFile(path.join(tmpDir, '.env.production'), 'SHORT=ab\nLONG=abcdefghij');

    const logOutput: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logOutput.push(args.join(' '));
    });

    await deployProject({ ...defaultOptions, dryRun: true });

    // SHORT value should show first 4 chars (or less) with masking
    const shortLine = logOutput.find(l => l.includes('SHORT'));
    expect(shortLine).toBeDefined();

    // LONG value should be masked
    const longLine = logOutput.find(l => l.includes('LONG'));
    expect(longLine).toBeDefined();
    expect(longLine).toContain('*');

    logSpy.mockRestore();
  });
});

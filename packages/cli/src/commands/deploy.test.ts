import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { 
  deployProject, 
  parseEnvFile, 
  readAgentForgeConfig,
  type DeployOptions 
} from './deploy.js';

// Mock child_process.execSync and execFile
const mockExecSync = vi.fn();
const mockExecFileCalls: Array<[unknown, unknown, unknown]> = [];
vi.mock('node:child_process', () => {
  const actual = vi.importActual('node:child_process');
  return {
    ...actual,
    execSync: (...args: unknown[]) => mockExecSync(...args),
    execFile: (
      file: unknown,
      args: unknown,
      options: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void
    ) => {
      // Track the call for verification
      mockExecFileCalls.push([file, args, options]);
      // Simulate successful execFile call - invoke callback immediately
      callback(null, '', '');
    },
  };
});

// Mock credentials module
const mockReadCredentials = vi.fn();
const mockGetCloudUrl = vi.fn();
vi.mock('../lib/credentials.js', () => ({
  readCredentials: (...args: unknown[]) => mockReadCredentials(...args),
  getCloudUrl: (...args: unknown[]) => mockGetCloudUrl(...args),
  getCredentialsPath: () => '/home/test/.agentforge/credentials.json',
}));

// Mock cloud-client
const mockAuthenticate = vi.fn();
const mockGetProject = vi.fn();
const mockCreateDeployment = vi.fn();
const mockGetDeploymentStatus = vi.fn();

vi.mock('../lib/cloud-client.js', () => ({
  CloudClient: vi.fn().mockImplementation(() => ({
    authenticate: mockAuthenticate,
    getProject: mockGetProject,
    createDeployment: mockCreateDeployment,
    getDeploymentStatus: mockGetDeploymentStatus,
  })),
  CloudClientError: class CloudClientError extends Error {
    constructor(message: string, public code?: string, public status?: number) {
      super(message);
      this.name = 'CloudClientError';
    }
  },
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

describe('readAgentForgeConfig', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-config-test-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('should parse agentforge.json', async () => {
    const configPath = path.join(tmpDir, 'agentforge.json');
    fs.writeFileSync(configPath, JSON.stringify({
      projectId: 'test-project',
      agents: [{ name: 'Test Agent', instructions: 'Be helpful', model: 'gpt-4o' }],
    }));
    
    const config = await readAgentForgeConfig(tmpDir);
    expect(config?.projectId).toBe('test-project');
    expect(config?.agents).toHaveLength(1);
  });

  it('should return null when no config exists', async () => {
    const config = await readAgentForgeConfig(tmpDir);
    expect(config).toBeNull();
  });

  it('should handle invalid JSON gracefully', async () => {
    const configPath = path.join(tmpDir, 'agentforge.json');
    fs.writeFileSync(configPath, 'invalid json {{{');
    
    const config = await readAgentForgeConfig(tmpDir);
    expect(config).toBeNull();
  });
});

describe('deployProject - Convex provider', () => {
  let tmpDir: string;
  const originalCwd = process.cwd();
  const originalExit = process.exit;

  const defaultOptions: DeployOptions = {
    env: '.env.production',
    dryRun: false,
    rollback: false,
    force: false,
    provider: 'convex',
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-deploy-test-'));
    process.chdir(tmpDir);
    mockExecSync.mockReset();
    mockExecFileCalls.length = 0;
    process.exit = vi.fn((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never;
    // Reset credentials mock
    mockReadCredentials.mockReset();
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

  it('should execute rollback command when --rollback is set', async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockExecSync.mockReturnValue(undefined);

    await deployProject({ ...defaultOptions, rollback: true });

    expect(mockExecSync).toHaveBeenCalledWith('npx convex deploy --rollback', expect.objectContaining({
      stdio: 'inherit',
    }));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Rollback completed'));

    logSpy.mockRestore();
  });

  it('should deploy successfully with --force', { timeout: 10000 }, async () => {
    await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
    await fs.ensureDir(path.join(tmpDir, 'convex'));
    await fs.writeFile(path.join(tmpDir, '.env.production'), 'API_KEY=secret123');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockExecSync.mockReturnValue(undefined);

    await deployProject({ ...defaultOptions, force: true });

    // Should have set env vars using execFile (new security fix)
    expect(mockExecFileCalls.length).toBe(1);
    const [file, args, options] = mockExecFileCalls[0];
    expect(file).toBe('npx');
    expect(args).toEqual(['convex', 'env', 'set', 'API_KEY', 'secret123']);
    expect(options).toMatchObject({
      cwd: tmpDir,
    });
    // Should have deployed
    expect(mockExecSync).toHaveBeenCalledWith('npx convex deploy', expect.objectContaining({
      cwd: tmpDir,
      stdio: 'inherit',
    }));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Deployment completed'));

    logSpy.mockRestore();
  });
});

describe('deployProject - Cloud provider', () => {
  let tmpDir: string;
  const originalCwd = process.cwd();
  const originalExit = process.exit;

  const cloudOptions: DeployOptions = {
    env: '.env.production',
    dryRun: false,
    rollback: false,
    force: false,
    provider: 'cloud',
    project: 'test-project',
  };

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-cloud-deploy-test-'));
    process.chdir(tmpDir);
    process.exit = vi.fn((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never;

    // Reset mocks
    mockReadCredentials.mockReset();
    mockGetCloudUrl.mockReset();
    mockAuthenticate.mockReset();
    mockGetProject.mockReset();
    mockCreateDeployment.mockReset();
    mockGetDeploymentStatus.mockReset();
    mockExecSync.mockReset();
    mockExecFileCalls.length = 0;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.exit = originalExit;
    await fs.remove(tmpDir);
  });

  it('should error if not authenticated', async () => {
    mockReadCredentials.mockResolvedValue(null);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      deployProject(cloudOptions)
    ).rejects.toThrow('process.exit(1)');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should error if no project ID specified', async () => {
    mockReadCredentials.mockResolvedValue({ apiKey: 'test-key', cloudUrl: 'https://cloud.agentforge.ai' });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      deployProject({ ...cloudOptions, project: undefined })
    ).rejects.toThrow('process.exit(1)');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should error if no agents in config', async () => {
    mockReadCredentials.mockResolvedValue({ apiKey: 'test-key', cloudUrl: 'https://cloud.agentforge.ai' });
    
    // Write empty config
    await fs.writeFile(path.join(tmpDir, 'agentforge.json'), JSON.stringify({ projectId: 'test-project' }));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      deployProject(cloudOptions)
    ).rejects.toThrow('process.exit(1)');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should show dry-run info for cloud deployments', async () => {
    mockReadCredentials.mockResolvedValue({ apiKey: 'test-key', cloudUrl: 'https://cloud.agentforge.ai' });
    
    // Write config with agents
    await fs.writeFile(path.join(tmpDir, 'agentforge.json'), JSON.stringify({
      projectId: 'test-project',
      agents: [{ name: 'Test Agent', instructions: 'Be helpful', model: 'gpt-4o' }],
    }));

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await deployProject({ ...cloudOptions, dryRun: true });

    expect(logSpy).toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('should call cloud client methods when deploying', async () => {
    mockReadCredentials.mockResolvedValue({ apiKey: 'test-key', cloudUrl: 'https://cloud.agentforge.ai' });
    mockAuthenticate.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
    mockGetProject.mockResolvedValue({ id: 'test-project', name: 'Test Project' });
    mockCreateDeployment.mockResolvedValue({ deploymentId: 'dep-123', status: 'pending' });
    mockGetDeploymentStatus.mockResolvedValue({ id: 'dep-123', status: 'completed', url: 'https://api.agentforge.ai/test' });
    
    // Write config with agents
    await fs.writeFile(path.join(tmpDir, 'agentforge.json'), JSON.stringify({
      projectId: 'test-project',
      agents: [{ name: 'Test Agent', instructions: 'Be helpful', model: 'gpt-4o' }],
    }));

    await deployProject(cloudOptions);

    expect(mockAuthenticate).toHaveBeenCalled();
    expect(mockGetProject).toHaveBeenCalledWith('test-project');
    expect(mockCreateDeployment).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'test-project',
      agents: expect.any(Array),
    }));
    expect(mockGetDeploymentStatus).toHaveBeenCalledWith('dep-123');
  }, 15000);

  it('should exit when deployment fails', async () => {
    mockReadCredentials.mockResolvedValue({ apiKey: 'test-key', cloudUrl: 'https://cloud.agentforge.ai' });
    mockAuthenticate.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
    mockGetProject.mockResolvedValue({ id: 'test-project', name: 'Test Project' });
    mockCreateDeployment.mockResolvedValue({ deploymentId: 'dep-123', status: 'pending' });
    mockGetDeploymentStatus.mockResolvedValue({ id: 'dep-123', status: 'failed', errorMessage: 'Build failed' });
    
    // Write config with agents
    await fs.writeFile(path.join(tmpDir, 'agentforge.json'), JSON.stringify({
      projectId: 'test-project',
      agents: [{ name: 'Test Agent', instructions: 'Be helpful', model: 'gpt-4o' }],
    }));

    await expect(
      deployProject(cloudOptions)
    ).rejects.toThrow('process.exit(1)');

    expect(mockGetDeploymentStatus).toHaveBeenCalled();
  }, 15000);

  it('should exit on authentication failure', async () => {
    mockReadCredentials.mockResolvedValue({ apiKey: 'invalid-key', cloudUrl: 'https://cloud.agentforge.ai' });
    mockAuthenticate.mockRejectedValue(new Error('Invalid API key'));
    
    // Write config with agents
    await fs.writeFile(path.join(tmpDir, 'agentforge.json'), JSON.stringify({
      projectId: 'test-project',
      agents: [{ name: 'Test Agent', instructions: 'Be helpful', model: 'gpt-4o' }],
    }));

    await expect(
      deployProject(cloudOptions)
    ).rejects.toThrow('process.exit(1)');

    expect(mockAuthenticate).toHaveBeenCalled();
  });
});

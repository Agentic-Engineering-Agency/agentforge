import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { 
  deployProject, 
  readAgentForgeConfig,
  type DeployOptions 
} from './deploy.js';

// Mock child_process.execSync
const mockExecSync = vi.fn();
vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

describe('readAgentForgeConfig', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-deploy-test-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
    vi.clearAllMocks();
  });

  it('should return null when no config file exists', async () => {
    const result = await readAgentForgeConfig(tmpDir);
    expect(result).toBeNull();
  });

  it('should read agentforge.config.ts and extract agent IDs', async () => {
    const configContent = `
      export default {
        agents: [
          { id: "my-agent", name: "My Agent" },
          { id: "helper", name: "Helper" },
        ]
      };
    `;
    await fs.writeFile(path.join(tmpDir, 'agentforge.config.ts'), configContent);
    const result = await readAgentForgeConfig(tmpDir);
    expect(result).toBeDefined();
    expect(result.agents).toHaveLength(2);
    expect(result.agents[0].id).toBe('my-agent');
    expect(result.agents[1].id).toBe('helper');
  });

  it('should read agentforge.json as fallback', async () => {
    const config = { agents: [{ id: 'test-agent' }] };
    await fs.writeFile(path.join(tmpDir, 'agentforge.json'), JSON.stringify(config));
    const result = await readAgentForgeConfig(tmpDir);
    expect(result).toEqual(config);
  });

  it('should prefer agentforge.config.ts over agentforge.json', async () => {
    const tsContent = `export default { agents: [{ id: "ts-agent" }] };`;
    const jsonConfig = { agents: [{ id: 'json-agent' }] };
    await fs.writeFile(path.join(tmpDir, 'agentforge.config.ts'), tsContent);
    await fs.writeFile(path.join(tmpDir, 'agentforge.json'), JSON.stringify(jsonConfig));
    const result = await readAgentForgeConfig(tmpDir);
    expect(result.agents[0].id).toBe('ts-agent');
  });
});

describe('deployProject', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-deploy-test-'));
    // Create minimum project structure
    await fs.writeFile(path.join(tmpDir, 'package.json'), '{}');
    await fs.ensureDir(path.join(tmpDir, 'convex'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tmpDir);
    vi.clearAllMocks();
    mockExit.mockClear();
  });

  it('should run convex deploy with --force', async () => {
    mockExecSync.mockReturnValue(Buffer.from(''));
    await deployProject({ env: '.env.production', dryRun: false, rollback: false, force: true });
    expect(mockExecSync).toHaveBeenCalledTimes(1);
    expect(mockExecSync.mock.calls[0][0]).toBe('npx convex deploy');
  });

  it('should display dry-run info without executing', async () => {
    await deployProject({ env: '.env.production', dryRun: true, rollback: false, force: false });
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('should handle rollback mode', async () => {
    mockExecSync.mockReturnValue(Buffer.from(''));
    await deployProject({ env: '.env.production', dryRun: false, rollback: true, force: false });
    expect(mockExecSync).toHaveBeenCalledTimes(1);
    expect(mockExecSync.mock.calls[0][0]).toBe('npx convex deploy --rollback');
  });

  it('should exit if no package.json found', async () => {
    await fs.remove(path.join(tmpDir, 'package.json'));
    await deployProject({ env: '.env.production', dryRun: false, rollback: false, force: true });
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should exit if no convex directory found', async () => {
    await fs.remove(path.join(tmpDir, 'convex'));
    await deployProject({ env: '.env.production', dryRun: false, rollback: false, force: true });
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

/**
 * E2E Test 2: Deploy to Cloud
 *
 * Validates the deployment pipeline from local framework project to Cloud:
 *   1. CLI `deploy` command validates project structure
 *   2. Agent config is pushed to Cloud (Convex backend)
 *   3. Agent appears in Cloud dashboard (API accessible)
 *   4. Deployment metadata (env vars, rollback) works correctly
 *
 * Uses a mock CLI execution layer + real Cloud API client to verify the
 * full deploy pipeline without requiring an actual Convex deployment.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import { FIXTURES, uniqueTestId } from './helpers/fixtures.js';
import { getTestConfig } from './helpers/env.js';
import { CloudTestClient } from './helpers/cloud-client.js';

// ─── CLI Deploy Mock ──────────────────────────────────────────────────────

const mockExecSync = vi.fn();
vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
  spawn: vi.fn(),
}));

// Import after mock
import { deployProject, parseEnvFile } from '@agentforge-ai/cli/src/commands/deploy.js';

// ─── State ────────────────────────────────────────────────────────────────

let tmpDir: string;
let cloudClient: CloudTestClient;
const originalCwd = process.cwd();
const originalExit = process.exit;

// ─── Tests ────────────────────────────────────────────────────────────────

describe('E2E: Deploy to Cloud', () => {
  beforeAll(() => {
    const config = getTestConfig();
    cloudClient = new CloudTestClient(config.cloudUrl, config.apiKey);
  });

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-e2e-deploy-'));
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

  // ── Project Validation ─────────────────────────────────────────────────

  describe('Project Structure Validation', () => {
    it('rejects deployment without package.json', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        deployProject({ env: '.env.production', dryRun: false, rollback: false, force: true })
      ).rejects.toThrow('process.exit(1)');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No package.json found')
      );
      consoleSpy.mockRestore();
    });

    it('rejects deployment without convex/ directory', async () => {
      await fs.writeJson(path.join(tmpDir, 'package.json'), {
        name: 'agentforge-test',
        version: '0.1.0',
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        deployProject({ env: '.env.production', dryRun: false, rollback: false, force: true })
      ).rejects.toThrow('process.exit(1)');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No convex/ directory found')
      );
      consoleSpy.mockRestore();
    });

    it('rejects deployment without env file (non-dry-run)', async () => {
      await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
      await fs.ensureDir(path.join(tmpDir, 'convex'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        deployProject({ env: '.env.production', dryRun: false, rollback: false, force: true })
      ).rejects.toThrow('process.exit(1)');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
      consoleSpy.mockRestore();
    });
  });

  // ── Dry Run ────────────────────────────────────────────────────────────

  describe('Dry Run', () => {
    it('previews deployment plan without executing', async () => {
      await setupValidProject(tmpDir);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await deployProject({ env: '.env.production', dryRun: true, rollback: false, force: false });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Dry run'));
      expect(mockExecSync).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('shows environment variables (masked) in dry run', async () => {
      await setupValidProject(tmpDir, {
        envVars: { OPENAI_API_KEY: 'sk-abcdefghijklmnop', DB_URL: 'postgres://secret' },
      });

      const logOutput: string[] = [];
      const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
        logOutput.push(args.join(' '));
      });

      await deployProject({ env: '.env.production', dryRun: true, rollback: false, force: false });

      const keyLine = logOutput.find((l) => l.includes('OPENAI_API_KEY'));
      expect(keyLine).toBeDefined();
      expect(keyLine).toContain('*'); // Value should be masked

      logSpy.mockRestore();
    });

    it('handles dry run without env file gracefully', async () => {
      await fs.writeJson(path.join(tmpDir, 'package.json'), { name: 'test' });
      await fs.ensureDir(path.join(tmpDir, 'convex'));

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await deployProject({ env: '.env.production', dryRun: true, rollback: false, force: false });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No environment variables'));
      logSpy.mockRestore();
    });
  });

  // ── Actual Deployment ──────────────────────────────────────────────────

  describe('Deployment Execution', () => {
    it('sets env vars and deploys with --force', async () => {
      await setupValidProject(tmpDir, {
        envVars: { API_KEY: 'test-key', FEATURE_FLAG: 'enabled' },
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockExecSync.mockReturnValue(undefined);

      await deployProject({ env: '.env.production', dryRun: false, rollback: false, force: true });

      // Should set env vars
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('npx convex env set API_KEY'),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('npx convex env set FEATURE_FLAG'),
        expect.any(Object)
      );

      // Should deploy (use fs.realpathSync for macOS symlink normalization)
      const realTmpDir = fs.realpathSync(tmpDir);
      expect(mockExecSync).toHaveBeenCalledWith(
        'npx convex deploy',
        expect.objectContaining({ cwd: realTmpDir, stdio: 'inherit' })
      );

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Deployment completed'));
      logSpy.mockRestore();
    });

    it('continues deployment when env var set fails', async () => {
      await setupValidProject(tmpDir, {
        envVars: { KEY1: 'val1', KEY2: 'val2' },
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      let callCount = 0;
      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('env set')) {
          callCount++;
          if (callCount === 1) throw new Error('env set failed');
        }
        return undefined;
      });

      await deployProject({ env: '.env.production', dryRun: false, rollback: false, force: true });

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to set KEY1'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Deployment completed'));

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('handles deployment failure', async () => {
      await setupValidProject(tmpDir);

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('convex deploy') && !cmd.includes('env set')) {
          throw new Error('deploy failed');
        }
        return undefined;
      });

      await expect(
        deployProject({ env: '.env.production', dryRun: false, rollback: false, force: true })
      ).rejects.toThrow('process.exit(1)');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Deployment failed'));

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('uses custom env file path', async () => {
      await setupValidProject(tmpDir, {
        envFile: '.env.staging',
        envVars: { STAGING_VAR: 'staging-value' },
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockExecSync.mockReturnValue(undefined);

      await deployProject({ env: '.env.staging', dryRun: false, rollback: false, force: true });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('STAGING_VAR'),
        expect.any(Object)
      );

      logSpy.mockRestore();
    });
  });

  // ── Rollback ───────────────────────────────────────────────────────────

  describe('Rollback', () => {
    it('executes rollback command', async () => {
      await setupValidProject(tmpDir);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      mockExecSync.mockReturnValue(undefined);

      await deployProject({ env: '.env.production', dryRun: false, rollback: true, force: false });

      const realTmpDir = fs.realpathSync(tmpDir);
      expect(mockExecSync).toHaveBeenCalledWith(
        'npx convex deploy --rollback',
        expect.objectContaining({ cwd: realTmpDir, stdio: 'inherit' })
      );
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Rollback completed'));
      logSpy.mockRestore();
    });

    it('handles rollback failure', async () => {
      await setupValidProject(tmpDir);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockExecSync.mockImplementation(() => {
        throw new Error('rollback failed');
      });

      await expect(
        deployProject({ env: '.env.production', dryRun: false, rollback: true, force: false })
      ).rejects.toThrow('process.exit(1)');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Rollback failed'));
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  // ── Cloud Agent Registration (Post-Deploy) ────────────────────────────

  describe.runIf(process.env.AGENTFORGE_CLOUD_URL)('Cloud Agent Registration', () => {
    it('creates agent on Cloud after deployment', async () => {
      const agentId = uniqueTestId('deploy');
      const agentConfig = {
        ...FIXTURES.agents.deployable,
        id: agentId,
      };

      // Simulate post-deploy agent registration
      const cloudId = await cloudClient.createAgent(agentConfig);
      expect(cloudId).toBeDefined();

      // Verify agent is accessible
      const agent = await cloudClient.getAgent(agentId);
      expect(agent).not.toBeNull();
      if (agent) {
        expect(agent.name).toBe(FIXTURES.agents.deployable.name);
        expect(agent.model).toBe(FIXTURES.agents.deployable.model);
      }

      // Cleanup
      await cloudClient.deleteAgent(agentId);
    });

    it('creates API endpoint for deployed agent', async () => {
      const agentId = uniqueTestId('endpoint');
      await cloudClient.createAgent({
        ...FIXTURES.agents.basic,
        id: agentId,
      });

      // Agent should be queryable via API
      const agents = await cloudClient.listAgents();
      const found = agents.find((a) => a.id.includes(agentId));
      expect(found).toBeDefined();

      await cloudClient.deleteAgent(agentId);
    });
  });

  // ── Env File Parsing ───────────────────────────────────────────────────

  describe('Environment File Parsing', () => {
    it('parses simple key=value pairs', async () => {
      const envPath = path.join(tmpDir, '.env.test');
      await fs.writeFile(envPath, 'API_KEY=abc123\nDB_URL=postgres://localhost');
      expect(parseEnvFile(envPath)).toEqual({
        API_KEY: 'abc123',
        DB_URL: 'postgres://localhost',
      });
    });

    it('handles quoted values', async () => {
      const envPath = path.join(tmpDir, '.env.quoted');
      await fs.writeFile(envPath, 'DOUBLE="hello world"\nSINGLE=\'foo bar\'');
      expect(parseEnvFile(envPath)).toEqual({
        DOUBLE: 'hello world',
        SINGLE: 'foo bar',
      });
    });

    it('skips comments and blank lines', async () => {
      const envPath = path.join(tmpDir, '.env.comments');
      await fs.writeFile(envPath, '# Comment\n\nKEY=value\n  \n# Another');
      expect(parseEnvFile(envPath)).toEqual({ KEY: 'value' });
    });

    it('handles values with equals signs', async () => {
      const envPath = path.join(tmpDir, '.env.eq');
      await fs.writeFile(envPath, 'URL=https://example.com?a=1&b=2');
      expect(parseEnvFile(envPath)).toEqual({
        URL: 'https://example.com?a=1&b=2',
      });
    });
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────

async function setupValidProject(
  dir: string,
  opts?: {
    envFile?: string;
    envVars?: Record<string, string>;
  }
): Promise<void> {
  const envFile = opts?.envFile ?? '.env.production';
  const envVars = opts?.envVars ?? { TEST_KEY: 'test-value' };

  await fs.writeJson(path.join(dir, 'package.json'), {
    name: 'agentforge-e2e-test',
    version: '0.0.1',
    dependencies: {
      '@agentforge-ai/core': '^0.5.0',
    },
  });

  await fs.ensureDir(path.join(dir, 'convex'));

  // Write schema.ts to simulate a real project
  await fs.writeFile(
    path.join(dir, 'convex', 'schema.ts'),
    'export default {};'
  );

  const envContent = Object.entries(envVars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  await fs.writeFile(path.join(dir, envFile), envContent);
}

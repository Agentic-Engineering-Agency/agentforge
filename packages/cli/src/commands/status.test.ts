import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { registerStatusCommand } from './status.js';

const mockSpawn = vi.fn(() => ({
  on: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

describe('dashboard command', () => {
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    tmpDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-status-test-')));
    await fs.ensureDir(path.join(tmpDir, 'dashboard'));
    await fs.ensureDir(path.join(tmpDir, 'dashboard', 'node_modules'));
    await fs.writeJson(path.join(tmpDir, 'dashboard', 'package.json'), { name: 'dash' });
    await fs.writeFile(
      path.join(tmpDir, '.env.local'),
      'CONVEX_URL=https://example.convex.cloud\nAGENTFORGE_DAEMON_PORT=3010\n',
    );
    process.chdir(tmpDir);
    mockSpawn.mockClear();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tmpDir);
    vi.restoreAllMocks();
  });

  it('writes dashboard env with Convex and daemon URL', async () => {
    const program = new Command();
    registerStatusCommand(program);

    await program.parseAsync(['node', 'agentforge', 'dashboard', '--dir', tmpDir]);

    const dashEnv = await fs.readFile(path.join(tmpDir, 'dashboard', '.env.local'), 'utf-8');
    expect(dashEnv).toContain('VITE_CONVEX_URL=https://example.convex.cloud');
    expect(dashEnv).toContain('VITE_AGENTFORGE_DAEMON_URL=http://localhost:3010');
  });

  it('parses quoted daemon env values with inline comments', async () => {
    await fs.writeFile(
      path.join(tmpDir, '.env.local'),
      'CONVEX_URL="https://example.convex.cloud" # dev\nAGENTFORGE_DAEMON_URL="http://localhost:3020" # daemon\n',
    );

    const program = new Command();
    registerStatusCommand(program);

    await program.parseAsync(['node', 'agentforge', 'dashboard', '--dir', tmpDir]);

    const dashEnv = await fs.readFile(path.join(tmpDir, 'dashboard', '.env.local'), 'utf-8');
    expect(dashEnv).toContain('VITE_CONVEX_URL=https://example.convex.cloud');
    expect(dashEnv).toContain('VITE_AGENTFORGE_DAEMON_URL=http://localhost:3020');
  });
});

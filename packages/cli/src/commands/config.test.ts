/**
 * Tests for the `agentforge config` command
 *
 * Covers: config show, config set, config get subcommands.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { registerConfigCommand } from './config.js';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('../lib/convex-client.js', () => ({
  createClient: vi.fn(() => ({
    query: vi.fn(() => Promise.resolve(null)),
    mutation: vi.fn(() => Promise.resolve()),
  })),
  safeCall: vi.fn((fn: () => any) => fn()),
}));

vi.mock('../lib/display.js', () => ({
  header: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  dim: vi.fn(),
  table: vi.fn(),
  details: vi.fn(),
  colors: { cyan: '', dim: '', reset: '' },
}));

vi.mock('node:readline', () => ({
  default: {
    createInterface: vi.fn(() => ({
      question: vi.fn((_q: string, cb: (ans: string) => void) => cb('sk-test')),
      close: vi.fn(),
    })),
  },
}));

describe('agentforge config command', () => {
  let program: Command;
  let tmpDir: string;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    tmpDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'agentforge-config-test-')));
    process.chdir(tmpDir);
    program = new Command();
    registerConfigCommand(program);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tmpDir);
  });

  const getConfigCmd = () => program.commands.find((c) => c.name() === 'config');

  it('should register the config command with subcommands', () => {
    const configCmd = getConfigCmd();
    expect(configCmd).toBeDefined();

    const subcommands = configCmd?.commands.map((c) => c.name());
    expect(subcommands).toContain('show');
    expect(subcommands).toContain('set');
    expect(subcommands).toContain('get');
    expect(subcommands).toContain('init');
    expect(subcommands).toContain('provider');
  });

  describe('config show', () => {
    it('should display env file contents when .env.local exists', async () => {
      await fs.writeFile(path.join(tmpDir, '.env.local'), 'CONVEX_URL=https://test.convex.cloud\nOPENAI_API_KEY=sk-test123456');

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await program.parseAsync(['node', 'agentforge', 'config', 'show']);

      // Should have logged something (env file contents)
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should mask sensitive values (key, secret, token)', async () => {
      await fs.writeFile(path.join(tmpDir, '.env.local'), 'OPENAI_API_KEY=sk-1234567890abcdef');

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await program.parseAsync(['node', 'agentforge', 'config', 'show']);

      // Should mask the key value, showing only first 4 and last 4 chars
      const calls = logSpy.mock.calls.flat().join('');
      expect(calls).not.toContain('sk-1234567890abcdef');
      logSpy.mockRestore();
    });

    it('should show Convex status', async () => {
      const { info } = await import('../lib/display.js');
      await program.parseAsync(['node', 'agentforge', 'config', 'show']);

      expect(info).toHaveBeenCalledWith(expect.stringContaining('Convex'));
    });
  });

  describe('config set', () => {
    it('should create .env.local if it does not exist', async () => {
      const { success } = await import('../lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'config', 'set', 'MY_VAR', 'my_value']);

      const content = await fs.readFile(path.join(tmpDir, '.env.local'), 'utf-8');
      expect(content).toContain('MY_VAR=my_value');
      expect(success).toHaveBeenCalledWith(expect.stringContaining('Set MY_VAR'));
    });

    it('should update existing key in .env.local', async () => {
      await fs.writeFile(path.join(tmpDir, '.env.local'), 'EXISTING_KEY=old_value\nOTHER_KEY=keep');

      await program.parseAsync(['node', 'agentforge', 'config', 'set', 'EXISTING_KEY', 'new_value']);

      const content = await fs.readFile(path.join(tmpDir, '.env.local'), 'utf-8');
      expect(content).toContain('EXISTING_KEY=new_value');
      expect(content).toContain('OTHER_KEY=keep');
      expect(content).not.toContain('old_value');
    });

    it('should use custom --env file', async () => {
      await program.parseAsync(['node', 'agentforge', 'config', 'set', 'CUSTOM', 'val', '--env', '.env.production']);

      const content = await fs.readFile(path.join(tmpDir, '.env.production'), 'utf-8');
      expect(content).toContain('CUSTOM=val');
    });
  });

  describe('config get', () => {
    it('should return value from .env.local', async () => {
      await fs.writeFile(path.join(tmpDir, '.env.local'), 'MY_KEY=hello_world');

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await program.parseAsync(['node', 'agentforge', 'config', 'get', 'MY_KEY']);

      expect(logSpy).toHaveBeenCalledWith('hello_world');
      logSpy.mockRestore();
    });

    it('should search across multiple .env files', async () => {
      // Only write to .env (not .env.local)
      await fs.writeFile(path.join(tmpDir, '.env'), 'FALLBACK_KEY=found_it');

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await program.parseAsync(['node', 'agentforge', 'config', 'get', 'FALLBACK_KEY']);

      expect(logSpy).toHaveBeenCalledWith('found_it');
      logSpy.mockRestore();
    });

    it('should error when key not found in any env file', async () => {
      const { error } = await import('../lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'config', 'get', 'NONEXISTENT_KEY']);

      expect(error).toHaveBeenCalledWith(expect.stringContaining('not found'));
    });
  });

  describe('config provider', () => {
    it('should reject unknown provider', async () => {
      const { error } = await import('../lib/display.js');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      try {
        await program.parseAsync(['node', 'agentforge', 'config', 'provider', 'invalid-provider']);
      } catch {
        // expected
      }

      expect(error).toHaveBeenCalledWith(expect.stringContaining('Unknown provider'));
      exitSpy.mockRestore();
    });
  });
});

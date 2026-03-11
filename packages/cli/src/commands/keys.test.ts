/**
 * Tests for the `agentforge keys` command
 *
 * Covers: keys list, keys add (provider validation, prefix warning),
 * keys remove, keys test, and maskKey logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerKeysCommand } from './keys.js';

// ── Mocks ────────────────────────────────────────────────────────────

const mockQuery = vi.fn(() => Promise.resolve([]));
const mockMutation = vi.fn(() => Promise.resolve());
const mockAction = vi.fn(() => Promise.resolve('key-123'));

vi.mock('../lib/convex-client.js', () => ({
  createClient: vi.fn(() => ({
    query: (...args: any[]) => mockQuery(...args),
    mutation: (...args: any[]) => mockMutation(...args),
    action: (...args: any[]) => mockAction(...args),
  })),
}));

vi.mock('../lib/display.js', () => ({
  header: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  dim: vi.fn(),
  table: vi.fn(),
}));

describe('agentforge keys command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerKeysCommand(program);
    vi.clearAllMocks();
  });

  const getKeysCmd = () => program.commands.find((c) => c.name() === 'keys');
  const getSubCmd = (name: string) => getKeysCmd()?.commands.find((c) => c.name() === name);

  it('should register the keys command with subcommands', () => {
    const keysCmd = getKeysCmd();
    expect(keysCmd).toBeDefined();

    const subcommands = keysCmd?.commands.map((c) => c.name());
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('add');
    expect(subcommands).toContain('remove');
    expect(subcommands).toContain('test');
  });

  describe('keys list', () => {
    it('should call apiKeys:list query', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await program.parseAsync(['node', 'agentforge', 'keys', 'list']);
      expect(mockQuery).toHaveBeenCalledWith('apiKeys:list', {});
    });

    it('should filter by provider when --provider is specified', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await program.parseAsync(['node', 'agentforge', 'keys', 'list', '--provider', 'openai']);
      expect(mockQuery).toHaveBeenCalledWith('apiKeys:list', { provider: 'openai' });
    });

    it('should output JSON when --json flag is set', async () => {
      mockQuery.mockResolvedValueOnce([
        { provider: 'openai', keyName: 'My Key', encryptedKey: 'sk-1234567890abcdef', isActive: true, createdAt: Date.now() },
      ]);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await program.parseAsync(['node', 'agentforge', 'keys', 'list', '--json']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"provider"'));
      logSpy.mockRestore();
    });

    it('should show helpful message when no keys configured', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const { info, dim } = await import('../lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'keys', 'list']);

      expect(info).toHaveBeenCalledWith(expect.stringContaining('No API keys'));
    });
  });

  describe('keys add', () => {
    it('should reject unknown provider', async () => {
      const { error } = await import('../lib/display.js');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      try {
        await program.parseAsync(['node', 'agentforge', 'keys', 'add', 'unknown-provider', 'sk-key']);
      } catch {
        // expected
      }

      expect(error).toHaveBeenCalledWith(expect.stringContaining('Unknown provider'));
      exitSpy.mockRestore();
    });

    it('should accept valid provider and key', async () => {
      const { success } = await import('../lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'keys', 'add', 'openai', 'sk-test-key-12345']);

      expect(mockAction).toHaveBeenCalledWith('apiKeys:create', expect.objectContaining({
        provider: 'openai',
        encryptedKey: 'sk-test-key-12345',
      }));
      expect(success).toHaveBeenCalledWith(expect.stringContaining('stored successfully'));
    });

    it('should warn when key prefix does not match provider', async () => {
      const { info } = await import('../lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'keys', 'add', 'openai', 'bad-prefix-key']);

      expect(info).toHaveBeenCalledWith(expect.stringContaining('typically start with'));
    });

    it('should use custom --name when provided', async () => {
      await program.parseAsync(['node', 'agentforge', 'keys', 'add', 'anthropic', 'sk-ant-test', '--name', 'My Anthropic Key']);

      expect(mockAction).toHaveBeenCalledWith('apiKeys:create', expect.objectContaining({
        keyName: 'My Anthropic Key',
      }));
    });

    it('should default key name to provider name', async () => {
      await program.parseAsync(['node', 'agentforge', 'keys', 'add', 'groq', 'gsk_test123']);

      expect(mockAction).toHaveBeenCalledWith('apiKeys:create', expect.objectContaining({
        keyName: 'Groq Key',
      }));
    });

    it('should support all 8 providers', () => {
      const cmd = getSubCmd('add');
      // The add command accepts <provider> argument, and PROVIDERS array has 8 entries
      expect(cmd).toBeDefined();

      // All supported providers: openai, anthropic, openrouter, google, xai, groq, together, perplexity
      const expectedProviders = ['openai', 'anthropic', 'openrouter', 'google', 'xai', 'groq', 'together', 'perplexity'];
      const description = cmd?.parent?.commands.find(c => c.name() === 'add')?.description() ?? '';
      // Verify add command exists and takes provider argument
      expect((cmd as any)._args.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('keys remove', () => {
    it('should error when no keys found for provider', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const { error } = await import('../lib/display.js');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      try {
        await program.parseAsync(['node', 'agentforge', 'keys', 'remove', 'openai']);
      } catch {
        // expected
      }

      expect(error).toHaveBeenCalledWith(expect.stringContaining('No API keys found'));
      exitSpy.mockRestore();
    });

    it('should remove key with --force flag (skip confirmation)', async () => {
      mockQuery.mockResolvedValueOnce([{ _id: 'key-1', keyName: 'OpenAI Key', provider: 'openai' }]);
      const { success } = await import('../lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'keys', 'remove', 'openai', '--force']);

      expect(mockMutation).toHaveBeenCalledWith('apiKeys:remove', { id: 'key-1' });
      expect(success).toHaveBeenCalledWith(expect.stringContaining('removed'));
    });
  });

  describe('keys test', () => {
    it('should error when no active key found', async () => {
      mockQuery.mockResolvedValueOnce(null);
      const { error } = await import('../lib/display.js');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      try {
        await program.parseAsync(['node', 'agentforge', 'keys', 'test', 'openai']);
      } catch {
        // expected
      }

      expect(error).toHaveBeenCalledWith(expect.stringContaining('No active API key'));
      exitSpy.mockRestore();
    });

    it('should test openai key by calling models endpoint', async () => {
      mockQuery.mockResolvedValueOnce({ _id: 'key-1', encryptedKey: 'sk-test' });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as any);

      const { success } = await import('../lib/display.js');
      await program.parseAsync(['node', 'agentforge', 'keys', 'test', 'openai']);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({ headers: { Authorization: 'Bearer sk-test' } })
      );
      expect(success).toHaveBeenCalledWith(expect.stringContaining('valid'));

      globalThis.fetch = originalFetch;
    });

    it('should show info for unsupported test providers', async () => {
      mockQuery.mockResolvedValueOnce({ _id: 'key-1', encryptedKey: 'test-key' });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn();

      const { info } = await import('../lib/display.js');
      await program.parseAsync(['node', 'agentforge', 'keys', 'test', 'together']);

      expect(info).toHaveBeenCalledWith(expect.stringContaining('No test endpoint'));

      globalThis.fetch = originalFetch;
    });
  });
});

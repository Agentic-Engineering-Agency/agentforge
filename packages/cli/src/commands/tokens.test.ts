/**
 * Tests for the `agentforge tokens` command
 *
 * Covers: generate, create, list, revoke, delete subcommands.
 * Token generation uses apiAccessTokensActions:generate action (Node.js crypto.randomBytes).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerTokensCommand } from './tokens.js';

// ── Mocks ────────────────────────────────────────────────────────────

const mockQuery = vi.fn(() => Promise.resolve([]));
const mockMutation = vi.fn(() => Promise.resolve({ id: 'tok-1', token: 'agf_generated_token' }));
const mockAction = vi.fn(() => Promise.resolve({ plaintext: 'agf_generated_token', name: 'test' }));

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

describe('agentforge tokens command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerTokensCommand(program);
    vi.clearAllMocks();
    mockAction.mockClear();
  });

  const getTokensCmd = () => program.commands.find((c) => c.name() === 'tokens');

  it('should register the tokens command with subcommands', () => {
    const tokensCmd = getTokensCmd();
    expect(tokensCmd).toBeDefined();

    const subcommands = tokensCmd?.commands.map((c) => c.name());
    expect(subcommands).toContain('generate');
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('revoke');
    expect(subcommands).toContain('create');
    expect(subcommands).toContain('delete');
  });

  describe('tokens generate', () => {
    it('should require --name flag', async () => {
      const { error } = await import('../lib/display.js');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      try {
        await program.parseAsync(['node', 'agentforge', 'tokens', 'generate']);
      } catch {
        // expected
      }

      expect(error).toHaveBeenCalledWith('--name is required');
      exitSpy.mockRestore();
    });

    it('should generate token via action and show it once', async () => {
      mockAction.mockResolvedValueOnce({ plaintext: 'agf_abc123', name: 'my-app' });
      const { success, info } = await import('../lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'tokens', 'generate', '--name', 'my-app']);

      expect(mockAction).toHaveBeenCalledWith('apiAccessTokensActions:generate', { name: 'my-app' });
      expect(success).toHaveBeenCalledWith(expect.stringContaining('my-app'));
      expect(info).toHaveBeenCalledWith(expect.stringContaining('agf_abc123'));
    });
  });

  describe('tokens list', () => {
    it('should list tokens from Convex', async () => {
      mockQuery.mockResolvedValueOnce([
        { name: 'app-1', token: 'agf_12345678abcdefgh', isActive: true, createdAt: Date.now() },
      ]);
      const { header, table } = await import('../lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'tokens', 'list']);

      expect(mockQuery).toHaveBeenCalledWith('apiAccessTokens:list', {});
      expect(table).toHaveBeenCalled();
    });

    it('should output JSON when --json flag is set', async () => {
      mockQuery.mockResolvedValueOnce([{ name: 'test', isActive: true }]);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await program.parseAsync(['node', 'agentforge', 'tokens', 'list', '--json']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"name"'));
      logSpy.mockRestore();
    });

    it('should show empty state message when no tokens', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const { dim } = await import('../lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'tokens', 'list']);

      expect(dim).toHaveBeenCalledWith(expect.stringContaining('No tokens'));
    });
  });

  describe('tokens revoke', () => {
    it('should revoke token by id', async () => {
      mockMutation.mockResolvedValueOnce(undefined);
      const { success } = await import('../lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'tokens', 'revoke', 'tok-123']);

      expect(mockMutation).toHaveBeenCalledWith('apiAccessTokens:revoke', { id: 'tok-123' });
      expect(success).toHaveBeenCalledWith(expect.stringContaining('revoked'));
    });

    it('should handle revocation failure', async () => {
      mockMutation.mockRejectedValueOnce(new Error('Token not found'));
      const { error } = await import('../lib/display.js');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      try {
        await program.parseAsync(['node', 'agentforge', 'tokens', 'revoke', 'bad-id']);
      } catch {
        // expected
      }

      expect(error).toHaveBeenCalledWith(expect.stringContaining('Failed to revoke'));
      exitSpy.mockRestore();
    });
  });

  describe('tokens create', () => {
    it('should require --name flag', async () => {
      const { error } = await import('../lib/display.js');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      try {
        await program.parseAsync(['node', 'agentforge', 'tokens', 'create']);
      } catch {
        // expected
      }

      expect(error).toHaveBeenCalledWith('--name is required');
      exitSpy.mockRestore();
    });

    it('should create token with name via action', async () => {
      mockAction.mockResolvedValueOnce({ plaintext: 'agf_newtoken', name: 'production' });
      const { success } = await import('../lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'tokens', 'create', '--name', 'production']);

      expect(mockAction).toHaveBeenCalledWith('apiAccessTokensActions:generate', expect.objectContaining({
        name: 'production',
      }));
      expect(success).toHaveBeenCalledWith(expect.stringContaining('agf_newtoken'));
    });

    it('should reject invalid --expires date format', async () => {
      const { error } = await import('../lib/display.js');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      try {
        await program.parseAsync(['node', 'agentforge', 'tokens', 'create', '--name', 'test', '--expires', 'not-a-date']);
      } catch {
        // expected
      }

      expect(error).toHaveBeenCalledWith(expect.stringContaining('Invalid date'));
      exitSpy.mockRestore();
    });

    it('should accept valid YYYY-MM-DD expires date', async () => {
      mockAction.mockResolvedValueOnce({ plaintext: 'agf_expiring', name: 'temp' });

      await program.parseAsync(['node', 'agentforge', 'tokens', 'create', '--name', 'temp', '--expires', '2027-01-01']);

      expect(mockAction).toHaveBeenCalledWith('apiAccessTokensActions:generate', expect.objectContaining({
        name: 'temp',
        expiresAt: new Date('2027-01-01').getTime(),
      }));
    });

    it('should call action (not mutation) for token generation', async () => {
      mockAction.mockResolvedValueOnce({ plaintext: 'agf_server_generated', name: 'action-test' });

      await program.parseAsync(['node', 'agentforge', 'tokens', 'create', '--name', 'action-test']);

      expect(mockAction).toHaveBeenCalledWith('apiAccessTokensActions:generate', expect.objectContaining({
        name: 'action-test',
      }));
      // Mutation should NOT be called for token generation
      expect(mockMutation).not.toHaveBeenCalledWith('apiAccessTokens:generate', expect.anything());
    });
  });

  describe('tokens delete', () => {
    it('should error when token not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const { error } = await import('../lib/display.js');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });

      try {
        await program.parseAsync(['node', 'agentforge', 'tokens', 'delete', 'nonexistent', '-f']);
      } catch {
        // expected
      }

      expect(error).toHaveBeenCalledWith(expect.stringContaining('not found'));
      exitSpy.mockRestore();
    });

    it('should delete token with --force flag', async () => {
      mockQuery.mockResolvedValueOnce([
        { _id: 'tok-5', name: 'old-token', token: 'agf_old' },
      ]);
      mockMutation.mockResolvedValueOnce(undefined);
      const { success } = await import('../lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'tokens', 'delete', 'old-token', '-f']);

      expect(mockMutation).toHaveBeenCalledWith('apiAccessTokens:remove', { id: 'tok-5' });
      expect(success).toHaveBeenCalledWith(expect.stringContaining('deleted'));
    });
  });
});

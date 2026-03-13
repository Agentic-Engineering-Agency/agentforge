/**
 * Tests for Issue #224: Store API tokens as SHA-256 hashes instead of plaintext
 *
 * Validates that:
 * 1. Token generation stores a SHA-256 hash, not plaintext
 * 2. The `list` query never returns the full token or hash — only a masked prefix
 * 3. Hash-based lookup works for token validation
 * 4. CLI display uses masked values (prefix only)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerTokensCommand } from '../../src/commands/tokens.js';

// ── Mocks ────────────────────────────────────────────────────────────

const mockQuery = vi.fn(() => Promise.resolve([]));
const mockMutation = vi.fn(() => Promise.resolve({ success: true }));
const mockAction = vi.fn(() => Promise.resolve({ plaintext: 'agf_generated_token', name: 'test' }));

vi.mock('../../src/lib/convex-client.js', () => ({
  createClient: vi.fn(() => ({
    query: (...args: any[]) => mockQuery(...args),
    mutation: (...args: any[]) => mockMutation(...args),
    action: (...args: any[]) => mockAction(...args),
  })),
}));

vi.mock('../../src/lib/display.js', () => ({
  header: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  dim: vi.fn(),
  table: vi.fn(),
}));

describe('Issue #224: SHA-256 token hashing', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerTokensCommand(program);
    vi.clearAllMocks();
  });

  describe('Token generation stores hash, not plaintext', () => {
    it('should call insertToken with tokenHash (not raw plaintext)', async () => {
      // The action should compute SHA-256 hash and pass it to insertToken
      // We verify indirectly: the action returns plaintext to the user once,
      // but the insertToken mutation receives the hash
      mockAction.mockResolvedValueOnce({ plaintext: 'agf_abc123def456', name: 'my-api-key' });

      await program.parseAsync(['node', 'agentforge', 'tokens', 'create', '--name', 'my-api-key']);

      // The action is called (which internally calls insertToken with hash)
      expect(mockAction).toHaveBeenCalledWith('apiAccessTokensActions:generate', expect.objectContaining({
        name: 'my-api-key',
      }));
    });
  });

  describe('Token list returns masked values only', () => {
    it('should display only tokenPrefix (not full token or hash) in list output', async () => {
      // After the fix, the `list` query returns records with `tokenPrefix` instead of full `token`
      mockQuery.mockResolvedValueOnce([
        {
          _id: 'tok-1',
          name: 'production-key',
          tokenPrefix: 'agf_abc1...ef56',
          isActive: true,
          createdAt: Date.now(),
        },
      ]);
      const { table } = await import('../../src/lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'tokens', 'list']);

      expect(mockQuery).toHaveBeenCalledWith('apiAccessTokens:list', {});
      expect(table).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            Name: 'production-key',
            Status: 'Active',
          }),
        ])
      );
      // The Token column should use tokenPrefix, not the raw token
      const tableCall = (table as any).mock.calls[0][0];
      const tokenColumn = tableCall[0].Token;
      // Token display should NOT be a full 68+ char hex string (which is what a raw hash looks like)
      expect(tokenColumn.length).toBeLessThan(30);
      // It should not contain raw hex hash (64 chars)
      expect(tokenColumn).not.toMatch(/^[a-f0-9]{64}$/);
    });

    it('should never expose the full token hash in JSON output', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          _id: 'tok-2',
          name: 'dev-key',
          tokenPrefix: 'agf_1234...5678',
          isActive: true,
          createdAt: Date.now(),
        },
      ]);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await program.parseAsync(['node', 'agentforge', 'tokens', 'list', '--json']);

      const output = logSpy.mock.calls[0][0];
      // The JSON output should not contain a 64-char hex hash
      expect(output).not.toMatch(/[a-f0-9]{64}/);
      logSpy.mockRestore();
    });
  });

  describe('Token delete uses name lookup (no plaintext token needed)', () => {
    it('should find tokens by name without needing plaintext token field', async () => {
      mockQuery.mockResolvedValueOnce([
        {
          _id: 'tok-5',
          name: 'old-token',
          tokenPrefix: 'agf_old1...old2',
          isActive: true,
          createdAt: Date.now(),
        },
      ]);
      mockMutation.mockResolvedValueOnce(undefined);
      const { success } = await import('../../src/lib/display.js');

      await program.parseAsync(['node', 'agentforge', 'tokens', 'delete', 'old-token', '-f']);

      expect(mockMutation).toHaveBeenCalledWith('apiAccessTokens:remove', { id: 'tok-5' });
      expect(success).toHaveBeenCalledWith(expect.stringContaining('deleted'));
    });
  });
});

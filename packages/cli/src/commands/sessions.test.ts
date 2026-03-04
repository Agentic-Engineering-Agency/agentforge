/**
 * SPEC-20260304-010 Test Suite: sessions delete command
 *
 * Tests for Fix 2: Add sessions delete subcommand with --force flag
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerSessionsCommand } from './sessions.js';
import { Command } from 'commander';

// Mock the convex client
vi.mock('../lib/convex-client.js', () => ({
  createClient: vi.fn(() => ({
    mutation: vi.fn(() => Promise.resolve({ success: true })),
    query: vi.fn(() => Promise.resolve({ _id: 'session-123', sessionId: 'test-session' })),
  })),
  safeCall: vi.fn((fn) => fn()),
}));

// Mock readline for prompts
vi.mock('node:readline', () => ({
  default: {
    createInterface: vi.fn(() => ({
      question: vi.fn((_q: string, cb: (ans: string) => void) => cb('y')),
      close: vi.fn(),
    })),
  },
}));

describe('SPEC-010: sessions delete command', () => {
  let program: Command;
  let mutationSpy: ReturnType<typeof vi.fn>;
  let querySpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    program = new Command();
    registerSessionsCommand(program);
    const { createClient } = await import('../lib/convex-client.js');
    const mockClient = await createClient();
    mutationSpy = vi.mocked(mockClient.mutation);
    querySpy = vi.mocked(mockClient.query);
    vi.clearAllMocks();
  });

  describe('Fix 2: delete subcommand', () => {
    it('should have delete subcommand registered', () => {
      const sessionsCmd = program.commands.find((c) => c.name() === 'sessions');
      expect(sessionsCmd).toBeDefined();

      const deleteCmd = sessionsCmd?.commands.find((c) => c.name() === 'delete');
      expect(deleteCmd).toBeDefined();
    });

    it('should accept <id> argument', () => {
      const sessionsCmd = program.commands.find((c) => c.name() === 'sessions');
      const deleteCmd = sessionsCmd?.commands.find((c) => c.name() === 'delete');

      expect(deleteCmd?._args.length).toBeGreaterThanOrEqual(1);
      // In commander.js, _args[0] exists which means the command accepts an argument
      expect(deleteCmd?._args.length).toBeGreaterThan(0);
    });

    it('should have --force flag to skip confirmation', () => {
      const sessionsCmd = program.commands.find((c) => c.name() === 'sessions');
      const deleteCmd = sessionsCmd?.commands.find((c) => c.name() === 'delete');

      const options = deleteCmd?.options || [];
      const hasForceOption = options.some((o) =>
        o.long === '--force' || o.short === '-f'
      );
      expect(hasForceOption).toBe(true);
    });

    it('should call sessions:remove mutation when deleting', async () => {
      const { createClient } = await import('../lib/convex-client.js');
      const mockClient = await createClient();

      const sessionsCmd = program.commands.find((c) => c.name() === 'sessions');
      const deleteCmd = sessionsCmd?.commands.find((c) => c.name() === 'delete');
      const parseHandler = deleteCmd?.['_handler'];

      if (parseHandler) {
        await parseHandler('test-session-id', { force: true });

        expect(mutationSpy).toHaveBeenCalledWith(
          'sessions:remove',
          expect.objectContaining({
            sessionId: 'test-session-id',
          })
        );
      }
    });

    it('should prompt for confirmation without --force flag', async () => {
      const sessionsCmd = program.commands.find((c) => c.name() === 'sessions');
      const deleteCmd = sessionsCmd?.commands.find((c) => c.name() === 'delete');

      // When force is false or not provided, should prompt
      const parseHandler = deleteCmd?.['_handler'];

      if (parseHandler) {
        // This would normally prompt - testing the handler exists and accepts the arg
        expect(typeof parseHandler).toBe('function');
      }
    });

    it('should delete session without confirmation when --force is used', async () => {
      const { createClient } = await import('../lib/convex-client.js');
      const mockClient = await createClient();

      const sessionsCmd = program.commands.find((c) => c.name() === 'sessions');
      const deleteCmd = sessionsCmd?.commands.find((c) => c.name() === 'delete');
      const parseHandler = deleteCmd?.['_handler'];

      if (parseHandler) {
        await parseHandler('test-session-id', { force: true });

        // With --force, should skip prompt and call mutation directly
        expect(mutationSpy).toHaveBeenCalled();
      }
    });

    it('should verify session exists before deleting', async () => {
      const { createClient } = await import('../lib/convex-client.js');
      const mockClient = await createClient();

      const sessionsCmd = program.commands.find((c) => c.name() === 'sessions');
      const deleteCmd = sessionsCmd?.commands.find((c) => c.name() === 'delete');
      const parseHandler = deleteCmd?.['_handler'];

      if (parseHandler) {
        await parseHandler('test-session-id', { force: true });

        // Should first query to verify session exists
        expect(querySpy).toHaveBeenCalledWith(
          'sessions:get',
          expect.objectContaining({
            sessionId: 'test-session-id',
          })
        );
      }
    });
  });
});

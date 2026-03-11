/**
 * Tests for the `agentforge chat` command
 *
 * Covers: command registration, daemon health check, agent-not-found,
 * one-shot message mode, and MAX_MESSAGE_LENGTH validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerChatCommand } from './chat.js';

// ── Shared mock references ───────────────────────────────────────────

const mockQuery = vi.fn(() => Promise.resolve(null));
const mockMutation = vi.fn(() => Promise.resolve('thread-123'));

vi.mock('../lib/convex-client.js', () => ({
  createClient: vi.fn(() => ({
    query: (...args: any[]) => mockQuery(...args),
    mutation: (...args: any[]) => mockMutation(...args),
  })),
  safeCall: vi.fn((fn: () => any) => fn()),
}));

vi.mock('../lib/display.js', () => ({
  header: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  dim: vi.fn(),
  colors: {
    cyan: '',
    green: '',
    yellow: '',
    dim: '',
    reset: '',
  },
}));

describe('agentforge chat command', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerChatCommand(program);
    vi.clearAllMocks();
  });

  const getChatCmd = () => program.commands.find((c) => c.name() === 'chat');

  it('should register the chat command', () => {
    const cmd = getChatCmd();
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('chat');
  });

  it('should have --message option for non-interactive mode', () => {
    const cmd = getChatCmd();
    const opt = cmd?.options.find((o) => o.long === '--message');
    expect(opt).toBeDefined();
  });

  it('should have --port option defaulting to 3001', () => {
    const cmd = getChatCmd();
    const opt = cmd?.options.find((o) => o.long === '--port');
    expect(opt).toBeDefined();
    expect(opt?.defaultValue).toBe('3001');
  });

  it('should have --thread option', () => {
    const cmd = getChatCmd();
    const opt = cmd?.options.find((o) => o.long === '--thread');
    expect(opt).toBeDefined();
  });

  it('should have --no-stream option', () => {
    const cmd = getChatCmd();
    const opt = cmd?.options.find((o) => o.long === '--no-stream');
    expect(opt).toBeDefined();
  });

  it('should have deprecated --session option', () => {
    const cmd = getChatCmd();
    const opt = cmd?.options.find((o) => o.long === '--session');
    expect(opt).toBeDefined();
  });

  it('should accept optional agent-id argument', () => {
    const cmd = getChatCmd();
    const args = (cmd as any)._args;
    expect(args.length).toBeGreaterThanOrEqual(1);
    expect(args[0].required).toBe(false);
  });
});

describe('chat command behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect when daemon is not running', async () => {
    const program = new Command();
    registerChatCommand(program);

    const { error } = await import('../lib/display.js');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    try {
      await program.parseAsync(['node', 'agentforge', 'chat', 'agent-1', '-m', 'hello']);
    } catch {
      // expected
    }

    expect(error).toHaveBeenCalledWith(expect.stringContaining('not running'));
    exitSpy.mockRestore();
    globalThis.fetch = originalFetch;
  });

  it('should error when agent is not found', async () => {
    const program = new Command();
    registerChatCommand(program);

    const { error } = await import('../lib/display.js');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as any);
    mockQuery.mockResolvedValue(null);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    try {
      await program.parseAsync(['node', 'agentforge', 'chat', 'nonexistent', '-m', 'hello']);
    } catch {
      // expected
    }

    expect(error).toHaveBeenCalledWith(expect.stringContaining('not found'));
    exitSpy.mockRestore();
    globalThis.fetch = originalFetch;
  });

  it('should reject messages exceeding MAX_MESSAGE_LENGTH (10000)', async () => {
    const program = new Command();
    registerChatCommand(program);

    const { error } = await import('../lib/display.js');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as any);

    // Make agent query return a valid agent
    mockQuery.mockResolvedValue({ id: 'a1', name: 'TestAgent' });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    const longMessage = 'x'.repeat(10001);
    try {
      await program.parseAsync(['node', 'agentforge', 'chat', 'a1', '-m', longMessage]);
    } catch {
      // expected
    }

    expect(error).toHaveBeenCalledWith(expect.stringContaining('maximum length'));
    exitSpy.mockRestore();
    globalThis.fetch = originalFetch;
  });

  it('should stream response from daemon on valid message', async () => {
    const program = new Command();
    registerChatCommand(program);

    const originalFetch = globalThis.fetch;

    // Make agent query return a valid agent
    mockQuery.mockResolvedValue({ id: 'a1', name: 'TestAgent' });

    // Mock health check to succeed, then mock chat endpoint
    let fetchCallCount = 0;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      fetchCallCount++;
      if (String(url).includes('/health')) {
        return Promise.resolve({ ok: true });
      }
      // Chat endpoint — return a streaming response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return Promise.resolve({
        ok: true,
        body: stream,
      });
    }) as any;

    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    try {
      await program.parseAsync(['node', 'agentforge', 'chat', 'a1', '-m', 'hi']);
    } catch {
      // process.exit(0) after successful response
    }

    // Verify the streamed content was written to stdout
    expect(writeSpy).toHaveBeenCalledWith('Hello');

    writeSpy.mockRestore();
    exitSpy.mockRestore();
    globalThis.fetch = originalFetch;
  });
});

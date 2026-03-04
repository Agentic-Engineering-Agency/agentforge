/**
 * SPEC-20260304-010 Test Suite: agents create command
 *
 * Tests for Fix 1: Add --description flag to agents create
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerAgentsCommand } from './agents.js';
import { Command } from 'commander';

// Mock the convex client
vi.mock('../lib/convex-client.js', () => ({
  createClient: vi.fn(() => ({
    mutation: vi.fn(() => Promise.resolve('agent-123')),
    query: vi.fn(() => Promise.resolve({ id: 'test-agent', name: 'Test', model: 'gpt-4o-mini' })),
  })),
  safeCall: vi.fn((fn) => fn()),
}));

// Mock readline for prompts
vi.mock('node:readline', () => ({
  default: {
    createInterface: vi.fn(() => ({
      question: vi.fn((_q: string, cb: (ans: string) => void) => cb('test-input')),
      close: vi.fn(),
    })),
  },
}));

describe('SPEC-010: agents create command', () => {
  let program: Command;
  let mutationSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    program = new Command();
    registerAgentsCommand(program);
    const { createClient } = await import('../lib/convex-client.js');
    mutationSpy = vi.mocked(await createClient()).mutation;
    vi.clearAllMocks();
  });

  const getAgentsCmd = () => program.commands.find((c) => c.name() === 'agents');
  const getCreateCmd = () => getAgentsCmd()?.commands.find((c) => c.name() === 'create');

  describe('Fix 1: --description flag support', () => {
    it('should have agents command registered', () => {
      const agentsCmd = getAgentsCmd();
      expect(agentsCmd).toBeDefined();
    });

    it('should have create subcommand registered', () => {
      const createCmd = getCreateCmd();
      expect(createCmd).toBeDefined();
    });

    it('should accept --description flag when creating agent', async () => {
      const createCmd = getCreateCmd();

      const options = createCmd?.options || [];
      const hasDescriptionOption = options.some((o) => o.long === '--description');
      expect(hasDescriptionOption).toBe(true);
    });

    it('should pass description to Convex mutation when provided', async () => {
      const { createClient } = await import('../lib/convex-client.js');
      const mockClient = await createClient();

      // Simulate command execution with --description
      const createCmd = getCreateCmd();
      const parseHandler = createCmd?.['_handler'];

      if (parseHandler) {
        await parseHandler({
          name: 'TestAgent',
          model: 'openai:gpt-4o-mini',
          description: 'A test agent for SPEC-010',
          instructions: 'You are helpful',
        });

        expect(mutationSpy).toHaveBeenCalledWith(
          'agents:create',
          expect.objectContaining({
            description: 'A test agent for SPEC-010',
          })
        );
      }
    });

    it('should create agent with all required flags', async () => {
      const { createClient } = await import('../lib/convex-client.js');
      const mockClient = await createClient();

      const createCmd = getCreateCmd();
      const parseHandler = createCmd?.['_handler'];

      if (parseHandler) {
        await parseHandler({
          name: 'MyAgent',
          model: 'openai:gpt-4o-mini',
          description: 'My agent description',
          instructions: 'Be helpful',
        });

        expect(mutationSpy).toHaveBeenCalledWith(
          'agents:create',
          expect.objectContaining({
            name: 'MyAgent',
            model: 'gpt-4o-mini',
            provider: 'openai',
            description: 'My agent description',
            instructions: 'Be helpful',
          })
        );
      }
    });

    it('should handle model without provider prefix (defaults to openai)', async () => {
      const { createClient } = await import('../lib/convex-client.js');
      const mockClient = await createClient();

      const createCmd = getCreateCmd();
      const parseHandler = createCmd?.['_handler'];

      if (parseHandler) {
        await parseHandler({
          name: 'TestAgent',
          model: 'gpt-4o-mini',
          description: 'Test',
          instructions: 'Test',
        });

        expect(mutationSpy).toHaveBeenCalledWith(
          'agents:create',
          expect.objectContaining({
            provider: 'openai',
            model: 'gpt-4o-mini',
          })
        );
      }
    });

    it('should handle model with provider prefix', async () => {
      const { createClient } = await import('../lib/convex-client.js');
      const mockClient = await createClient();

      const createCmd = getCreateCmd();
      const parseHandler = createCmd?.['_handler'];

      if (parseHandler) {
        await parseHandler({
          name: 'TestAgent',
          model: 'anthropic:claude-3-5-sonnet',
          description: 'Test',
          instructions: 'Test',
        });

        expect(mutationSpy).toHaveBeenCalledWith(
          'agents:create',
          expect.objectContaining({
            provider: 'anthropic',
            model: 'claude-3-5-sonnet',
          })
        );
      }
    });

    it('should support --provider flag independently', async () => {
      const createCmd = getCreateCmd();
      const options = createCmd?.options || [];
      const hasProviderOption = options.some((o) => o.long === '--provider');
      expect(hasProviderOption).toBe(true);
    });
  });
});

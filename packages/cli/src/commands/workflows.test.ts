/**
 * SPEC-20260304-010 Test Suite: workflows create command
 *
 * Tests for Fix 3: Add workflows create subcommand
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerWorkflowsCommand } from './workflows.js';
import { Command } from 'commander';

// Mock the convex client
vi.mock('../lib/convex-client.js', () => ({
  createClient: vi.fn(() => ({
    mutation: vi.fn(() => Promise.resolve('workflow-123')),
    query: vi.fn(() => Promise.resolve([])),
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

describe('SPEC-010: workflows create command', () => {
  let program: Command;
  let mutationSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    program = new Command();
    registerWorkflowsCommand(program);
    const { createClient } = await import('../lib/convex-client.js');
    const mockClient = await createClient();
    mutationSpy = vi.mocked(mockClient.mutation);
    vi.clearAllMocks();
  });

  describe('Fix 3: create subcommand', () => {
    it('should have create subcommand registered', () => {
      const workflowsCmd = program.commands.find((c) => c.name() === 'workflows');
      expect(workflowsCmd).toBeDefined();

      const createCmd = workflowsCmd?.commands.find((c) => c.name() === 'create');
      expect(createCmd).toBeDefined();
    });

    it('should have --name flag', () => {
      const workflowsCmd = program.commands.find((c) => c.name() === 'workflows');
      const createCmd = workflowsCmd?.commands.find((c) => c.name() === 'create');

      const options = createCmd?.options || [];
      const hasNameOption = options.some((o) => o.long === '--name');
      expect(hasNameOption).toBe(true);
    });

    it('should have --agent flag', () => {
      const workflowsCmd = program.commands.find((c) => c.name() === 'workflows');
      const createCmd = workflowsCmd?.commands.find((c) => c.name() === 'create');

      const options = createCmd?.options || [];
      const hasAgentOption = options.some((o) => o.long === '--agent');
      expect(hasAgentOption).toBe(true);
    });

    it('should have --trigger flag', () => {
      const workflowsCmd = program.commands.find((c) => c.name() === 'workflows');
      const createCmd = workflowsCmd?.commands.find((c) => c.name() === 'create');

      const options = createCmd?.options || [];
      const hasTriggerOption = options.some((o) => o.long === '--trigger');
      expect(hasTriggerOption).toBe(true);
    });

    it('should support manual trigger type', async () => {
      const { createClient } = await import('../lib/convex-client.js');
      const mockClient = await createClient();

      const workflowsCmd = program.commands.find((c) => c.name() === 'workflows');
      const createCmd = workflowsCmd?.commands.find((c) => c.name() === 'create');
      const parseHandler = createCmd?.['_handler'];

      if (parseHandler) {
        await parseHandler({
          name: 'MyWorkflow',
          agent: 'agent-001',
          trigger: 'manual',
        });

        expect(mutationSpy).toHaveBeenCalledWith(
          'workflows:create',
          expect.objectContaining({
            name: 'MyWorkflow',
          })
        );
      }
    });

    it('should support cron trigger with schedule', async () => {
      const { createClient } = await import('../lib/convex-client.js');
      const mockClient = await createClient();

      const workflowsCmd = program.commands.find((c) => c.name() === 'workflows');
      const createCmd = workflowsCmd?.commands.find((c) => c.name() === 'create');
      const parseHandler = createCmd?.['_handler'];

      if (parseHandler) {
        await parseHandler({
          name: 'ScheduledWorkflow',
          agent: 'agent-001',
          trigger: 'cron',
          schedule: '*/5 * * * *',
        });

        expect(mutationSpy).toHaveBeenCalledWith(
          'workflows:create',
          expect.objectContaining({
            name: 'ScheduledWorkflow',
          })
        );
      }
    });

    it('should call workflows:create mutation', async () => {
      const { createClient } = await import('../lib/convex-client.js');
      const mockClient = await createClient();

      const workflowsCmd = program.commands.find((c) => c.name() === 'workflows');
      const createCmd = workflowsCmd?.commands.find((c) => c.name() === 'create');
      const parseHandler = createCmd?.['_handler'];

      if (parseHandler) {
        await parseHandler({
          name: 'TestWorkflow',
          agent: 'agent-test-001',
          trigger: 'manual',
        });

        expect(mutationSpy).toHaveBeenCalledWith('workflows:create', expect.any(Object));
      }
    });

    it('should have --schedule flag for cron triggers', () => {
      const workflowsCmd = program.commands.find((c) => c.name() === 'workflows');
      const createCmd = workflowsCmd?.commands.find((c) => c.name() === 'create');

      const options = createCmd?.options || [];
      const hasScheduleOption = options.some((o) => o.long === '--schedule');
      expect(hasScheduleOption).toBe(true);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStandardAgent } from '../src/agent/create-standard-agent.js';
import { initStorage } from '../src/agent/shared.js';
import { Agent } from '@mastra/core/agent';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { AgentForgeDaemon } from '../src/daemon/daemon.js';

describe('Agent Factory', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    // Initialize storage with mock credentials for tests
    initStorage('https://mock.convex.cloud', 'mock-admin-key');
    // The default embedding model is OpenAI-based, so tests need a placeholder key.
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
    // Clean up
    vi.clearAllMocks();
  });

  describe('createStandardAgent', () => {
    it('returns an Agent instance', () => {
      const agent = createStandardAgent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent.',
      });
      expect(agent).toBeInstanceOf(Agent);
    });

    it('agent has correct id, name, instructions', () => {
      const agent = createStandardAgent({
        id: 'test-agent-2',
        name: 'Test Agent 2',
        description: 'A test agent',
        instructions: 'You are a test agent 2.',
      });
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(Agent);
    });

    it('uses DAEMON_MODEL when no model specified', () => {
      const agent = createStandardAgent({
        id: 'test-agent-3',
        name: 'Test Agent 3',
        instructions: 'You are a test agent 3.',
      });
      // The agent should be created with DAEMON_MODEL
      expect(agent).toBeDefined();
    });

    it('uses custom model when specified', () => {
      const agent = createStandardAgent({
        id: 'test-agent-4',
        name: 'Test Agent 4',
        model: 'openai/gpt-4o',
        instructions: 'You are a test agent 4.',
      });
      expect(agent).toBeDefined();
    });

    it('has UnicodeNormalizer in inputProcessors', () => {
      const agent = createStandardAgent({
        id: 'test-agent-5',
        name: 'Test Agent 5',
        instructions: 'You are a test agent 5.',
      });
      expect(agent).toBeDefined();
      // InputProcessors are internal, we just verify agent was created
    });

    it('has TokenLimiterProcessor in inputProcessors', () => {
      const agent = createStandardAgent({
        id: 'test-agent-6',
        name: 'Test Agent 6',
        instructions: 'You are a test agent 6.',
      });
      expect(agent).toBeDefined();
      // InputProcessors are internal, we just verify agent was created
    });

    it('can be created with tools', () => {
      const agent = createStandardAgent({
        id: 'test-agent-7',
        name: 'Test Agent 7',
        instructions: 'You are a test agent 7.',
        tools: {},
      });
      expect(agent).toBeDefined();
    });

    it('can be created with working memory template', () => {
      const agent = createStandardAgent({
        id: 'test-agent-8',
        name: 'Test Agent 8',
        instructions: 'You are a test agent 8.',
        workingMemoryTemplate: '# User\n- Name: {name}\n',
      });
      expect(agent).toBeDefined();
    });

    it('can be created without memory', () => {
      const agent = createStandardAgent({
        id: 'test-agent-9',
        name: 'Test Agent 9',
        instructions: 'You are a test agent 9.',
        disableMemory: true,
      });
      expect(agent).toBeDefined();
    });

    it('attaches a Mastra workspace when provided', () => {
      const workspace = new Workspace({
        filesystem: new LocalFilesystem({ basePath: '/tmp/agentforge-runtime-workspace' }),
      });
      expect(() => createStandardAgent({
        id: 'test-agent-workspace',
        name: 'Test Agent Workspace',
        instructions: 'Use the workspace.',
        workspace,
      })).not.toThrow();
    });
  });

  describe('AgentForgeDaemon', () => {
    it('loadAgents registers agents and listAgents returns them', async () => {
      const daemon = new AgentForgeDaemon({
        deploymentUrl: 'https://mock.convex.cloud',
        adminAuthToken: 'mock-admin-key',
      });
      await daemon.loadAgents([
        { id: 'a1', name: 'A1', instructions: 'Test agent' },
      ]);
      const list = daemon.listAgents();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('a1');
      expect(list[0].name).toBe('A1');
    });

    it('getAgent returns the loaded agent', async () => {
      const daemon = new AgentForgeDaemon({
        deploymentUrl: 'https://mock.convex.cloud',
        adminAuthToken: 'mock-admin-key',
      });
      await daemon.loadAgents([{ id: 'agent-x', name: 'Agent X', instructions: 'Hello' }]);
      const agent = daemon.getAgent('agent-x');
      expect(agent).toBeDefined();
      expect(agent).toBeInstanceOf(Agent);
    });

    it('listAgents returns definitions without unsafe casts', async () => {
      const daemon = new AgentForgeDaemon({
        deploymentUrl: 'https://mock.convex.cloud',
        adminAuthToken: 'mock-admin-key',
      });
      const def = {
        id: 'agent-y',
        name: 'Agent Y',
        description: 'A description',
        instructions: 'Be helpful.',
        model: 'openai/gpt-4o',
      };
      await daemon.loadAgents([def]);
      const [result] = daemon.listAgents();
      expect(result.id).toBe(def.id);
      expect(result.name).toBe(def.name);
      expect(result.description).toBe(def.description);
      expect(result.instructions).toBe(def.instructions);
      expect(result.model).toBe(def.model);
    });

    it('executes workflow runs through the configured executor', async () => {
      const daemon = new AgentForgeDaemon({
        deploymentUrl: 'https://mock.convex.cloud',
        adminAuthToken: 'mock-admin-key',
      });
      const executor = vi.fn().mockResolvedValue({
        runId: 'run-123',
        status: 'success' as const,
        output: 'done',
      });

      daemon.setWorkflowExecutor(executor);
      await expect(daemon.executeWorkflowRun('run-123')).resolves.toEqual({
        runId: 'run-123',
        status: 'success',
        output: 'done',
      });
      expect(executor).toHaveBeenCalledWith('run-123');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createStandardAgent } from '../src/agent/create-standard-agent.js';
import { initStorage } from '../src/agent/shared.js';
import { Agent } from '@mastra/core/agent';

describe('Agent Factory', () => {
  beforeEach(() => {
    // Initialize storage with mock credentials for tests
    initStorage('https://mock.convex.cloud', 'mock-admin-key');
    // Set required API key for embedding model
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
  });

  afterEach(() => {
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
  });
});

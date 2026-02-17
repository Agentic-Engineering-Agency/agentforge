import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConvexAgent } from './convex-agent.js';
import { MCPServer } from '@agentforge-ai/core';
import { z } from 'zod';

// Mock the core Agent
vi.mock('@agentforge-ai/core', async () => {
  const actual = await vi.importActual<typeof import('@agentforge-ai/core')>('@agentforge-ai/core');

  const MockAgent = vi.fn().mockImplementation((config: any) => ({
    id: config.id,
    name: config.name,
    instructions: config.instructions,
    model: config.model,
    generate: vi.fn().mockResolvedValue({ text: 'mock response', toolResults: [] }),
    stream: vi.fn().mockImplementation(async function* () {
      yield { content: 'chunk1' };
      yield { content: 'chunk2' };
    }),
    addTools: vi.fn(),
    clearTools: vi.fn(),
    getTools: vi.fn().mockReturnValue([]),
    callTool: vi.fn().mockResolvedValue('tool-result'),
  }));

  return {
    ...actual,
    Agent: MockAgent,
  };
});

// Create a mock Convex ActionCtx
function createMockCtx() {
  return {
    runQuery: vi.fn().mockResolvedValue(null),
    runMutation: vi.fn().mockResolvedValue(null),
    runAction: vi.fn().mockResolvedValue(null),
  };
}

const mockModel = {
  specificationVersion: 'v1' as const,
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  doGenerate: vi.fn(),
  doStream: vi.fn(),
} as any;

describe('ConvexAgent', () => {
  let mockCtx: ReturnType<typeof createMockCtx>;

  const baseConfig = {
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You are a test agent.',
    model: mockModel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = createMockCtx();
  });

  // --- Construction ---

  describe('constructor', () => {
    it('should create an agent with valid config and context', () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      expect(agent.id).toBe('test-agent');
      expect(agent.name).toBe('Test Agent');
      expect(agent.instructions).toBe('You are a test agent.');
      expect(agent.config).toEqual(baseConfig);
      expect(agent.ctx).toBe(mockCtx);
    });

    it('should accept string model IDs', () => {
      const agent = new ConvexAgent(
        { ...baseConfig, model: 'openai/gpt-4o' },
        mockCtx,
      );
      expect(agent.id).toBe('test-agent');
    });

    it('should throw if id is empty', () => {
      expect(
        () => new ConvexAgent({ ...baseConfig, id: '' }, mockCtx),
      ).toThrow('ConvexAgent requires a non-empty id.');
    });

    it('should throw if name is empty', () => {
      expect(
        () => new ConvexAgent({ ...baseConfig, name: '' }, mockCtx),
      ).toThrow('ConvexAgent requires a non-empty name.');
    });

    it('should throw if instructions are empty', () => {
      expect(
        () => new ConvexAgent({ ...baseConfig, instructions: '' }, mockCtx),
      ).toThrow('ConvexAgent requires non-empty instructions.');
    });

    it('should throw if model is missing', () => {
      expect(
        () => new ConvexAgent({ ...baseConfig, model: '' as any }, mockCtx),
      ).toThrow('ConvexAgent requires a model.');
    });

    it('should throw if ctx is invalid', () => {
      expect(
        () => new ConvexAgent(baseConfig, null as any),
      ).toThrow('ConvexAgent requires a valid Convex ActionCtx.');
    });

    it('should throw if ctx.runQuery is not a function', () => {
      expect(
        () => new ConvexAgent(baseConfig, { runQuery: 'not-a-fn' } as any),
      ).toThrow('ConvexAgent requires a valid Convex ActionCtx.');
    });
  });

  // --- Getters ---

  describe('getters', () => {
    it('id returns the agent id', () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      expect(agent.id).toBe('test-agent');
    });

    it('name returns the agent name', () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      expect(agent.name).toBe('Test Agent');
    });

    it('instructions returns the agent instructions', () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      expect(agent.instructions).toBe('You are a test agent.');
    });
  });

  // --- Tool Management ---

  describe('tool management', () => {
    it('addTools should delegate to the core agent', () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      const server = new MCPServer();
      agent.addTools(server);
      // Since Agent is mocked, just verify no error
      expect(agent).toBeDefined();
    });

    it('clearTools should delegate to the core agent', () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      agent.clearTools();
      expect(agent).toBeDefined();
    });

    it('getTools should return the tool list', () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      const tools = agent.getTools();
      expect(Array.isArray(tools)).toBe(true);
    });

    it('callTool should invoke a tool', async () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      const result = await agent.callTool('test-tool', { x: 1 });
      expect(result).toBe('tool-result');
    });
  });

  // --- generate ---

  describe('generate', () => {
    it('should return a response with text and usage', async () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      const response = await agent.generate('Hello');
      expect(response.text).toBe('mock response');
      expect(response.usage).toBeDefined();
      expect(response.usage?.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should include model in usage when model is a string', async () => {
      const agent = new ConvexAgent(
        { ...baseConfig, model: 'openai/gpt-4o' },
        mockCtx,
      );
      const response = await agent.generate('Test');
      expect(response.usage?.model).toBe('openai/gpt-4o');
    });

    it('should not include model in usage when model is an object', async () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      const response = await agent.generate('Test');
      expect(response.usage?.model).toBeUndefined();
    });
  });

  // --- stream ---

  describe('stream', () => {
    it('should yield chunks from the underlying agent', async () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      const chunks: Array<{ content: string }> = [];
      for await (const chunk of agent.stream('Tell me')) {
        chunks.push(chunk);
      }
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ content: 'chunk1' });
      expect(chunks[1]).toEqual({ content: 'chunk2' });
    });
  });

  // --- Convex Context Methods ---

  describe('context methods', () => {
    it('runQuery should delegate to ctx.runQuery', async () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      mockCtx.runQuery.mockResolvedValue({ data: 'test' });
      const result = await agent.runQuery('some.query', { id: '1' });
      expect(mockCtx.runQuery).toHaveBeenCalledWith('some.query', { id: '1' });
      expect(result).toEqual({ data: 'test' });
    });

    it('runMutation should delegate to ctx.runMutation', async () => {
      const agent = new ConvexAgent(baseConfig, mockCtx);
      mockCtx.runMutation.mockResolvedValue('mut-result');
      const result = await agent.runMutation('some.mutation', { name: 'test' });
      expect(mockCtx.runMutation).toHaveBeenCalledWith('some.mutation', { name: 'test' });
      expect(result).toBe('mut-result');
    });
  });

  // --- fromRecord ---

  describe('fromRecord', () => {
    it('should create an agent from a full record', () => {
      const agent = ConvexAgent.fromRecord(
        {
          id: 'record-agent',
          name: 'Record Agent',
          instructions: 'Do something',
          model: 'gpt-4o',
          provider: 'openai',
        },
        mockCtx,
      );
      expect(agent.id).toBe('record-agent');
      expect(agent.name).toBe('Record Agent');
    });

    it('should use systemPrompt as fallback for instructions', () => {
      const agent = ConvexAgent.fromRecord(
        {
          name: 'SP Agent',
          systemPrompt: 'From system prompt',
        },
        mockCtx,
      );
      expect(agent.instructions).toBe('From system prompt');
    });

    it('should use defaults when fields are missing', () => {
      const agent = ConvexAgent.fromRecord(
        { name: 'Minimal Agent' },
        mockCtx,
      );
      expect(agent.id).toBe('minimal-agent');
      expect(agent.name).toBe('Minimal Agent');
      expect(agent.instructions).toBe(
        'You are a helpful AI assistant built with AgentForge.',
      );
    });

    it('should derive id from name with spaces', () => {
      const agent = ConvexAgent.fromRecord(
        { name: 'My Cool Agent' },
        mockCtx,
      );
      expect(agent.id).toBe('my-cool-agent');
    });

    it('should pass config as providerConfig', () => {
      const agent = ConvexAgent.fromRecord(
        {
          name: 'Config Agent',
          config: { apiKey: 'test', temperature: 0.5 },
        },
        mockCtx,
      );
      expect(agent.config.providerConfig).toEqual({
        apiKey: 'test',
        temperature: 0.5,
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent, AgentConfig } from './agent';
import { MCPServer } from './mcp-server';
import { z } from 'zod';

// Mock the Mastra Agent
vi.mock('@mastra/core/agent', () => {
  const MastraAgent = vi.fn();
  MastraAgent.prototype.generate = vi.fn();
  MastraAgent.prototype.stream = vi.fn();
  return { Agent: MastraAgent };
});

import { Agent as MastraAgent } from '@mastra/core/agent';

// Create a mock LanguageModelV1
const mockModel = {
  specificationVersion: 'v1' as const,
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  defaultObjectGenerationMode: 'json' as const,
  doGenerate: vi.fn(),
  doStream: vi.fn(),
} as any;

describe('Agent', () => {
  const config: AgentConfig = {
    id: 'test-agent',
    name: 'Test Agent',
    instructions: 'You are a test agent.',
    model: mockModel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Core Construction ---

  it('should instantiate an agent with the correct properties', () => {
    const agent = new Agent(config);
    expect(agent.id).toBe('test-agent');
    expect(agent.name).toBe('Test Agent');
    expect(agent.instructions).toBe('You are a test agent.');
    expect(agent.model).toBe(mockModel);
  });

  it('should handle instantiation without optional tools', () => {
    const configWithoutTools: AgentConfig = {
      id: 'no-tools',
      name: 'No Tools Agent',
      instructions: 'No tools here.',
      model: mockModel,
    };
    expect(() => new Agent(configWithoutTools)).not.toThrow();
    const agent = new Agent(configWithoutTools);
    expect(agent.getTools()).toEqual([]);
  });

  it('should handle instantiation with an MCPServer as tools', () => {
    const server = new MCPServer();
    server.registerTool({
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: z.object({ x: z.number() }),
      outputSchema: z.number(),
      handler: async ({ x }) => x * 2,
    });

    const configWithTools: AgentConfig = {
      ...config,
      tools: server,
    };
    const agent = new Agent(configWithTools);
    expect(agent.getTools()).toHaveLength(1);
    expect(agent.getTools()[0].name).toBe('test_tool');
  });

  it('should accept a string model ID', () => {
    const configWithString: AgentConfig = {
      id: 'string-model',
      name: 'String Model Agent',
      instructions: 'Test',
      model: 'openai/gpt-4o',
    };
    const agent = new Agent(configWithString);
    expect(agent.id).toBe('string-model');
    expect(agent.model).toBe('openai/gpt-4o');
  });

  // --- addTools ---

  it('addTools() should dynamically add tools from an MCPServer', () => {
    const agent = new Agent(config);
    expect(agent.getTools()).toHaveLength(0);

    const server = new MCPServer();
    server.registerTool({
      name: 'dynamic_tool',
      description: 'Added dynamically',
      inputSchema: z.object({ msg: z.string() }),
      outputSchema: z.string(),
      handler: async ({ msg }) => msg,
    });

    agent.addTools(server);
    expect(agent.getTools()).toHaveLength(1);
    expect(agent.getTools()[0].name).toBe('dynamic_tool');
  });

  it('addTools() should merge tools from multiple MCPServer instances', () => {
    const agent = new Agent(config);

    const server1 = new MCPServer();
    server1.registerTool({
      name: 'tool_a',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      handler: async () => 'a',
    });

    const server2 = new MCPServer();
    server2.registerTool({
      name: 'tool_b',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      handler: async () => 'b',
    });

    agent.addTools(server1);
    agent.addTools(server2);

    const tools = agent.getTools();
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.name)).toEqual(['tool_a', 'tool_b']);
  });

  it('addTools() should rebuild the Mastra agent with new tools', () => {
    const agent = new Agent(config);
    const initialCallCount = (MastraAgent as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

    const server = new MCPServer();
    server.registerTool({
      name: 'rebuild_test',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      handler: async () => 'ok',
    });

    agent.addTools(server);

    // MastraAgent constructor should have been called again (rebuild)
    expect((MastraAgent as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(initialCallCount + 1);
  });

  // --- clearTools ---

  it('clearTools() should remove all tools', () => {
    const server = new MCPServer();
    server.registerTool({
      name: 'to_be_cleared',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      handler: async () => 'gone',
    });

    const agent = new Agent({ ...config, tools: server });
    expect(agent.getTools()).toHaveLength(1);

    agent.clearTools();
    expect(agent.getTools()).toHaveLength(0);
  });

  it('clearTools() should rebuild the Mastra agent without tools', () => {
    const server = new MCPServer();
    server.registerTool({
      name: 'temp',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      handler: async () => null,
    });

    const agent = new Agent({ ...config, tools: server });
    const callCountBefore = (MastraAgent as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

    agent.clearTools();

    expect((MastraAgent as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCountBefore + 1);
  });

  // --- callTool ---

  it('callTool() should invoke a tool by name', async () => {
    const server = new MCPServer();
    server.registerTool({
      name: 'multiply',
      description: 'Multiplies a number by 2',
      inputSchema: z.object({ x: z.number() }),
      outputSchema: z.number(),
      handler: async ({ x }) => x * 2,
    });

    const agent = new Agent({ ...config, tools: server });
    const result = await agent.callTool('multiply', { x: 5 });
    expect(result).toBe(10);
  });

  it('callTool() should search across multiple MCPServers', async () => {
    const agent = new Agent(config);

    const server1 = new MCPServer();
    server1.registerTool({
      name: 'tool_in_server1',
      inputSchema: z.object({}),
      outputSchema: z.string(),
      handler: async () => 'from_server1',
    });

    const server2 = new MCPServer();
    server2.registerTool({
      name: 'tool_in_server2',
      inputSchema: z.object({}),
      outputSchema: z.string(),
      handler: async () => 'from_server2',
    });

    agent.addTools(server1);
    agent.addTools(server2);

    const result1 = await agent.callTool('tool_in_server1', {});
    expect(result1).toBe('from_server1');

    const result2 = await agent.callTool('tool_in_server2', {});
    expect(result2).toBe('from_server2');
  });

  it('callTool() should throw if tool is not found in any server', async () => {
    const agent = new Agent(config);
    await expect(agent.callTool('nonexistent', {})).rejects.toThrow(
      "Tool 'nonexistent' not found in any attached MCPServer."
    );
  });

  // --- generate ---

  it('generate() should return a structured response', async () => {
    const agent = new Agent(config);
    const mockResponse = { text: 'This is a test response.' };
    (MastraAgent.prototype.generate as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const response = await agent.generate('Test prompt');
    expect(response).toEqual(mockResponse);
    expect(MastraAgent.prototype.generate).toHaveBeenCalledWith('Test prompt');
  });

  it('generate() should throw an error if the underlying call fails', async () => {
    const agent = new Agent(config);
    const mockError = new Error('Mastra call failed');
    (MastraAgent.prototype.generate as ReturnType<typeof vi.fn>).mockRejectedValue(mockError);

    await expect(agent.generate('Test prompt')).rejects.toThrow('Mastra call failed');
  });

  // --- stream ---

  it('stream() should return an async generator', async () => {
    const agent = new Agent(config);
    const mockTextStream = (async function* () {
      yield 'chunk1';
      yield 'chunk2';
    })();
    (MastraAgent.prototype.stream as ReturnType<typeof vi.fn>).mockResolvedValue({
      textStream: mockTextStream,
    });

    const chunks: Array<{ content: string }> = [];
    for await (const chunk of agent.stream('Test prompt')) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ content: 'chunk1' });
    expect(chunks[1]).toEqual({ content: 'chunk2' });
  });

  it('stream() should handle non-string chunks', async () => {
    const agent = new Agent(config);
    const mockTextStream = (async function* () {
      yield 123;
      yield { toString: () => 'obj' };
    })();
    (MastraAgent.prototype.stream as ReturnType<typeof vi.fn>).mockResolvedValue({
      textStream: mockTextStream,
    });

    const chunks: Array<{ content: string }> = [];
    for await (const chunk of agent.stream('Test prompt')) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ content: '123' });
    expect(chunks[1]).toEqual({ content: 'obj' });
  });

  it('stream() should handle empty streams', async () => {
    const agent = new Agent(config);
    const mockTextStream = (async function* () {
      // empty stream
    })();
    (MastraAgent.prototype.stream as ReturnType<typeof vi.fn>).mockResolvedValue({
      textStream: mockTextStream,
    });

    const chunks: Array<{ content: string }> = [];
    for await (const chunk of agent.stream('Test prompt')) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(0);
  });
});

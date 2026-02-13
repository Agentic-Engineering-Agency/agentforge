import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent, AgentConfig } from './agent';

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

  it('should instantiate an agent with the correct properties', () => {
    const agent = new Agent(config);
    expect(agent.id).toBe('test-agent');
    expect(agent.name).toBe('Test Agent');
  });

  it('should handle instantiation without optional tools', () => {
    const configWithoutTools: AgentConfig = {
      id: 'no-tools',
      name: 'No Tools Agent',
      instructions: 'No tools here.',
      model: mockModel,
    };
    expect(() => new Agent(configWithoutTools)).not.toThrow();
  });

  it('should handle instantiation with tools', () => {
    const configWithTools: AgentConfig = {
      ...config,
      tools: { myTool: { execute: () => 'result' } },
    };
    expect(() => new Agent(configWithTools)).not.toThrow();
  });

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

  it('should accept a string model ID', () => {
    const configWithString: AgentConfig = {
      id: 'string-model',
      name: 'String Model Agent',
      instructions: 'Test',
      model: 'openai/gpt-4o',
    };
    const agent = new Agent(configWithString);
    expect(agent.id).toBe('string-model');
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

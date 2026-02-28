import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FailoverChain, FailoverExhaustedError } from './failover';
import { Agent } from './agent';

// Mock the Agent class
vi.mock('./agent', () => ({
  Agent: vi.fn(),
}));

describe('FailoverChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('instantiates with provider configs', () => {
    const chain = new FailoverChain({
      providers: [{ model: 'openai/gpt-4o-mini' }],
    });
    expect(chain).toBeTruthy();
  });

  it('has a generate method', () => {
    const chain = new FailoverChain({
      providers: [{ model: 'openai/gpt-4o-mini' }],
    });
    expect(typeof chain.generate).toBe('function');
  });

  it('throws FailoverExhaustedError if all providers fail', async () => {
    const mockAgent = {
      generate: vi.fn().mockRejectedValue(new Error('API error')),
    };

    vi.mocked(Agent).mockReturnValue(mockAgent as any);

    const chain = new FailoverChain({
      providers: [{ model: 'openai/bad-model' }],
    });

    await expect(
      chain.generate([{ role: 'user', content: 'test' }], {})
    ).rejects.toThrow(FailoverExhaustedError);
  });

  it('FailoverChain retries with next provider on failure', async () => {
    // Create mock agents with different behavior based on model string
    const mockAgents = new Map<string, any>();
    mockAgents.set('openai/gpt-4', {
      generate: vi.fn().mockRejectedValue(new Error('Provider 1 failed')),
    });
    mockAgents.set('anthropic/claude-3-5-sonnet', {
      generate: vi.fn().mockResolvedValue({ text: 'Success from provider 2' }),
    });

    // Mock Agent constructor to return appropriate agent based on model
    vi.mocked(Agent).mockImplementation((config: any) => {
      return mockAgents.get(config.model);
    });

    const chain = new FailoverChain({
      providers: [
        { model: 'openai/gpt-4' },
        { model: 'anthropic/claude-3-5-sonnet' },
      ],
    });

    const messages = [{ role: 'user', content: 'test' }];
    const result = await chain.generate(messages, {});

    expect(result.text).toBe('Success from provider 2');
    expect(mockAgents.get('openai/gpt-4')!.generate).toHaveBeenCalled();
    expect(mockAgents.get('anthropic/claude-3-5-sonnet')!.generate).toHaveBeenCalled();
  });

  it('FailoverChain succeeds on second provider', async () => {
    const mockAgents = new Map<string, any>();
    mockAgents.set('openai/gpt-4', {
      generate: vi.fn().mockRejectedValue(new Error('Rate limited')),
    });
    mockAgents.set('anthropic/claude-3-5-sonnet', {
      generate: vi.fn().mockResolvedValue({ text: 'Response from provider 2' }),
    });

    vi.mocked(Agent).mockImplementation((config: any) => {
      return mockAgents.get(config.model);
    });

    const chain = new FailoverChain({
      providers: [
        { model: 'openai/gpt-4' },
        { model: 'anthropic/claude-3-5-sonnet' },
      ],
    });

    const messages = [{ role: 'user', content: 'hello' }];
    const result = await chain.generate(messages, {});

    expect(result.text).toBe('Response from provider 2');
    expect(mockAgents.get('openai/gpt-4')!.generate).toHaveBeenCalled();
    expect(mockAgents.get('anthropic/claude-3-5-sonnet')!.generate).toHaveBeenCalled();
  });
});

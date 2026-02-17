/**
 * Tests for Model Failover Chain
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ModelFailoverChain,
  createFailoverChain,
  createFailoverChainFromConfig,
  type FailoverEvent,
  type CircuitStateChangeEvent,
  type FailoverChainConfig,
} from './failover-chain.js';

// Mock the model-resolver module
vi.mock('./model-resolver.js', () => {
  const mockModel = {
    specificationVersion: 'v1',
    provider: 'mock',
    modelId: 'mock-model',
    defaultObjectGenerationMode: 'json',
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  };

  return {
    getModel: vi.fn(() => mockModel),
    parseModelString: vi.fn((str: string) => {
      const [provider, ...modelParts] = str.split('/');
      return { provider, modelId: modelParts.join('/') };
    }),
  };
});

describe('ModelFailoverChain', () => {
  const defaultChainConfig: FailoverChainConfig = {
    chain: [
      { provider: 'anthropic', model: 'claude-3-opus-20240229' },
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'google', model: 'gemini-1.5-pro' },
    ],
    retryPolicy: { maxRetries: 1, backoffMs: 10 }, // Fast for tests
    timeoutMs: 5000,
  };

  describe('constructor', () => {
    it('should create a chain with valid config', () => {
      const chain = new ModelFailoverChain(defaultChainConfig);
      expect(chain).toBeDefined();
      expect(chain.getChainConfig()).toHaveLength(3);
    });

    it('should throw if chain is empty', () => {
      expect(() => new ModelFailoverChain({ chain: [] })).toThrow(
        'Failover chain must contain at least one model'
      );
    });
  });

  describe('execute', () => {
    it('should succeed with the primary model', async () => {
      const chain = new ModelFailoverChain(defaultChainConfig);

      const result = await chain.execute(async (_model, provider, modelId) => {
        return `Response from ${provider}/${modelId}`;
      });

      expect(result.result).toBe('Response from anthropic/claude-3-opus-20240229');
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-3-opus-20240229');
      expect(result.chainPosition).toBe(0);
      expect(result.didFailover).toBe(false);
      expect(result.failoverEvents).toHaveLength(0);
      expect(result.totalAttempts).toBe(1);
    });

    it('should failover to second model on primary failure', async () => {
      const chain = new ModelFailoverChain(defaultChainConfig);
      let callCount = 0;

      const result = await chain.execute(async (_model, provider, modelId) => {
        callCount++;
        if (provider === 'anthropic') {
          throw new Error('500 Internal Server Error');
        }
        return `Response from ${provider}/${modelId}`;
      });

      expect(result.result).toBe('Response from openai/gpt-4o');
      expect(result.provider).toBe('openai');
      expect(result.chainPosition).toBe(1);
      expect(result.didFailover).toBe(true);
      expect(result.failoverEvents).toHaveLength(1);
      expect(result.failoverEvents[0].failedProvider).toBe('anthropic');
      expect(result.failoverEvents[0].nextProvider).toBe('openai');
    });

    it('should failover to third model when first two fail', async () => {
      const chain = new ModelFailoverChain(defaultChainConfig);

      const result = await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') throw new Error('503 Service Unavailable');
        if (provider === 'openai') throw new Error('429 Rate Limit Exceeded');
        return 'Google response';
      });

      expect(result.result).toBe('Google response');
      expect(result.provider).toBe('google');
      expect(result.chainPosition).toBe(2);
      expect(result.didFailover).toBe(true);
      expect(result.failoverEvents).toHaveLength(2);
    });

    it('should throw when all models fail', async () => {
      const chain = new ModelFailoverChain(defaultChainConfig);

      await expect(
        chain.execute(async () => {
          throw new Error('500 Server Error');
        })
      ).rejects.toThrow('All models in failover chain exhausted');
    });

    it('should retry before failing over', async () => {
      const chain = new ModelFailoverChain({
        ...defaultChainConfig,
        retryPolicy: { maxRetries: 2, backoffMs: 10 },
      });

      let anthropicAttempts = 0;

      const result = await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') {
          anthropicAttempts++;
          throw new Error('500 Server Error');
        }
        return 'OpenAI response';
      });

      expect(anthropicAttempts).toBe(3); // 1 initial + 2 retries
      expect(result.provider).toBe('openai');
    });

    it('should succeed on retry without failover', async () => {
      const chain = new ModelFailoverChain({
        ...defaultChainConfig,
        retryPolicy: { maxRetries: 2, backoffMs: 10 },
      });

      let attempts = 0;

      const result = await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') {
          attempts++;
          if (attempts < 2) throw new Error('500 Temporary Error');
          return 'Anthropic recovered';
        }
        return 'Fallback';
      });

      expect(result.result).toBe('Anthropic recovered');
      expect(result.provider).toBe('anthropic');
      expect(result.didFailover).toBe(false);
      expect(attempts).toBe(2);
    });
  });

  describe('failover events', () => {
    it('should call onFailover callback', async () => {
      const events: FailoverEvent[] = [];
      const chain = new ModelFailoverChain({
        ...defaultChainConfig,
        onFailover: (event) => {
          events.push(event);
        },
      });

      await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') throw new Error('429 Rate Limit');
        return 'OK';
      });

      expect(events).toHaveLength(1);
      expect(events[0].errorCategory).toBe('rate_limit');
      expect(events[0].failedProvider).toBe('anthropic');
      expect(events[0].nextProvider).toBe('openai');
    });
  });

  describe('circuit breaker', () => {
    it('should track circuit states', () => {
      const chain = new ModelFailoverChain(defaultChainConfig);
      const states = chain.getCircuitStates();

      expect(states).toHaveLength(3);
      states.forEach((s) => {
        expect(s.state).toBe('closed');
        expect(s.isAvailable).toBe(true);
      });
    });

    it('should open circuit after threshold failures', async () => {
      const chain = new ModelFailoverChain({
        chain: [
          { provider: 'anthropic', model: 'claude-3-opus-20240229' },
          { provider: 'openai', model: 'gpt-4o' },
        ],
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 60000 },
      });

      // Cause 3 failures to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await chain.execute(async () => {
            throw new Error('500 Server Error');
          });
        } catch {
          // Expected
        }
      }

      const states = chain.getCircuitStates();
      const anthropicState = states.find((s) => s.provider === 'anthropic');
      expect(anthropicState?.state).toBe('open');
    });

    it('should reset circuit breaker', () => {
      const chain = new ModelFailoverChain(defaultChainConfig);
      chain.resetCircuit('anthropic', 'claude-3-opus-20240229');
      chain.resetAllCircuits();
      const states = chain.getCircuitStates();
      states.forEach((s) => expect(s.state).toBe('closed'));
    });
  });

  describe('timeout', () => {
    it('should timeout slow requests', async () => {
      const chain = new ModelFailoverChain({
        ...defaultChainConfig,
        timeoutMs: 50,
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
      });

      let openaiCalled = false;

      const result = await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return 'Too slow';
        }
        openaiCalled = true;
        return 'OpenAI fast response';
      });

      expect(openaiCalled).toBe(true);
      expect(result.provider).toBe('openai');
    });
  });

  describe('error classification', () => {
    it('should classify rate limit errors', async () => {
      const events: FailoverEvent[] = [];
      const chain = new ModelFailoverChain({
        ...defaultChainConfig,
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        onFailover: (e) => events.push(e),
      });

      await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') throw new Error('429 Too Many Requests');
        return 'OK';
      });

      expect(events[0].errorCategory).toBe('rate_limit');
    });

    it('should classify server errors', async () => {
      const events: FailoverEvent[] = [];
      const chain = new ModelFailoverChain({
        ...defaultChainConfig,
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        onFailover: (e) => events.push(e),
      });

      await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') throw new Error('502 Bad Gateway');
        return 'OK';
      });

      expect(events[0].errorCategory).toBe('server_error');
    });

    it('should classify timeout errors', async () => {
      const events: FailoverEvent[] = [];
      const chain = new ModelFailoverChain({
        ...defaultChainConfig,
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        onFailover: (e) => events.push(e),
      });

      await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') throw new Error('Request timed out');
        return 'OK';
      });

      expect(events[0].errorCategory).toBe('timeout');
    });

    it('should classify network errors', async () => {
      const events: FailoverEvent[] = [];
      const chain = new ModelFailoverChain({
        ...defaultChainConfig,
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        onFailover: (e) => events.push(e),
      });

      await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') throw new Error('ENOTFOUND api.anthropic.com');
        return 'OK';
      });

      expect(events[0].errorCategory).toBe('network_error');
    });
  });
});

describe('createFailoverChain', () => {
  it('should create chain from model strings', () => {
    const chain = createFailoverChain([
      'anthropic/claude-3-opus-20240229',
      'openai/gpt-4o',
    ]);

    expect(chain.getChainConfig()).toHaveLength(2);
  });

  it('should accept options', () => {
    const chain = createFailoverChain(
      ['anthropic/claude-3-opus-20240229', 'openai/gpt-4o'],
      { retryPolicy: { maxRetries: 3 } }
    );

    expect(chain).toBeDefined();
  });
});

describe('createFailoverChainFromConfig', () => {
  it('should create chain from JSON config', () => {
    const chain = createFailoverChainFromConfig({
      failoverChain: [
        { provider: 'anthropic', model: 'claude-3-opus-20240229' },
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'google', model: 'gemini-1.5-pro' },
      ],
      retryPolicy: { maxRetries: 2, backoffMs: 1000 },
    });

    expect(chain.getChainConfig()).toHaveLength(3);
  });
});

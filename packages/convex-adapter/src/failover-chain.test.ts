/**
 * Tests for Model Failover Chain and Provider Registry
 *
 * Covers:
 * - ModelFailoverChain: execute, retry, failover, circuit breaker, timeout
 * - ProviderRegistry: cost estimation, metrics tracking, health scoring
 * - Factory functions: createFailoverChain, createFailoverChainFromConfig, createFailoverChainFromAgent
 * - Error classification: rate_limit, server_error, timeout, network_error, auth_error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ModelFailoverChain,
  createFailoverChain,
  createFailoverChainFromConfig,
  createFailoverChainFromAgent,
  type FailoverEvent,
  type CircuitStateChangeEvent,
  type FailoverChainConfig,
} from './failover-chain.js';
import {
  ProviderRegistry,
  getProviderRegistry,
  resetProviderRegistry,
} from './provider-registry.js';

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

// =====================================================
// ModelFailoverChain Tests
// =====================================================

describe('ModelFailoverChain', () => {
  const defaultChainConfig: FailoverChainConfig = {
    chain: [
      { provider: 'anthropic', model: 'claude-3-opus-20240229' },
      { provider: 'openai', model: 'gpt-4o' },
      { provider: 'google', model: 'gemini-1.5-pro' },
    ],
    retryPolicy: { maxRetries: 1, backoffMs: 10 }, // Fast for tests
    timeoutMs: 5000,
    trackMetrics: false, // Disable metrics for basic tests
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

    it('should accept a single model chain', () => {
      const chain = new ModelFailoverChain({
        chain: [{ provider: 'openai', model: 'gpt-4o' }],
      });
      expect(chain.getChainConfig()).toHaveLength(1);
    });
  });

  describe('execute — primary model success', () => {
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
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('execute — failover', () => {
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
  });

  describe('execute — retry logic', () => {
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

    it('should apply exponential backoff', async () => {
      const chain = new ModelFailoverChain({
        chain: [{ provider: 'openai', model: 'gpt-4o' }],
        retryPolicy: { maxRetries: 2, backoffMs: 50, backoffMultiplier: 2 },
        trackMetrics: false,
      });

      const start = Date.now();
      let attempts = 0;

      try {
        await chain.execute(async () => {
          attempts++;
          throw new Error('500 Server Error');
        });
      } catch {
        // Expected
      }

      const elapsed = Date.now() - start;
      expect(attempts).toBe(3);
      // Should have waited ~50ms + ~100ms = ~150ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(100);
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

    it('should include all failover events in result', async () => {
      const chain = new ModelFailoverChain({
        ...defaultChainConfig,
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
      });

      const result = await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') throw new Error('503 Service Unavailable');
        if (provider === 'openai') throw new Error('429 Rate Limit');
        return 'Google response';
      });

      expect(result.failoverEvents).toHaveLength(2);
      expect(result.failoverEvents[0].failedProvider).toBe('anthropic');
      expect(result.failoverEvents[0].nextProvider).toBe('openai');
      expect(result.failoverEvents[0].errorCategory).toBe('server_error');
      expect(result.failoverEvents[1].failedProvider).toBe('openai');
      expect(result.failoverEvents[1].nextProvider).toBe('google');
      expect(result.failoverEvents[1].errorCategory).toBe('rate_limit');
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
        trackMetrics: false,
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

    it('should skip open circuit models and go to next', async () => {
      const events: FailoverEvent[] = [];
      const chain = new ModelFailoverChain({
        chain: [
          { provider: 'anthropic', model: 'claude-3-opus-20240229' },
          { provider: 'openai', model: 'gpt-4o' },
        ],
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        circuitBreaker: { failureThreshold: 2, resetTimeoutMs: 60000 },
        onFailover: (e) => events.push(e),
        trackMetrics: false,
      });

      // Open the anthropic circuit
      for (let i = 0; i < 2; i++) {
        try {
          await chain.execute(async (_model, provider) => {
            if (provider === 'anthropic') throw new Error('500 Server Error');
            return 'OpenAI OK';
          });
        } catch {
          // Expected
        }
      }

      // Now the circuit should be open, next call should go directly to openai
      const result = await chain.execute(async (_model, provider) => {
        return `Response from ${provider}`;
      });

      expect(result.provider).toBe('openai');
    });

    it('should fire onCircuitStateChange callback', async () => {
      const stateChanges: CircuitStateChangeEvent[] = [];
      const chain = new ModelFailoverChain({
        chain: [
          { provider: 'anthropic', model: 'claude-3-opus-20240229' },
          { provider: 'openai', model: 'gpt-4o' },
        ],
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        circuitBreaker: { failureThreshold: 2, resetTimeoutMs: 60000 },
        onCircuitStateChange: (e) => stateChanges.push(e),
        trackMetrics: false,
      });

      // Cause failures to trigger circuit state change
      for (let i = 0; i < 2; i++) {
        try {
          await chain.execute(async () => {
            throw new Error('500 Server Error');
          });
        } catch {
          // Expected
        }
      }

      // Should have at least one state change event (closed → open)
      expect(stateChanges.length).toBeGreaterThanOrEqual(1);
      const anthropicChange = stateChanges.find(
        (e) => e.provider === 'anthropic' && e.newState === 'open'
      );
      expect(anthropicChange).toBeDefined();
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

    it('should respect per-model timeout override', async () => {
      const chain = new ModelFailoverChain({
        chain: [
          { provider: 'anthropic', model: 'claude-3-opus-20240229', timeoutMs: 50 },
          { provider: 'openai', model: 'gpt-4o' },
        ],
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        timeoutMs: 10000, // Global timeout is high
        trackMetrics: false,
      });

      const result = await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return 'Too slow';
        }
        return 'OpenAI fast';
      });

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

    it('should classify auth errors', async () => {
      const events: FailoverEvent[] = [];
      const chain = new ModelFailoverChain({
        ...defaultChainConfig,
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        onFailover: (e) => events.push(e),
      });

      await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') throw new Error('401 Unauthorized - Invalid API Key');
        return 'OK';
      });

      expect(events[0].errorCategory).toBe('auth_error');
    });

    it('should classify quota exceeded as rate_limit', async () => {
      const events: FailoverEvent[] = [];
      const chain = new ModelFailoverChain({
        ...defaultChainConfig,
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        onFailover: (e) => events.push(e),
      });

      await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') throw new Error('Quota exceeded for this billing period');
        return 'OK';
      });

      expect(events[0].errorCategory).toBe('rate_limit');
    });
  });

  describe('cost tracking integration', () => {
    it('should include cost estimate when token data is provided', async () => {
      const registry = new ProviderRegistry();
      const chain = new ModelFailoverChain({
        chain: [{ provider: 'openai', model: 'gpt-4o' }],
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        registry,
        trackMetrics: true,
      });

      const result = await chain.execute(
        async () => 'Response',
        { inputTokens: 1000, outputTokens: 500 }
      );

      expect(result.costEstimate).toBeDefined();
      expect(result.costEstimate!.provider).toBe('openai');
      expect(result.costEstimate!.model).toBe('gpt-4o');
      expect(result.costEstimate!.inputTokens).toBe(1000);
      expect(result.costEstimate!.outputTokens).toBe(500);
      expect(result.costEstimate!.totalCostUsd).toBeGreaterThan(0);
    });

    it('should not include cost estimate when no token data', async () => {
      const chain = new ModelFailoverChain({
        chain: [{ provider: 'openai', model: 'gpt-4o' }],
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        trackMetrics: false,
      });

      const result = await chain.execute(async () => 'Response');
      expect(result.costEstimate).toBeUndefined();
    });

    it('should record metrics in the registry on success', async () => {
      const registry = new ProviderRegistry();
      const chain = new ModelFailoverChain({
        chain: [{ provider: 'openai', model: 'gpt-4o' }],
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        registry,
        trackMetrics: true,
      });

      await chain.execute(
        async () => 'Response',
        { inputTokens: 1000, outputTokens: 500 }
      );

      const metrics = registry.getMetrics('openai', 'gpt-4o');
      expect(metrics).toBeDefined();
      expect(metrics!.totalRequests).toBe(1);
      expect(metrics!.successfulRequests).toBe(1);
      expect(metrics!.failedRequests).toBe(0);
      expect(metrics!.totalInputTokens).toBe(1000);
      expect(metrics!.totalOutputTokens).toBe(500);
      expect(metrics!.totalCostUsd).toBeGreaterThan(0);
    });

    it('should record failure metrics in the registry', async () => {
      const registry = new ProviderRegistry();
      const chain = new ModelFailoverChain({
        chain: [
          { provider: 'anthropic', model: 'claude-3-opus-20240229' },
          { provider: 'openai', model: 'gpt-4o' },
        ],
        retryPolicy: { maxRetries: 0, backoffMs: 10 },
        registry,
        trackMetrics: true,
      });

      await chain.execute(async (_model, provider) => {
        if (provider === 'anthropic') throw new Error('500 Server Error');
        return 'OK';
      });

      const anthropicMetrics = registry.getMetrics('anthropic', 'claude-3-opus-20240229');
      expect(anthropicMetrics).toBeDefined();
      expect(anthropicMetrics!.failedRequests).toBe(1);
      expect(anthropicMetrics!.lastError).toContain('500 Server Error');
    });
  });

  describe('getChainMetrics', () => {
    it('should return metrics and health scores for all chain models', async () => {
      const registry = new ProviderRegistry();
      const chain = new ModelFailoverChain({
        ...defaultChainConfig,
        registry,
        trackMetrics: true,
      });

      // Execute a successful request
      await chain.execute(async () => 'Response');

      const chainMetrics = chain.getChainMetrics();
      expect(chainMetrics).toHaveLength(3);
      expect(chainMetrics[0].provider).toBe('anthropic');
      expect(chainMetrics[0].healthScore).toBeGreaterThanOrEqual(0);
      expect(chainMetrics[0].healthScore).toBeLessThanOrEqual(1);
    });
  });
});

// =====================================================
// Factory Function Tests
// =====================================================

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

  it('should accept all optional config fields', () => {
    const chain = createFailoverChainFromConfig({
      failoverChain: [
        { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test', timeoutMs: 5000 },
      ],
      retryPolicy: { maxRetries: 1, backoffMs: 500, backoffMultiplier: 3, maxBackoffMs: 10000 },
      circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 30000, successThreshold: 1 },
      timeoutMs: 15000,
      trackMetrics: true,
    });

    expect(chain).toBeDefined();
    expect(chain.getChainConfig()[0].apiKey).toBe('sk-test');
  });
});

describe('createFailoverChainFromAgent', () => {
  it('should create chain from agent with failoverModels', () => {
    const chain = createFailoverChainFromAgent({
      provider: 'openai',
      model: 'gpt-4o',
      failoverModels: [
        { provider: 'anthropic', model: 'claude-3-opus-20240229' },
        { provider: 'google', model: 'gemini-1.5-pro' },
      ],
    });

    const config = chain.getChainConfig();
    expect(config).toHaveLength(3);
    expect(config[0].provider).toBe('openai');
    expect(config[0].model).toBe('gpt-4o');
    expect(config[1].provider).toBe('anthropic');
    expect(config[2].provider).toBe('google');
  });

  it('should create single-model chain when no failoverModels', () => {
    const chain = createFailoverChainFromAgent({
      provider: 'openai',
      model: 'gpt-4o',
    });

    const config = chain.getChainConfig();
    expect(config).toHaveLength(1);
    expect(config[0].provider).toBe('openai');
  });

  it('should use defaults when provider/model not specified', () => {
    const chain = createFailoverChainFromAgent({});

    const config = chain.getChainConfig();
    expect(config).toHaveLength(1);
    expect(config[0].provider).toBe('openrouter');
    expect(config[0].model).toBe('openai/gpt-4o-mini');
  });

  it('should pass through retryPolicy and timeoutMs', () => {
    const chain = createFailoverChainFromAgent({
      provider: 'openai',
      model: 'gpt-4o',
      retryPolicy: { maxRetries: 5 },
      timeoutMs: 60000,
    });

    expect(chain).toBeDefined();
  });
});

// =====================================================
// ProviderRegistry Tests
// =====================================================

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    resetProviderRegistry();
  });

  describe('provider lookup', () => {
    it('should return a registered provider', () => {
      const provider = registry.getProvider('openai');
      expect(provider).toBeDefined();
      expect(provider!.name).toBe('OpenAI');
      expect(provider!.apiKeyEnvVar).toBe('OPENAI_API_KEY');
    });

    it('should return undefined for unknown provider', () => {
      const provider = registry.getProvider('unknown' as any);
      expect(provider).toBeUndefined();
    });

    it('should list all providers', () => {
      const providers = registry.getAllProviders();
      expect(providers.length).toBeGreaterThanOrEqual(4);
      const ids = providers.map((p) => p.id);
      expect(ids).toContain('openai');
      expect(ids).toContain('anthropic');
      expect(ids).toContain('google');
      expect(ids).toContain('openrouter');
    });

    it('should find a specific model', () => {
      const model = registry.getModel('openai', 'gpt-4o');
      expect(model).toBeDefined();
      expect(model!.displayName).toBe('GPT-4o');
      expect(model!.contextWindow).toBe(128_000);
      expect(model!.supportsStreaming).toBe(true);
      expect(model!.supportsTools).toBe(true);
    });

    it('should return undefined for unknown model', () => {
      const model = registry.getModel('openai', 'nonexistent-model');
      expect(model).toBeUndefined();
    });
  });

  describe('cost estimation', () => {
    it('should estimate cost for a known model', () => {
      const cost = registry.estimateCost('openai', 'gpt-4o', 1000, 500);

      expect(cost.provider).toBe('openai');
      expect(cost.model).toBe('gpt-4o');
      expect(cost.inputTokens).toBe(1000);
      expect(cost.outputTokens).toBe(500);
      expect(cost.inputCostUsd).toBeCloseTo(0.0025, 4); // 1000/1M * $2.5
      expect(cost.outputCostUsd).toBeCloseTo(0.005, 4); // 500/1M * $10
      expect(cost.totalCostUsd).toBeCloseTo(0.0075, 4);
    });

    it('should use default pricing for unknown models', () => {
      const cost = registry.estimateCost('openai', 'unknown-model', 1000, 500);

      expect(cost.totalCostUsd).toBeGreaterThan(0);
      // Default: input=$1/M, output=$2/M
      expect(cost.inputCostUsd).toBeCloseTo(0.001, 4);
      expect(cost.outputCostUsd).toBeCloseTo(0.001, 4);
    });

    it('should estimate cost for Anthropic models', () => {
      const cost = registry.estimateCost('anthropic', 'claude-sonnet-4-20250514', 10000, 5000);

      expect(cost.inputCostUsd).toBeCloseTo(0.03, 4); // 10000/1M * $3
      expect(cost.outputCostUsd).toBeCloseTo(0.075, 4); // 5000/1M * $15
    });

    it('should estimate cost for Google models', () => {
      const cost = registry.estimateCost('google', 'gemini-2.5-flash', 100000, 50000);

      expect(cost.inputCostUsd).toBeCloseTo(0.015, 4); // 100000/1M * $0.15
      expect(cost.outputCostUsd).toBeCloseTo(0.03, 4); // 50000/1M * $0.6
    });
  });

  describe('runtime metrics', () => {
    it('should record and retrieve request metrics', () => {
      registry.recordRequest('openai', 'gpt-4o', {
        success: true,
        latencyMs: 1200,
        inputTokens: 1000,
        outputTokens: 500,
      });

      const metrics = registry.getMetrics('openai', 'gpt-4o');
      expect(metrics).toBeDefined();
      expect(metrics!.totalRequests).toBe(1);
      expect(metrics!.successfulRequests).toBe(1);
      expect(metrics!.failedRequests).toBe(0);
      expect(metrics!.avgLatencyMs).toBe(1200);
      expect(metrics!.totalInputTokens).toBe(1000);
      expect(metrics!.totalOutputTokens).toBe(500);
      expect(metrics!.totalCostUsd).toBeGreaterThan(0);
    });

    it('should track failed requests', () => {
      registry.recordRequest('anthropic', 'claude-3-opus-20240229', {
        success: false,
        latencyMs: 500,
        error: 'Rate limit exceeded',
      });

      const metrics = registry.getMetrics('anthropic', 'claude-3-opus-20240229');
      expect(metrics!.failedRequests).toBe(1);
      expect(metrics!.lastError).toBe('Rate limit exceeded');
    });

    it('should calculate average latency over multiple requests', () => {
      registry.recordRequest('openai', 'gpt-4o', { success: true, latencyMs: 1000 });
      registry.recordRequest('openai', 'gpt-4o', { success: true, latencyMs: 2000 });
      registry.recordRequest('openai', 'gpt-4o', { success: true, latencyMs: 3000 });

      const metrics = registry.getMetrics('openai', 'gpt-4o');
      expect(metrics!.avgLatencyMs).toBe(2000);
    });

    it('should calculate P95 latency', () => {
      // Record 20 requests with increasing latency
      for (let i = 1; i <= 20; i++) {
        registry.recordRequest('openai', 'gpt-4o', {
          success: true,
          latencyMs: i * 100,
        });
      }

      const metrics = registry.getMetrics('openai', 'gpt-4o');
      // P95 of [100, 200, ..., 2000] = 1900 or 2000
      expect(metrics!.p95LatencyMs).toBeGreaterThanOrEqual(1900);
    });

    it('should accumulate cost across requests', () => {
      registry.recordRequest('openai', 'gpt-4o', {
        success: true,
        latencyMs: 1000,
        inputTokens: 1000,
        outputTokens: 500,
      });
      registry.recordRequest('openai', 'gpt-4o', {
        success: true,
        latencyMs: 1000,
        inputTokens: 2000,
        outputTokens: 1000,
      });

      const metrics = registry.getMetrics('openai', 'gpt-4o');
      expect(metrics!.totalInputTokens).toBe(3000);
      expect(metrics!.totalOutputTokens).toBe(1500);
      expect(metrics!.totalCostUsd).toBeGreaterThan(0);
    });

    it('should return all metrics', () => {
      registry.recordRequest('openai', 'gpt-4o', { success: true, latencyMs: 1000 });
      registry.recordRequest('anthropic', 'claude-3-opus-20240229', { success: true, latencyMs: 1500 });

      const allMetrics = registry.getAllMetrics();
      expect(allMetrics).toHaveLength(2);
    });

    it('should aggregate metrics by provider', () => {
      registry.recordRequest('openai', 'gpt-4o', {
        success: true,
        latencyMs: 1000,
        inputTokens: 1000,
        outputTokens: 500,
      });
      registry.recordRequest('openai', 'gpt-4o-mini', {
        success: true,
        latencyMs: 500,
        inputTokens: 500,
        outputTokens: 200,
      });

      const byProvider = registry.getMetricsByProvider();
      const openaiAgg = byProvider.get('openai');
      expect(openaiAgg).toBeDefined();
      expect(openaiAgg!.totalRequests).toBe(2);
      expect(openaiAgg!.totalCostUsd).toBeGreaterThan(0);
    });

    it('should reset metrics', () => {
      registry.recordRequest('openai', 'gpt-4o', { success: true, latencyMs: 1000 });
      registry.resetMetrics();

      const metrics = registry.getMetrics('openai', 'gpt-4o');
      expect(metrics).toBeUndefined();
    });

    it('should reset metrics for a specific model', () => {
      registry.recordRequest('openai', 'gpt-4o', { success: true, latencyMs: 1000 });
      registry.recordRequest('openai', 'gpt-4o-mini', { success: true, latencyMs: 500 });

      registry.resetModelMetrics('openai', 'gpt-4o');

      expect(registry.getMetrics('openai', 'gpt-4o')).toBeUndefined();
      expect(registry.getMetrics('openai', 'gpt-4o-mini')).toBeDefined();
    });
  });

  describe('health scoring', () => {
    it('should return 1.0 for models with no data', () => {
      const score = registry.getHealthScore('openai', 'gpt-4o');
      expect(score).toBe(1.0);
    });

    it('should return high score for healthy models', () => {
      registry.recordRequest('openai', 'gpt-4o', { success: true, latencyMs: 500 });
      registry.recordRequest('openai', 'gpt-4o', { success: true, latencyMs: 600 });

      const score = registry.getHealthScore('openai', 'gpt-4o');
      expect(score).toBeGreaterThan(0.8);
    });

    it('should return lower score for models with failures', () => {
      registry.recordRequest('openai', 'gpt-4o', { success: true, latencyMs: 500 });
      registry.recordRequest('openai', 'gpt-4o', { success: false, latencyMs: 500, error: 'Error' });

      const score = registry.getHealthScore('openai', 'gpt-4o');
      expect(score).toBeLessThan(1.0);
    });

    it('should return lower score for high latency models', () => {
      registry.recordRequest('openai', 'gpt-4o', { success: true, latencyMs: 25000 });

      const score = registry.getHealthScore('openai', 'gpt-4o');
      expect(score).toBeLessThan(0.7);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const r1 = getProviderRegistry();
      const r2 = getProviderRegistry();
      expect(r1).toBe(r2);
    });

    it('should reset the singleton', () => {
      const r1 = getProviderRegistry();
      resetProviderRegistry();
      const r2 = getProviderRegistry();
      expect(r1).not.toBe(r2);
    });
  });

  describe('custom providers', () => {
    it('should accept custom provider list', () => {
      const customRegistry = new ProviderRegistry([
        {
          id: 'openai',
          name: 'Custom OpenAI',
          apiKeyEnvVar: 'MY_OPENAI_KEY',
          models: [
            {
              modelId: 'my-model',
              displayName: 'My Model',
              contextWindow: 4096,
              pricing: { inputPerMillion: 1.0, outputPerMillion: 2.0 },
              supportsStreaming: true,
              supportsTools: false,
            },
          ],
        },
      ]);

      const providers = customRegistry.getAllProviders();
      expect(providers).toHaveLength(1);
      expect(providers[0].name).toBe('Custom OpenAI');

      const model = customRegistry.getModel('openai', 'my-model');
      expect(model).toBeDefined();
      expect(model!.displayName).toBe('My Model');
    });
  });
});

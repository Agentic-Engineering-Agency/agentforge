import { describe, it, expect } from 'vitest';
import {
  LLM_MODELS,
  LLM_PROVIDERS,
  DEFAULT_FAILOVER_CHAIN,
  getModelById,
  getModelsByProvider,
  getModelsByCapability,
  getProviderByKey,
} from '../convex/llmProviders';

const VALID_CAPABILITIES = ['chat', 'code', 'vision', 'reasoning', 'function_calling'];
const VALID_PRICING_TIERS = ['free', 'standard', 'premium'];

describe('Model Registry Validation', () => {
  it('all models use "provider/model-name" format', () => {
    for (const model of LLM_MODELS) {
      const parts = model.id.split('/');
      // Standard providers: exactly 2 parts (e.g. "openai/gpt-4.1")
      // openrouter models: exactly 3 parts (e.g. "openrouter/meta-llama/llama-4-maverick")
      const isStandard = parts.length === 2;
      const isOpenRouter = parts.length === 3 && parts[0] === 'openrouter';
      expect(isStandard || isOpenRouter, `Model "${model.id}" has invalid format`).toBe(true);
    }
  });

  it('no duplicate model IDs', () => {
    const ids = LLM_MODELS.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all models have required fields', () => {
    for (const model of LLM_MODELS) {
      expect(model.id, `missing id`).toBeTruthy();
      expect(model.displayName, `${model.id} missing displayName`).toBeTruthy();
      expect(model.contextWindow, `${model.id} contextWindow must be > 0`).toBeGreaterThan(0);
      expect(model.provider, `${model.id} missing provider`).toBeTruthy();
      expect(Array.isArray(model.capabilities), `${model.id} capabilities must be array`).toBe(true);
      expect(model.capabilities.length, `${model.id} capabilities must be non-empty`).toBeGreaterThan(0);
      expect(VALID_PRICING_TIERS).toContain(model.pricingTier);
    }
  });

  it('all model IDs start with their provider key', () => {
    for (const model of LLM_MODELS) {
      expect(model.id, `${model.id} should start with provider "${model.provider}/"`).toMatch(
        new RegExp(`^${model.provider}/`)
      );
    }
  });

  it('contextWindow is a positive number for all models', () => {
    for (const model of LLM_MODELS) {
      expect(typeof model.contextWindow).toBe('number');
      expect(model.contextWindow).toBeGreaterThan(0);
    }
  });

  it('pricingTier is one of "free", "standard", "premium" for all models', () => {
    for (const model of LLM_MODELS) {
      expect(VALID_PRICING_TIERS).toContain(model.pricingTier);
    }
  });

  it('capabilities only contain valid values', () => {
    for (const model of LLM_MODELS) {
      for (const cap of model.capabilities) {
        expect(VALID_CAPABILITIES, `${model.id} has invalid capability "${cap}"`).toContain(cap);
      }
    }
  });

  it('all models have isGA set to true', () => {
    for (const model of LLM_MODELS) {
      expect(model.isGA, `${model.id} should have isGA = true`).toBe(true);
    }
  });
});

describe('Provider Validation', () => {
  it('at least 8 providers', () => {
    expect(LLM_PROVIDERS.length).toBeGreaterThanOrEqual(8);
  });

  it('no duplicate provider keys', () => {
    const keys = LLM_PROVIDERS.map((p) => p.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('all providers have required fields', () => {
    for (const provider of LLM_PROVIDERS) {
      expect(provider.key, 'missing key').toBeTruthy();
      expect(provider.displayName, `${provider.key} missing displayName`).toBeTruthy();
      expect(provider.envVar, `${provider.key} missing envVar`).toBeTruthy();
      expect(provider.website, `${provider.key} missing website`).toBeTruthy();
    }
  });

  it('all envVars end with "_API_KEY" or "_KEY"', () => {
    for (const provider of LLM_PROVIDERS) {
      const valid = provider.envVar.endsWith('_API_KEY') || provider.envVar.endsWith('_KEY');
      expect(valid, `${provider.key} envVar "${provider.envVar}" must end with _API_KEY or _KEY`).toBe(true);
    }
  });

  it('every model provider exists in LLM_PROVIDERS', () => {
    const providerKeys = new Set(LLM_PROVIDERS.map((p) => p.key));
    for (const model of LLM_MODELS) {
      expect(providerKeys, `model "${model.id}" has unknown provider "${model.provider}"`).toContain(
        model.provider
      );
    }
  });
});

describe('DEFAULT_FAILOVER_CHAIN', () => {
  it('chain has at least 3 models', () => {
    expect(DEFAULT_FAILOVER_CHAIN.length).toBeGreaterThanOrEqual(3);
  });

  it('all chain entries exist in LLM_MODELS', () => {
    const modelIds = new Set(LLM_MODELS.map((m) => m.id));
    for (const entry of DEFAULT_FAILOVER_CHAIN) {
      expect(modelIds, `failover chain entry "${entry}" not found in LLM_MODELS`).toContain(entry);
    }
  });

  it('chain contains models from at least 3 different providers', () => {
    const modelMap = new Map(LLM_MODELS.map((m) => [m.id, m]));
    const providers = new Set(DEFAULT_FAILOVER_CHAIN.map((id) => modelMap.get(id)?.provider));
    expect(providers.size).toBeGreaterThanOrEqual(3);
  });

  it('no duplicates in chain', () => {
    const unique = new Set(DEFAULT_FAILOVER_CHAIN);
    expect(unique.size).toBe(DEFAULT_FAILOVER_CHAIN.length);
  });
});

describe('Model Count Validation', () => {
  it('at least 30 total models', () => {
    expect(LLM_MODELS.length).toBeGreaterThanOrEqual(30);
  });

  it('at least 10 OpenAI models', () => {
    const count = LLM_MODELS.filter((m) => m.provider === 'openai').length;
    expect(count).toBeGreaterThanOrEqual(10);
  });

  it('at least 3 Anthropic models', () => {
    const count = LLM_MODELS.filter((m) => m.provider === 'anthropic').length;
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it('at least 3 Google models', () => {
    const count = LLM_MODELS.filter((m) => m.provider === 'google').length;
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it('at least 4 Mistral models', () => {
    const count = LLM_MODELS.filter((m) => m.provider === 'mistral').length;
    expect(count).toBeGreaterThanOrEqual(4);
  });

  it('at least 2 DeepSeek models', () => {
    const count = LLM_MODELS.filter((m) => m.provider === 'deepseek').length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('at least 2 xAI models', () => {
    const count = LLM_MODELS.filter((m) => m.provider === 'xai').length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('at least 3 Cohere models', () => {
    const count = LLM_MODELS.filter((m) => m.provider === 'cohere').length;
    expect(count).toBeGreaterThanOrEqual(3);
  });

  it('at least 2 OpenRouter models (Meta/Llama)', () => {
    const count = LLM_MODELS.filter((m) => m.provider === 'openrouter').length;
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

describe('Helper Function Tests', () => {
  it('getModelById returns correct model for known ID', () => {
    const first = LLM_MODELS[0];
    const result = getModelById(first.id);
    expect(result).toBeDefined();
    expect(result?.id).toBe(first.id);
  });

  it('getModelById returns undefined for unknown ID', () => {
    const result = getModelById('unknown/model-does-not-exist');
    expect(result).toBeUndefined();
  });

  it('getModelsByProvider returns only models for that provider', () => {
    const provider = 'openai';
    const results = getModelsByProvider(provider);
    expect(results.length).toBeGreaterThan(0);
    for (const model of results) {
      expect(model.provider).toBe(provider);
    }
  });

  it('getModelsByProvider returns empty array for unknown provider', () => {
    const results = getModelsByProvider('nonexistent-provider-xyz');
    expect(results).toEqual([]);
  });

  it('getModelsByCapability("reasoning") returns models with reasoning capability', () => {
    const results = getModelsByCapability('reasoning');
    expect(results.length).toBeGreaterThan(0);
    for (const model of results) {
      expect(model.capabilities).toContain('reasoning');
    }
  });

  it('getModelsByCapability("vision") returns models with vision capability', () => {
    const results = getModelsByCapability('vision');
    expect(results.length).toBeGreaterThan(0);
    for (const model of results) {
      expect(model.capabilities).toContain('vision');
    }
  });

  it('getProviderByKey returns correct provider', () => {
    const first = LLM_PROVIDERS[0];
    const result = getProviderByKey(first.key);
    expect(result).toBeDefined();
    expect(result?.key).toBe(first.key);
  });

  it('getProviderByKey returns undefined for unknown key', () => {
    const result = getProviderByKey('totally-unknown-provider-key');
    expect(result).toBeUndefined();
  });
});

describe('Specific Model Spot Checks', () => {
  it('"openai/gpt-4.1" exists with contextWindow 1047576', () => {
    const model = getModelById('openai/gpt-4.1');
    expect(model, 'openai/gpt-4.1 not found').toBeDefined();
    expect(model?.contextWindow).toBe(1047576);
  });

  it('"anthropic/claude-opus-4-6" exists with contextWindow 200000', () => {
    const model = getModelById('anthropic/claude-opus-4-6');
    expect(model, 'anthropic/claude-opus-4-6 not found').toBeDefined();
    expect(model?.contextWindow).toBe(200000);
  });

  it('"google/gemini-2.5-pro" exists with contextWindow 1048576', () => {
    const model = getModelById('google/gemini-2.5-pro');
    expect(model, 'google/gemini-2.5-pro not found').toBeDefined();
    expect(model?.contextWindow).toBe(1048576);
  });

  it('"deepseek/deepseek-reasoner" has "reasoning" capability', () => {
    const model = getModelById('deepseek/deepseek-reasoner');
    expect(model, 'deepseek/deepseek-reasoner not found').toBeDefined();
    expect(model?.capabilities).toContain('reasoning');
  });

  it('"openrouter/meta-llama/llama-4-maverick" exists with provider "openrouter"', () => {
    const model = getModelById('openrouter/meta-llama/llama-4-maverick');
    expect(model, 'openrouter/meta-llama/llama-4-maverick not found').toBeDefined();
    expect(model?.provider).toBe('openrouter');
  });
});

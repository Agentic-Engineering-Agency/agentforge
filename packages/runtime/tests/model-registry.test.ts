import { describe, it, expect } from 'vitest';
import { getModel, getModelsByProvider, getActiveModels, getContextLimit, normalizeModelId, resolveModel } from '../src/models/registry.js';

describe('Model Registry', () => {
  describe('getModel', () => {
    it('returns correct entry for moonshotai/kimi-k2.5', () => {
      const model = getModel('moonshotai/kimi-k2.5');
      expect(model).toBeDefined();
      expect(model?.id).toBe('moonshotai/kimi-k2.5');
      expect(model?.displayName).toContain('Kimi');
      expect(model?.provider).toBe('moonshotai');
      expect(model?.contextWindow).toBeGreaterThan(0);
      expect(model?.tier).toBe('budget');
    });

    it('returns undefined for unknown model', () => {
      const model = getModel('unknown/model');
      expect(model).toBeUndefined();
    });

    it('normalizes legacy chat aliases to current OpenAI model names', () => {
      expect(normalizeModelId('openai/gpt-5.2-chat')).toBe('openai/gpt-5.2-chat-latest');
      expect(getModel('openai/gpt-5.2-chat')?.id).toBe('openai/gpt-5.2-chat-latest');
      expect(normalizeModelId('openai/gpt-5.1-chat')).toBe('openai/gpt-5.1-chat-latest');
      expect(getModel('openai/gpt-5.1-chat')?.id).toBe('openai/gpt-5.1-chat-latest');
    });
  });

  describe('getModelsByProvider', () => {
    it('returns models for openai provider', () => {
      const models = getModelsByProvider('openai');
      expect(models.length).toBeGreaterThan(0);
      models.forEach(model => {
        expect(model.provider).toBe('openai');
      });
    });

    it('returns empty array for unknown provider', () => {
      const models = getModelsByProvider('unknown');
      expect(models).toEqual([]);
    });
  });

  describe('getActiveModels', () => {
    it('returns only active models', () => {
      const models = getActiveModels();
      expect(models.length).toBeGreaterThan(0);
      models.forEach(model => {
        expect(model.active).toBe(true);
      });
    });
  });

  describe('getContextLimit', () => {
    it('returns positive number for valid model', () => {
      const limit = getContextLimit('openai/gpt-5.1');
      expect(typeof limit).toBe('number');
      expect(limit).toBeGreaterThan(0);
    });

    it('returns default 100000 for unknown model', () => {
      const limit = getContextLimit('unknown/model');
      expect(limit).toBe(100000);
    });
  });

  describe('resolveModel (failover)', () => {
    it('returns the requested model when it exists', () => {
      const model = resolveModel('openai/gpt-5.1');
      expect(model.id).toBe('openai/gpt-5.1');
    });

    it('returns first valid fallback when primary is unknown', () => {
      const model = resolveModel('unknown/model', ['anthropic/claude-sonnet-4-6', 'openai/gpt-5.1-chat-latest']);
      expect(model.id).toBe('anthropic/claude-sonnet-4-6');
    });

    it('skips unknown fallbacks and returns first valid one', () => {
      const model = resolveModel('unknown/model', ['also/unknown', 'openai/gpt-5.1-codex-mini']);
      expect(model.id).toBe('openai/gpt-5.1-codex-mini');
    });

    it('returns daemon default when all IDs are unknown', () => {
      const model = resolveModel('unknown/a', ['unknown/b']);
      expect(model.id).toBe('moonshotai/kimi-k2.5');
    });
  });

  describe('model entry structure', () => {
    it('all models have required fields', () => {
      const models = getActiveModels();
      models.forEach(model => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('displayName');
        expect(model).toHaveProperty('provider');
        expect(model).toHaveProperty('contextWindow');
        expect(model).toHaveProperty('tier');
        expect(model).toHaveProperty('capabilities');
        expect(model).toHaveProperty('roles');
        expect(model).toHaveProperty('active');
      });
    });

    it('no deprecated model IDs', () => {
      const models = getActiveModels();
      const deprecatedIds = ['claude-3-5-haiku-20241022', 'gpt-4-turbo', 'gpt-3.5-turbo', 'openai/gpt-4.1-mini', 'openai/gpt-5.1-mini', 'openai/gpt-5.2-chat'];
      const modelIds = models.map(m => m.id);
      deprecatedIds.forEach(deprecated => {
        expect(modelIds).not.toContain(deprecated);
      });
      expect(modelIds).toContain('openai/gpt-5.1-chat-latest');
      expect(modelIds).toContain('openai/gpt-5.1-codex-mini');
      expect(modelIds).toContain('openai/gpt-5.2-chat-latest');
    });
  });
});

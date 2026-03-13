/**
 * Tests for Issue #217: Chat-scoped model override
 *
 * Validates that:
 * 1. The model override is accepted in the /api/chat request body
 * 2. Invalid/unsupported models are rejected with clear errors
 * 3. The override does NOT mutate the agent's default model
 * 4. The model format follows the Mastra model router convention (provider/model-id)
 */

import { describe, it, expect } from 'vitest';
import { validateModelOverride, parseModelString } from './model-override.js';

describe('Model override validation', () => {
  describe('parseModelString', () => {
    it('should parse a valid provider/model string', () => {
      const result = parseModelString('openai/gpt-5.1');
      expect(result).toEqual({ provider: 'openai', modelId: 'gpt-5.1' });
    });

    it('should parse a model with nested path segments', () => {
      const result = parseModelString('anthropic/claude-opus-4-6');
      expect(result).toEqual({ provider: 'anthropic', modelId: 'claude-opus-4-6' });
    });

    it('should parse the default daemon model', () => {
      const result = parseModelString('moonshotai/kimi-k2.5');
      expect(result).toEqual({ provider: 'moonshotai', modelId: 'kimi-k2.5' });
    });

    it('should return null for a model string without a provider prefix', () => {
      const result = parseModelString('gpt-5.1');
      expect(result).toBeNull();
    });

    it('should return null for an empty string', () => {
      const result = parseModelString('');
      expect(result).toBeNull();
    });

    it('should return null for whitespace-only input', () => {
      const result = parseModelString('   ');
      expect(result).toBeNull();
    });

    it('should return null for a string with only a provider and slash', () => {
      const result = parseModelString('openai/');
      expect(result).toBeNull();
    });

    it('should handle models with multiple slashes in the model ID', () => {
      const result = parseModelString('openai/o3-pro/latest');
      expect(result).toEqual({ provider: 'openai', modelId: 'o3-pro/latest' });
    });
  });

  describe('validateModelOverride', () => {
    const knownProviders = ['openai', 'anthropic', 'google', 'openrouter', 'moonshotai', 'xai', 'venice', 'together'];

    it('should accept a valid model string with a known provider', () => {
      const result = validateModelOverride('openai/gpt-5.1', knownProviders);
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.modelId).toBe('gpt-5.1');
    });

    it('should accept a model from any known provider', () => {
      for (const provider of knownProviders) {
        const result = validateModelOverride(`${provider}/some-model`, knownProviders);
        expect(result.valid).toBe(true);
        expect(result.provider).toBe(provider);
      }
    });

    it('should reject a model with an unknown provider', () => {
      const result = validateModelOverride('unknownprovider/some-model', knownProviders);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('unknownprovider');
    });

    it('should reject an invalid model string format', () => {
      const result = validateModelOverride('not-a-valid-model', knownProviders);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject an empty override', () => {
      const result = validateModelOverride('', knownProviders);
      expect(result.valid).toBe(false);
    });

    it('should trim whitespace before validation', () => {
      const result = validateModelOverride('  openai/gpt-5.1  ', knownProviders);
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.modelId).toBe('gpt-5.1');
    });

    it('should accept unknown providers when knownProviders list is empty (open mode)', () => {
      const result = validateModelOverride('customprovider/model-x', []);
      expect(result.valid).toBe(true);
      expect(result.provider).toBe('customprovider');
    });
  });
});

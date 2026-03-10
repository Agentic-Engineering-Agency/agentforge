import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAgentProviders,
  getProviderEnvKey,
  getProviderEnvKeys,
  hydrateProviderEnvVars,
} from './provider-keys.js';

describe('provider-keys', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('maps provider names to expected environment variables', () => {
    expect(getProviderEnvKey('openai')).toBe('OPENAI_API_KEY');
    expect(getProviderEnvKey('google')).toBe('GOOGLE_GENERATIVE_AI_API_KEY');
    expect(getProviderEnvKey('custom')).toBe('CUSTOM_API_KEY');
    expect(getProviderEnvKeys('google')).toEqual(['GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY']);
  });

  it('collects unique providers from agent configs', () => {
    const providers = getAgentProviders([
      { provider: 'openai', model: 'gpt-4o-mini' },
      { model: 'anthropic/claude-sonnet-4-6' },
      { provider: 'openai', model: 'gpt-5.1' },
      { model: 'google/gemini-2.5-flash' },
    ]);

    expect(providers).toEqual(['openai', 'anthropic', 'google']);
  });

  it('hydrates missing env vars from Convex decrypted keys', async () => {
    const action = vi.fn(async (_fn, { provider }) => {
      if (provider === 'openai') {
        return { apiKey: 'sk-openai-test' };
      }
      return null;
    });

    const result = await hydrateProviderEnvVars({
      convexUrl: 'https://example.convex.cloud',
      deployKey: 'deploy-key',
      projectDir: '/tmp/project',
      providers: ['openai', 'anthropic'],
      client: { action },
      internalApi: {
        apiKeys: {
          getDecryptedForProvider: 'internal-api-ref',
        },
      },
    });

    expect(process.env.OPENAI_API_KEY).toBe('sk-openai-test');
    expect(result.hydrated).toEqual(['openai']);
    expect(result.missing).toEqual(['anthropic']);
    expect(result.skipped).toEqual([]);
  });

  it('does not overwrite existing env vars', async () => {
    process.env.OPENAI_API_KEY = 'already-set';
    const action = vi.fn();

    const result = await hydrateProviderEnvVars({
      convexUrl: 'https://example.convex.cloud',
      deployKey: 'deploy-key',
      projectDir: '/tmp/project',
      providers: ['openai'],
      client: { action },
      internalApi: {
        apiKeys: {
          getDecryptedForProvider: 'internal-api-ref',
        },
      },
    });

    expect(process.env.OPENAI_API_KEY).toBe('already-set');
    expect(result.skipped).toEqual(['openai']);
    expect(action).not.toHaveBeenCalled();
  });

  it('hydrates Google keys into both env var aliases', async () => {
    const action = vi.fn(async () => ({ apiKey: 'google-test-key' }));

    const result = await hydrateProviderEnvVars({
      convexUrl: 'https://example.convex.cloud',
      deployKey: 'deploy-key',
      projectDir: '/tmp/project',
      providers: ['google'],
      client: { action },
      internalApi: {
        apiKeys: {
          getDecryptedForProvider: 'internal-api-ref',
        },
      },
    });

    expect(process.env.GOOGLE_GENERATIVE_AI_API_KEY).toBe('google-test-key');
    expect(process.env.GOOGLE_API_KEY).toBe('google-test-key');
    expect(result.hydrated).toEqual(['google']);
  });
});

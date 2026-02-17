/**
 * Model Resolver for @agentforge-ai/convex-adapter
 *
 * Ported from AgentForge Cloud's mastra.ts getModel() function.
 * Supports 6 providers: openai, anthropic, google, venice, openrouter, custom.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelV1 } from 'ai';
import type { LLMProvider, ModelResolverConfig } from './types.js';

export type { LLMProvider, ModelResolverConfig };

/**
 * Resolves a model configuration to an AI SDK LanguageModelV1 instance.
 *
 * Supports BYOK (Bring Your Own Key) by accepting optional apiKey and baseUrl.
 * Falls back to environment variables for API keys if not provided.
 *
 * @param config - The model resolver configuration
 * @returns A LanguageModelV1 instance ready for use with Mastra/Vercel AI SDK
 * @throws Error if the provider is unsupported or required credentials are missing
 *
 * @example
 * ```typescript
 * const model = getModel({
 *   provider: 'openai',
 *   modelId: 'gpt-4o',
 *   apiKey: process.env.OPENAI_API_KEY,
 * });
 * ```
 */
export function getModel(config: ModelResolverConfig): LanguageModelV1 {
  const { provider, modelId, apiKey, baseUrl } = config;

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: apiKey || getEnvVar('OPENAI_API_KEY'),
        baseURL: baseUrl,
      });
      return openai(modelId);
    }

    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: apiKey || getEnvVar('ANTHROPIC_API_KEY'),
        baseURL: baseUrl,
      });
      return anthropic(modelId);
    }

    case 'google': {
      const google = createGoogleGenerativeAI({
        apiKey: apiKey || getEnvVar('GEMINI_API_KEY'),
        baseURL: baseUrl,
      });
      return google(modelId);
    }

    case 'venice': {
      const venice = createOpenAICompatible({
        name: 'venice',
        baseURL: baseUrl || 'https://api.venice.ai/api/v1',
        apiKey: apiKey || getEnvVar('VENICE_API_KEY'),
      });
      return venice.chatModel(modelId);
    }

    case 'openrouter': {
      const openrouter = createOpenAICompatible({
        name: 'openrouter',
        baseURL: baseUrl || 'https://openrouter.ai/api/v1',
        apiKey: apiKey || getEnvVar('OPENROUTER_API_KEY'),
      });
      return openrouter.chatModel(modelId);
    }

    case 'custom': {
      if (!baseUrl) {
        throw new Error('Custom provider requires a baseUrl');
      }
      const custom = createOpenAICompatible({
        name: 'custom',
        baseURL: baseUrl,
        apiKey: apiKey || getEnvVar('CUSTOM_API_KEY'),
      });
      return custom.chatModel(modelId);
    }

    default:
      throw new Error(`Unsupported provider: ${provider as string}`);
  }
}

/**
 * Parse a model string ID into a ModelResolverConfig.
 *
 * Supports formats like:
 * - 'openai/gpt-4o' -> { provider: 'openai', modelId: 'gpt-4o' }
 * - 'anthropic/claude-3-opus-20240229' -> { provider: 'anthropic', modelId: 'claude-3-opus-20240229' }
 *
 * @param modelString - The model string ID (e.g., 'openai/gpt-4o')
 * @returns A ModelResolverConfig
 * @throws Error if the format is invalid or provider is unsupported
 */
export function parseModelString(modelString: string): ModelResolverConfig {
  const parts = modelString.split('/');

  if (parts.length < 2) {
    throw new Error(
      `Invalid model string format: "${modelString}". Expected format: "provider/modelId" (e.g., "openai/gpt-4o")`
    );
  }

  const provider = parts[0] as LLMProvider;
  const modelId = parts.slice(1).join('/'); // Handle cases like 'openai/gpt-4o-mini'

  // Validate provider
  const validProviders: LLMProvider[] = [
    'openai',
    'anthropic',
    'google',
    'venice',
    'openrouter',
    'custom',
  ];

  if (!validProviders.includes(provider)) {
    throw new Error(
      `Unsupported provider: "${provider}". Valid providers: ${validProviders.join(', ')}`
    );
  }

  return {
    provider,
    modelId,
  };
}

/**
 * Get an environment variable value.
 * Works in both Node.js and Convex Node Action environments.
 *
 * @param name - The name of the environment variable
 * @returns The environment variable value
 * @throws Error if the variable is not set
 */
function getEnvVar(name: string): string {
  const value = typeof process !== 'undefined' ? process.env[name] : undefined;

  if (!value) {
    throw new Error(
      `Environment variable "${name}" is not set. ` +
        `Please set it in your Convex dashboard or pass the apiKey explicitly.`
    );
  }

  return value;
}

/**
 * Create a model resolver configuration from an agent record.
 *
 * This is a convenience function for converting stored agent records
 * into model resolver configs that can be used with getModel().
 *
 * @param record - The agent record from Convex
 * @returns A ModelResolverConfig
 */
export function createModelConfigFromRecord(record: {
  model?: string;
  provider?: string;
  config?: {
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
    [key: string]: unknown;
  };
}): ModelResolverConfig {
  const provider = (record.provider || 'openai') as LLMProvider;
  const modelId = record.model || 'gpt-4o-mini';
  const config = record.config || {};

  return {
    provider,
    modelId,
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  };
}

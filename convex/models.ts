/**
 * Model Fetching Queries for AgentForge
 *
 * Provides queries to get cached models from various LLM providers.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

// Model definitions from various providers
const PROVIDER_MODELS: Record<string, Array<{ id: string; name: string; context: number; pricing?: { input: number; output: number } }>> = {
  openrouter: [
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", context: 128000, pricing: { input: 0.15, output: 0.6 } },
    { id: "openai/gpt-4o", name: "GPT-4o", context: 128000, pricing: { input: 2.5, output: 10.0 } },
    { id: "openai/gpt-4.1", name: "GPT-4.1", context: 128000, pricing: { input: 2.0, output: 8.0 } },
    { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", context: 128000, pricing: { input: 0.4, output: 1.6 } },
    { id: "openai/o3-mini", name: "o3-mini", context: 200000, pricing: { input: 1.1, output: 4.4 } },
    { id: "anthropic/claude-sonnet-4-20250514", name: "Claude Sonnet 4", context: 200000, pricing: { input: 3.0, output: 15.0 } },
    { id: "anthropic/claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", context: 200000, pricing: { input: 3.0, output: 15.0 } },
    { id: "anthropic/claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", context: 200000, pricing: { input: 0.8, output: 4.0 } },
    { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", context: 1000000, pricing: { input: 0.15, output: 0.6 } },
    { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash", context: 1000000, pricing: { input: 0.1, output: 0.4 } },
    { id: "google/gemini-pro", name: "Gemini Pro", context: 917280, pricing: { input: 0.5, output: 1.5 } },
    { id: "deepseek/deepseek-chat", name: "DeepSeek Chat", context: 128000, pricing: { input: 0.14, output: 0.28 } },
    { id: "deepseek/deepseek-reasoner", name: "DeepSeek Reasoner", context: 64000, pricing: { input: 0.55, output: 2.19 } },
    { id: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B", context: 131072, pricing: { input: 0.8, output: 0.8 } },
    { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", context: 131072, pricing: { input: 0.2, output: 0.2 } },
    { id: "mistralai/mistral-large", name: "Mistral Large", context: 128000, pricing: { input: 2.0, output: 6.0 } },
    { id: "mistralai/mistral-7b", name: "Mistral 7B", context: 32768, pricing: { input: 0.07, output: 0.07 } },
    { id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", context: 131072, pricing: { input: 0.4, output: 0.4 } },
    { id: "x-ai/grok-2", name: "Grok 2", context: 131072, pricing: { input: 2.0, output: 10.0 } },
  ],
  openai: [
    { id: "gpt-4o-mini", name: "GPT-4o Mini", context: 128000, pricing: { input: 0.15, output: 0.6 } },
    { id: "gpt-4o", name: "GPT-4o", context: 128000, pricing: { input: 2.5, output: 10.0 } },
    { id: "gpt-4.1", name: "GPT-4.1", context: 128000, pricing: { input: 2.0, output: 8.0 } },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", context: 128000, pricing: { input: 0.4, output: 1.6 } },
    { id: "o3-mini", name: "o3-mini", context: 200000, pricing: { input: 1.1, output: 4.4 } },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", context: 200000, pricing: { input: 3.0, output: 15.0 } },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", context: 200000, pricing: { input: 3.0, output: 15.0 } },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", context: 200000, pricing: { input: 0.8, output: 4.0 } },
  ],
  google: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", context: 1000000, pricing: { input: 0.15, output: 0.6 } },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", context: 1000000, pricing: { input: 0.1, output: 0.4 } },
    { id: "gemini-pro", name: "Gemini Pro", context: 917280, pricing: { input: 0.5, output: 1.5 } },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", context: 131072, pricing: { input: 0.59, output: 0.79 } },
    { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B Versatile", context: 131072, pricing: { input: 0.59, output: 0.79 } },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", context: 32768, pricing: { input: 0.24, output: 0.24 } },
  ],
  deepinfra: [
    { id: "meta-llama/Meta-Llama-3.1-405B-Instruct", name: "Llama 3.1 405B", context: 131072, pricing: { input: 0.8, output: 0.8 } },
    { id: "meta-llama/Meta-Llama-3.3-70B-Instruct", name: "Llama 3.3 70B", context: 131072, pricing: { input: 0.2, output: 0.2 } },
    { id: "mistralai/Mistral-Nemo-Instruct-2407", name: "Mistral Nemo", context: 128000, pricing: { input: 0.15, output: 0.15 } },
  ],
};

/**
 * Query: Get cached models for a provider.
 */
export const getCachedModels = query({
  args: {
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // For now, return the static model definitions
    // In the future, this could be cached in a database table
    if (args.provider) {
      return PROVIDER_MODELS[args.provider] ?? [];
    }
    return PROVIDER_MODELS;
  },
});

/**
 * Query: Get all available providers.
 */
export const listProviders = query({
  args: {},
  handler: async (ctx) => {
    return Object.keys(PROVIDER_MODELS).map((provider) => ({
      id: provider,
      name: provider.charAt(0).toUpperCase() + provider.slice(1),
      modelCount: PROVIDER_MODELS[provider]?.length ?? 0,
    }));
  },
});

/**
 * Query: Get model details by ID.
 */
export const getModelById = query({
  args: {
    provider: v.string(),
    modelId: v.string(),
  },
  handler: async (ctx, args) => {
    const models = PROVIDER_MODELS[args.provider] ?? [];
    return models.find((m) => m.id === args.modelId) ?? null;
  },
});

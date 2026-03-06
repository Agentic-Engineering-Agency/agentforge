"use node";

/**
 * modelFetcher.ts — Convex node action that fetches live model lists from provider APIs.
 * Falls back to the static LLM_MODELS list when the API is unavailable or no key is set.
 */

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { LLM_MODELS, LLM_PROVIDERS } from "./llmProviders";  // LLMModel removed (unused)

// ---------------------------------------------------------------------------
// Deprecated model filtering
// ---------------------------------------------------------------------------

/**
 * For OpenAI specifically, only these model IDs are allowed for chat completion.
 * Everything else (audio, realtime, image, dated snapshots) is excluded.
 */
const OPENAI_CHAT_ALLOWLIST = new Set([
  "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
  "gpt-4o", "gpt-4o-mini",
  "o1", "o1-mini", "o3", "o3-mini", "o4-mini",
  "chatgpt-4o-latest",
  // Include gpt-5 tier if present
  "gpt-5", "gpt-5-mini", "gpt-5-nano",
]);

/**
 * Patterns for deprecated AI models — used for non-OpenAI providers.
 */
const DEPRECATED_MODEL_PATTERNS = [
  // Claude 3.x (replaced by Claude 4.x)
  /claude-3[^.6]/,
  /claude-3\.5/,

  // GPT-3.5 and all GPT-4 legacy
  /gpt-3\.5/,
  /gpt-4-turbo/,
  /gpt-4-32k/,
  /gpt-4-0\d{3}/,        // dated snapshots: gpt-4-0613, gpt-4-0125-preview
  /gpt-4-1106/,
  /gpt-4-vision/,

  // Gemini 1.x
  /gemini-1\./,
  /gemini-pro$/,

  // Old preview/instruct/legacy
  /-20230/,
  /-20240229/,
  /davinci/,
  /babbage/,
  /curie/,
  /ada$/,
];

/**
 * Check if a model ID matches any deprecated pattern.
 * @param modelId - The model ID to check (e.g., "openai/gpt-3.5-turbo")
 * @returns true if the model is deprecated and should be filtered out
 */
function isDeprecated(modelId: string): boolean {
  // Extract just the model name (after provider/)
  const modelName = modelId.includes('/') ? modelId.split('/').slice(1).join('/') : modelId;
  return DEPRECATED_MODEL_PATTERNS.some(pattern => pattern.test(modelName));
}

// ---------------------------------------------------------------------------
// Provider-specific fetchers
// ---------------------------------------------------------------------------

interface FetchedModel {
  id: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  capabilities: string[];
  isGA: boolean;
}

async function fetchOpenAIModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI models API: ${res.status}`);
  const { data } = await res.json() as { data: Array<{ id: string; object: string }> };

  // Use strict allowlist: only known current chat completion models
  const allowedModels = data.filter(m =>
    m.object === "model" && OPENAI_CHAT_ALLOWLIST.has(m.id)
  );

  // Fallback: if allowlist returns nothing (future API changes), use broad filter
  const sourceModels = allowedModels.length > 0
    ? allowedModels
    : data.filter(m =>
        m.object === "model" &&
        (m.id.startsWith("gpt-4.1") || m.id.startsWith("gpt-4o") || m.id.startsWith("o3") || m.id.startsWith("o4") || m.id === "gpt-5")
      );

  return sourceModels
    .map(m => ({
      id: `openai/${m.id}`,
      displayName: m.id,
      provider: "openai",
      contextWindow:
        m.id.includes("4o") || m.id.includes("4.1") || m.id.startsWith("o") ? 128000 : 8192,
      capabilities: ["chat", "function_calling"],
      isGA: !m.id.includes("preview"),
    }));
}

async function fetchAnthropicModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) throw new Error(`Anthropic models API: ${res.status}`);
  const { data } = await res.json() as { data: Array<{ id: string; display_name: string }> };

  return data
    .map(m => ({
      id: `anthropic/${m.id}`,
      displayName: m.display_name || m.id,
      provider: "anthropic",
      contextWindow: 200000,  // All current Anthropic models support 200K
      capabilities: ["chat", "vision"],
      isGA: true,
    }))
    .filter(m => !isDeprecated(m.id));
}

async function fetchGoogleModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  if (!res.ok) throw new Error(`Google models API: ${res.status}`);
  const { models } = await res.json() as {
    models: Array<{
      name: string;
      displayName: string;
      inputTokenLimit?: number;
      supportedGenerationMethods?: string[];
    }>;
  };

  return models
    .filter(m =>
      m.supportedGenerationMethods?.includes("generateContent") &&
      m.name.includes("gemini")
    )
    .map(m => {
      const modelId = m.name.replace("models/", "");
      return {
        id: `google/${modelId}`,
        displayName: m.displayName || modelId,
        provider: "google",
        contextWindow: m.inputTokenLimit ?? 32768,
        capabilities: ["chat", "vision"],
        isGA: !modelId.includes("exp") && !modelId.includes("preview"),
      };
    })
    .filter(m => !isDeprecated(m.id));
}

async function fetchMistralModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://api.mistral.ai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Mistral models API: ${res.status}`);
  const { data } = await res.json() as {
    data: Array<{
      id: string;
      name?: string;
      max_context_length?: number;
      capabilities?: { completion_chat?: boolean };
    }>;
  };

  return data
    .filter(m => m.capabilities?.completion_chat !== false)
    .map(m => ({
      id: `mistral/${m.id}`,
      displayName: m.name || m.id,
      provider: "mistral",
      contextWindow: m.max_context_length ?? 32768,
      capabilities: ["chat"],
      isGA: !m.id.includes("dev") && !m.id.includes("test"),
    }))
    .filter(m => !isDeprecated(m.id));
}

async function fetchOpenRouterModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenRouter models API: ${res.status}`);
  const { data } = await res.json() as {
    data: Array<{
      id: string;
      name: string;
      context_length?: number;
      architecture?: { modality?: string };
    }>;
  };

  return data
    .filter(m => m.architecture?.modality?.includes("text"))
    .map(m => ({
      id: `openrouter/${m.id}`,
      displayName: m.name || m.id,
      provider: "openrouter",
      contextWindow: m.context_length ?? 8192,
      capabilities: ["chat"],
      isGA: true,
    }))
    .filter(m => !isDeprecated(m.id));
}


async function fetchDeepSeekModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://api.deepseek.com/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`DeepSeek models API: ${res.status}`);
  const { data } = await res.json() as { data: Array<{ id: string; owned_by?: string }> };

  return data
    .filter(m => m.id.startsWith("deepseek-"))
    .map(m => ({
      id: `deepseek/${m.id}`,
      displayName: m.id.replace("deepseek-", "DeepSeek ").replace(/-/g, " "),
      provider: "deepseek",
      contextWindow: m.id.includes("reasoner") ? 64000 : 64000,
      capabilities: m.id.includes("reasoner") ? ["chat", "reasoning"] : ["chat", "code"],
      isGA: true,
    }))
    .filter(m => !isDeprecated(m.id));
}

async function fetchXAIModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://api.x.ai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`xAI models API: ${res.status}`);
  const { data } = await res.json() as { data: Array<{ id: string; created?: number }> };

  return data
    .filter(m => m.id.startsWith("grok-"))
    .map(m => ({
      id: `xai/${m.id}`,
      displayName: m.id.replace(/-/g, " ").replace(/\w/g, c => c.toUpperCase()),
      provider: "xai",
      contextWindow: m.id.includes("vision") ? 32768 : 131072,
      capabilities: m.id.includes("vision") ? ["chat", "vision"] : ["chat"],
      isGA: !m.id.includes("mini") && !m.id.includes("beta"),
    }))
    .filter(m => !isDeprecated(m.id));
}

async function fetchCohereModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://api.cohere.com/v2/models?default_only=false&endpoint=chat&page_size=50", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Cohere models API: ${res.status}`);
  const { models } = await res.json() as { models: Array<{ name: string; endpoints?: string[]; context_length?: number }> };

  return models
    .filter(m => m.endpoints?.includes("chat"))
    .map(m => ({
      id: `cohere/${m.name}`,
      displayName: m.name.replace(/-/g, " ").replace(/\w/g, c => c.toUpperCase()),
      provider: "cohere",
      contextWindow: m.context_length ?? 128000,
      capabilities: ["chat"],
      isGA: !m.name.includes("trial") && !m.name.includes("beta"),
    }))
    .filter(m => !isDeprecated(m.id));
}

async function fetchModelsForProvider(provider: string, apiKey: string): Promise<FetchedModel[]> {
  switch (provider) {
    case "openai":     return fetchOpenAIModels(apiKey);
    case "anthropic":  return fetchAnthropicModels(apiKey);
    case "google":     return fetchGoogleModels(apiKey);
    case "mistral":    return fetchMistralModels(apiKey);
    case "openrouter": return fetchOpenRouterModels(apiKey);
    case "deepseek":    return fetchDeepSeekModels(apiKey);
    case "xai":         return fetchXAIModels(apiKey);
    case "cohere":      return fetchCohereModels(apiKey);
    default:           return [];
  }
}

// ---------------------------------------------------------------------------
// Return type (matches Convex validator shape)
// ---------------------------------------------------------------------------

type ModelResult = {
  id: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  capabilities: string[];
  isGA: boolean;
  isFromAPI: boolean;
};

// ---------------------------------------------------------------------------
// Public Convex action — called by the frontend
// ---------------------------------------------------------------------------

export const getModelsForProvider = action({
  args: { provider: v.string() },
  returns: v.array(v.object({
    id: v.string(),
    displayName: v.string(),
    provider: v.string(),
    contextWindow: v.number(),
    capabilities: v.array(v.string()),
    isGA: v.boolean(),
    isFromAPI: v.boolean(),
  })),
  handler: async (ctx, { provider }): Promise<ModelResult[]> => {
    const staticModels: ModelResult[] = LLM_MODELS
      .filter(m => m.provider === provider)
      .map(m => ({
        id: m.id,
        displayName: m.displayName,
        provider: m.provider,
        contextWindow: m.contextWindow,
        capabilities: [...m.capabilities],
        isGA: m.isGA,
        isFromAPI: false,
      }));

    try {
      const keyData = await ctx.runAction(internal.apiKeys.getDecryptedForProvider, { provider });
      if (!keyData) return staticModels;

      const liveModels = await fetchModelsForProvider(provider, keyData as string);
      if (liveModels.length === 0) return staticModels;

      return liveModels.map(m => ({ ...m, isFromAPI: true }));
    } catch (err) {
      console.warn(`[modelFetcher] Live fetch failed for ${provider}, using static list:`, err);
      return staticModels;
    }
  },
});

// ---------------------------------------------------------------------------
// Internal action — fetch all providers (for background refresh)
// ---------------------------------------------------------------------------

export const refreshAllModels = action({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {};
    for (const providerCfg of LLM_PROVIDERS) {
      try {
        const keyData = await ctx.runAction(internal.apiKeys.getDecryptedForProvider, {
          provider: providerCfg.key,
        });
        if (!keyData) continue;
        const models = await fetchModelsForProvider(providerCfg.key, keyData);
        counts[providerCfg.key] = models.length;
      } catch {
        // silently skip providers without keys
      }
    }
    return counts;
  },
});

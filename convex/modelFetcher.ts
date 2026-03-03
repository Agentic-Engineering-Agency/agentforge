"use node";

/**
 * modelFetcher.ts — Convex node action that fetches live model lists from provider APIs.
 * Falls back to the static LLM_MODELS list when the API is unavailable or no key is set.
 */

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { LLM_MODELS, LLM_PROVIDERS, type LLMModel } from "./llmProviders";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FetchedModel {
  id: string;          // Mastra-style "provider/model-id"
  displayName: string;
  provider: string;
  contextWindow: number;
  capabilities: string[];
  isGA: boolean;
}

// ---------------------------------------------------------------------------
// Provider-specific fetchers
// ---------------------------------------------------------------------------

async function fetchOpenAIModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI models API: ${res.status}`);
  const { data } = await res.json() as { data: Array<{ id: string; object: string }> };

  // Only include chat-capable GPT / o-series models
  const chatModels = data.filter(m =>
    m.object === "model" &&
    (m.id.startsWith("gpt-") || m.id.startsWith("o1") || m.id.startsWith("o3") || m.id.startsWith("chatgpt-"))
  );

  return chatModels.map(m => ({
    id: `openai/${m.id}`,
    displayName: m.id,
    provider: "openai",
    contextWindow: m.id.includes("32k") ? 32768 : m.id.includes("128k") || m.id.includes("4o") || m.id.includes("4.1") ? 128000 : 8192,
    capabilities: ["chat", "function_calling"],
    isGA: !m.id.includes("preview") && !m.id.includes("instruct"),
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

  return data.map(m => ({
    id: `anthropic/${m.id}`,
    displayName: m.display_name || m.id,
    provider: "anthropic",
    contextWindow: m.id.includes("opus") ? 200000 : 200000,
    capabilities: ["chat", "vision"],
    isGA: true,
  }));
}

async function fetchGoogleModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  if (!res.ok) throw new Error(`Google models API: ${res.status}`);
  const { models } = await res.json() as { models: Array<{ name: string; displayName: string; inputTokenLimit?: number; supportedGenerationMethods?: string[] }> };

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
    });
}

async function fetchMistralModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://api.mistral.ai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Mistral models API: ${res.status}`);
  const { data } = await res.json() as { data: Array<{ id: string; name?: string; max_context_length?: number; capabilities?: { completion_chat?: boolean } }> };

  return data
    .filter(m => m.capabilities?.completion_chat !== false)
    .map(m => ({
      id: `mistral/${m.id}`,
      displayName: m.name || m.id,
      provider: "mistral",
      contextWindow: m.max_context_length ?? 32768,
      capabilities: ["chat"],
      isGA: !m.id.includes("dev") && !m.id.includes("test"),
    }));
}

async function fetchOpenRouterModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenRouter models API: ${res.status}`);
  const { data } = await res.json() as { data: Array<{ id: string; name: string; context_length?: number; architecture?: { modality?: string } }> };

  return data
    .filter(m => m.architecture?.modality?.includes("text"))
    .map(m => ({
      id: `openrouter/${m.id}`,
      displayName: m.name || m.id,
      provider: "openrouter",
      contextWindow: m.context_length ?? 8192,
      capabilities: ["chat"],
      isGA: true,
    }));
}

// ---------------------------------------------------------------------------
// Main fetcher dispatcher
// ---------------------------------------------------------------------------

async function fetchModelsForProvider(provider: string, apiKey: string): Promise<FetchedModel[]> {
  switch (provider) {
    case "openai":     return fetchOpenAIModels(apiKey);
    case "anthropic":  return fetchAnthropicModels(apiKey);
    case "google":     return fetchGoogleModels(apiKey);
    case "mistral":    return fetchMistralModels(apiKey);
    case "openrouter": return fetchOpenRouterModels(apiKey);
    default:           return [];
  }
}

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
  handler: async (ctx, { provider }): Promise<Array<{
    id: string; displayName: string; provider: string;
    contextWindow: number; capabilities: string[]; isGA: boolean; isFromAPI: boolean;
  }>> => {
    const staticModels = LLM_MODELS
      .filter(m => m.provider === provider)
      .map(m => ({ ...m, capabilities: [...m.capabilities], isFromAPI: false }));

    // Try to get the user's API key for this provider
    try {
      const keyData = await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, { provider });
      if (!keyData?.apiKey) return staticModels;

      const liveModels = await fetchModelsForProvider(provider, keyData.apiKey);
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

export const refreshAllModels = internalAction({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    const counts: Record<string, number> = {};
    for (const providerCfg of LLM_PROVIDERS) {
      try {
        const keyData = await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, {
          provider: providerCfg.key,
        });
        if (!keyData?.apiKey) continue;
        const models = await fetchModelsForProvider(providerCfg.key, keyData.apiKey);
        counts[providerCfg.key] = models.length;
      } catch {
        // silently skip providers without keys
      }
    }
    return counts;
  },
});

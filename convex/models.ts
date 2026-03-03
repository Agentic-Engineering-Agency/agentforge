"use node";

/**
 * Dynamic model fetching from provider APIs.
 * Falls back to the static LLM_MODELS list when live fetch fails or no key is available.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { LLM_MODELS, LLM_PROVIDERS, type LLMModel } from "./llmProviders";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FetchedModel {
  id: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  capabilities: string[];
  isGA: boolean;
  pricingTier: string;
}

// ---------------------------------------------------------------------------
// Provider-specific fetchers
// ---------------------------------------------------------------------------

async function fetchOpenAIModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenAI models fetch failed: ${res.status}`);
  const data = await res.json();
  const chatModels = (data.data as Array<{ id: string }>)
    .filter((m) =>
      m.id.startsWith("gpt-") ||
      m.id.startsWith("o1") ||
      m.id.startsWith("o3") ||
      m.id.startsWith("chatgpt-")
    )
    .map((m) => ({
      id: `openai/${m.id}`,
      displayName: m.id,
      provider: "openai",
      contextWindow: m.id.includes("128k") ? 128000 : m.id.includes("gpt-4") ? 128000 : 16000,
      capabilities: ["chat", "function_calling"] as string[],
      isGA: !m.id.includes("preview") && !m.id.includes("turbo-preview"),
      pricingTier: m.id.includes("o1") || m.id.includes("o3") || m.id.includes("gpt-4.1") ? "premium" : "standard",
    }));
  return chatModels;
}

async function fetchAnthropicModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) throw new Error(`Anthropic models fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.data as Array<{ id: string; display_name?: string; context_window?: number }>).map((m) => ({
    id: `anthropic/${m.id}`,
    displayName: m.display_name || m.id,
    provider: "anthropic",
    contextWindow: m.context_window ?? 200000,
    capabilities: ["chat", "code", "vision"] as string[],
    isGA: !m.id.includes("beta"),
    pricingTier: m.id.includes("opus") ? "premium" : m.id.includes("haiku") ? "standard" : "premium",
  }));
}

async function fetchGoogleModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  if (!res.ok) throw new Error(`Google models fetch failed: ${res.status}`);
  const data = await res.json();
  return (
    (data.models as Array<{ name: string; displayName?: string; inputTokenLimit?: number }>) ?? []
  )
    .filter((m) => m.name.includes("gemini"))
    .map((m) => {
      const shortId = m.name.replace("models/", "");
      return {
        id: `google/${shortId}`,
        displayName: m.displayName || shortId,
        provider: "google",
        contextWindow: m.inputTokenLimit ?? 1000000,
        capabilities: ["chat", "vision"] as string[],
        isGA: !shortId.includes("exp") && !shortId.includes("preview"),
        pricingTier: shortId.includes("ultra") || shortId.includes("2.5-pro") ? "premium" : "standard",
      };
    });
}

async function fetchOpenRouterModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`OpenRouter models fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.data as Array<{ id: string; name?: string; context_length?: number; pricing?: any }> ?? [])
    .slice(0, 100) // cap at 100 most recent
    .map((m) => ({
      id: `openrouter/${m.id}`,
      displayName: m.name || m.id,
      provider: "openrouter",
      contextWindow: m.context_length ?? 32000,
      capabilities: ["chat"] as string[],
      isGA: true,
      pricingTier: m.pricing?.prompt > 0.01 ? "premium" : "standard",
    }));
}

async function fetchMistralModels(apiKey: string): Promise<FetchedModel[]> {
  const res = await fetch("https://api.mistral.ai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Mistral models fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.data as Array<{ id: string }>).map((m) => ({
    id: `mistral/${m.id}`,
    displayName: m.id,
    provider: "mistral",
    contextWindow: 32000,
    capabilities: ["chat", "code"] as string[],
    isGA: !m.id.includes("dev") && !m.id.includes("test"),
    pricingTier: m.id.includes("large") ? "premium" : "standard",
  }));
}

// ---------------------------------------------------------------------------
// Static fallback per provider
// ---------------------------------------------------------------------------
function getStaticModels(provider: string): FetchedModel[] {
  return LLM_MODELS.filter((m) => m.provider === provider).map((m) => ({
    id: m.id,
    displayName: m.displayName,
    provider: m.provider,
    contextWindow: m.contextWindow,
    capabilities: m.capabilities as string[],
    isGA: m.isGA,
    pricingTier: m.pricingTier,
  }));
}

// ---------------------------------------------------------------------------
// Convex action: fetch models for a provider using stored API key
// ---------------------------------------------------------------------------
export const fetchForProvider = action({
  args: { provider: v.string() },
  handler: async (ctx, { provider }): Promise<FetchedModel[]> => {
    // Try to get the stored API key for this provider
    let apiKey: string | null = null;
    try {
      const keyData = await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, { provider });
      apiKey = keyData?.apiKey ?? null;
    } catch {
      // No key stored — fall through to static list
    }

    if (!apiKey) return getStaticModels(provider);

    try {
      switch (provider) {
        case "openai":
          return await fetchOpenAIModels(apiKey);
        case "anthropic":
          return await fetchAnthropicModels(apiKey);
        case "google":
          return await fetchGoogleModels(apiKey);
        case "openrouter":
          return await fetchOpenRouterModels(apiKey);
        case "mistral":
          return await fetchMistralModels(apiKey);
        default:
          return getStaticModels(provider);
      }
    } catch (err) {
      console.warn(`[models.fetchForProvider] Live fetch failed for ${provider}, using static list:`, err);
      return getStaticModels(provider);
    }
  },
});

// ---------------------------------------------------------------------------
// Convex action: fetch models for all configured providers
// ---------------------------------------------------------------------------
export const fetchAll = action({
  args: {},
  handler: async (ctx): Promise<Record<string, FetchedModel[]>> => {
    const results: Record<string, FetchedModel[]> = {};
    const providers = LLM_PROVIDERS.map((p) => p.key);
    await Promise.all(
      providers.map(async (provider) => {
        results[provider] = await ctx.runAction(internal.models.fetchForProvider, { provider });
      })
    );
    return results;
  },
});

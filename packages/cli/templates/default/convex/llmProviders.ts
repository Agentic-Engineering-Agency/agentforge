export type ModelCapability = "chat" | "code" | "vision" | "reasoning" | "function_calling";
export type PricingTier = "free" | "standard" | "premium";

export interface LLMModel {
  /**
   * Mastra-native model ID.
   * Standard format: "provider/model-name"
   * OpenRouter format: "openrouter/<upstream-provider>/<model>"
   */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Provider key (lowercase) */
  provider: string;
  /** Context window in tokens */
  contextWindow: number;
  /** Model capabilities */
  capabilities: ModelCapability[];
  /** Pricing tier */
  pricingTier: PricingTier;
  /** Whether this model is generally available (not beta/preview) */
  isGA: boolean;
  /** Optional: max output tokens if different from context window */
  maxOutputTokens?: number;
  /** Pricing per million tokens (input/output in USD) */
  pricing?: { input: number; output: number };
}

export interface ProviderConfig {
  /** Provider key used in Mastra format */
  key: string;
  /** Display name */
  displayName: string;
  /** Environment variable for API key (Mastra auto-reads these) */
  envVar: string;
  /** Provider website */
  website: string;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export const LLM_PROVIDERS: ProviderConfig[] = [
  {
    key: "openai",
    displayName: "OpenAI",
    envVar: "OPENAI_API_KEY",
    website: "https://platform.openai.com",
  },
  {
    key: "anthropic",
    displayName: "Anthropic",
    envVar: "ANTHROPIC_API_KEY",
    website: "https://console.anthropic.com",
  },
  {
    key: "google",
    displayName: "Google",
    envVar: "GOOGLE_API_KEY",
    website: "https://ai.google.dev",
  },
  {
    key: "mistral",
    displayName: "Mistral",
    envVar: "MISTRAL_API_KEY",
    website: "https://console.mistral.ai",
  },
  {
    key: "deepseek",
    displayName: "DeepSeek",
    envVar: "DEEPSEEK_API_KEY",
    website: "https://platform.deepseek.com",
  },
  {
    key: "xai",
    displayName: "xAI",
    envVar: "XAI_API_KEY",
    website: "https://console.x.ai",
  },
  {
    key: "cohere",
    displayName: "Cohere",
    envVar: "COHERE_API_KEY",
    website: "https://dashboard.cohere.com",
  },
  {
    key: "openrouter",
    displayName: "OpenRouter",
    envVar: "OPENROUTER_API_KEY",
    website: "https://openrouter.ai",
  },
];

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

export const LLM_MODELS: LLMModel[] = [
  // --- OpenAI ---
  {
    id: "openai/gpt-5.4",
    displayName: "GPT-5.4",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "vision", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 4.0, output: 18.0 },
  },
  {
    id: "openai/gpt-5.4-pro",
    displayName: "GPT-5.4 Pro",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "vision", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 18.0, output: 72.0 },
  },
  {
    id: "openai/gpt-5.3-chat-latest",
    displayName: "GPT-5.3 Chat",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "vision", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 2.5, output: 12.0 },
  },
  {
    id: "openai/gpt-5.3-codex",
    displayName: "GPT-5.3 Codex",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 3.0, output: 15.0 },
  },
  {
    id: "openai/gpt-5.2",
    displayName: "GPT-5.2",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "vision", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 3.0, output: 15.0 },
  },
  {
    id: "openai/gpt-5.2-chat-latest",
    displayName: "GPT-5.2 Chat",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "vision", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 2.0, output: 12.0 },
  },
  {
    id: "openai/gpt-5.2-codex",
    displayName: "GPT-5.2 Codex",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 2.5, output: 12.0 },
  },
  {
    id: "openai/gpt-5.2-pro",
    displayName: "GPT-5.2 Pro",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "vision", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 15.0, output: 60.0 },
  },
  {
    id: "openai/gpt-5.1",
    displayName: "GPT-5.1",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "vision", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 32768,
    pricing: { input: 2.0, output: 10.0 },
  },
  {
    id: "openai/gpt-5.1-chat-latest",
    displayName: "GPT-5.1 Chat",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "vision", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 32768,
    pricing: { input: 2.0, output: 10.0 },
  },
  {
    id: "openai/gpt-5.1-codex",
    displayName: "GPT-5.1 Codex",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 2.5, output: 12.0 },
  },
  {
    id: "openai/gpt-5.1-codex-max",
    displayName: "GPT-5.1 Codex Max",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 3.0, output: 15.0 },
  },
  {
    id: "openai/gpt-5.1-codex-mini",
    displayName: "GPT-5.1 Codex Mini",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "function_calling"],
    pricingTier: "standard",
    isGA: true,
    maxOutputTokens: 32768,
    pricing: { input: 1.0, output: 5.0 },
  },
  {
    id: "openai/gpt-5-mini",
    displayName: "GPT-5 Mini",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "function_calling"],
    pricingTier: "standard",
    isGA: true,
    maxOutputTokens: 32768,
    pricing: { input: 0.25, output: 2.0 },
  },
  {
    id: "openai/o3",
    displayName: "o3",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "reasoning"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 100000,
    pricing: { input: 10.0, output: 40.0 },
  },
  {
    id: "openai/o4-mini",
    displayName: "o4 Mini",
    provider: "openai",
    contextWindow: 200000,
    capabilities: ["chat", "code", "reasoning", "vision"],
    pricingTier: "standard",
    isGA: true,
    maxOutputTokens: 100000,
    pricing: { input: 1.1, output: 4.4 },
  },

  // --- Anthropic ---
  {
    id: "anthropic/claude-opus-4-6",
    displayName: "Claude Opus 4.6",
    provider: "anthropic",
    contextWindow: 200000,
    capabilities: ["chat", "code", "vision", "reasoning", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 32000,
    pricing: { input: 15.0, output: 75.0 },
  },
  {
    id: "anthropic/claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    provider: "anthropic",
    contextWindow: 200000,
    capabilities: ["chat", "code", "vision", "reasoning", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 16000,
    pricing: { input: 3.0, output: 15.0 },
  },
  {
    id: "anthropic/claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
    provider: "anthropic",
    contextWindow: 200000,
    capabilities: ["chat", "code", "vision", "function_calling"],
    pricingTier: "standard",
    isGA: true,
    maxOutputTokens: 8192,
    pricing: { input: 0.8, output: 4.0 },
  },

  // --- Google ---
  {
    id: "google/gemini-3.1-pro-preview",
    displayName: "Gemini 3.1 Pro (Preview)",
    provider: "google",
    contextWindow: 1048576,
    capabilities: ["chat", "code", "vision", "reasoning", "function_calling"],
    pricingTier: "premium",
    isGA: false,
    maxOutputTokens: 65536,
    pricing: { input: 1.5, output: 6.0 },
  },
  {
    id: "google/gemini-3-flash-preview",
    displayName: "Gemini 3 Flash (Preview)",
    provider: "google",
    contextWindow: 1048576,
    capabilities: ["chat", "code", "vision", "function_calling"],
    pricingTier: "standard",
    isGA: false,
    maxOutputTokens: 65536,
    pricing: { input: 0.1, output: 0.4 },
  },
  {
    id: "google/gemini-3.1-flash-lite-preview",
    displayName: "Gemini 3.1 Flash Lite (Preview)",
    provider: "google",
    contextWindow: 1048576,
    capabilities: ["chat", "vision", "function_calling"],
    pricingTier: "free",
    isGA: false,
    maxOutputTokens: 65536,
    pricing: { input: 0.01, output: 0.04 },
  },
  {
    id: "google/gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    provider: "google",
    contextWindow: 1048576,
    capabilities: ["chat", "code", "vision", "reasoning", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 1.25, output: 10.0 },
  },
  {
    id: "google/gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    provider: "google",
    contextWindow: 1048576,
    capabilities: ["chat", "code", "vision", "reasoning", "function_calling"],
    pricingTier: "standard",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 0.075, output: 0.3 },
  },

  // --- Mistral ---
  {
    id: "mistral/mistral-large-latest",
    displayName: "Mistral Large",
    provider: "mistral",
    contextWindow: 128000,
    capabilities: ["chat", "code", "vision", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    pricing: { input: 2.0, output: 6.0 },
  },
  {
    id: "mistral/mistral-small-latest",
    displayName: "Mistral Small",
    provider: "mistral",
    contextWindow: 128000,
    capabilities: ["chat", "code", "function_calling"],
    pricingTier: "standard",
    isGA: true,
    pricing: { input: 0.1, output: 0.3 },
  },
  {
    id: "mistral/codestral-latest",
    displayName: "Codestral",
    provider: "mistral",
    contextWindow: 256000,
    capabilities: ["code", "chat", "function_calling"],
    pricingTier: "standard",
    isGA: true,
    pricing: { input: 0.3, output: 0.9 },
  },
  {
    id: "mistral/mistral-medium-latest",
    displayName: "Mistral Medium",
    provider: "mistral",
    contextWindow: 128000,
    capabilities: ["chat", "code", "function_calling"],
    pricingTier: "standard",
    isGA: true,
    pricing: { input: 0.4, output: 1.2 },
  },
  {
    id: "mistral/pixtral-large-latest",
    displayName: "Pixtral Large",
    provider: "mistral",
    contextWindow: 128000,
    capabilities: ["chat", "code", "vision", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    pricing: { input: 2.0, output: 6.0 },
  },

  // --- DeepSeek ---
  {
    id: "deepseek/deepseek-chat",
    displayName: "DeepSeek Chat (V3)",
    provider: "deepseek",
    contextWindow: 128000,
    capabilities: ["chat", "code", "function_calling"],
    pricingTier: "standard",
    isGA: true,
    maxOutputTokens: 8192,
    pricing: { input: 0.27, output: 1.1 },
  },
  {
    id: "deepseek/deepseek-reasoner",
    displayName: "DeepSeek Reasoner (R1)",
    provider: "deepseek",
    contextWindow: 128000,
    capabilities: ["chat", "code", "reasoning"],
    pricingTier: "standard",
    isGA: true,
    maxOutputTokens: 8192,
    pricing: { input: 0.55, output: 2.19 },
  },

  // --- xAI ---
  {
    id: "xai/grok-3",
    displayName: "Grok 3",
    provider: "xai",
    contextWindow: 131072,
    capabilities: ["chat", "code", "vision", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 16384,
    pricing: { input: 3.0, output: 15.0 },
  },
  {
    id: "xai/grok-3-mini",
    displayName: "Grok 3 Mini",
    provider: "xai",
    contextWindow: 131072,
    capabilities: ["chat", "code", "reasoning", "function_calling"],
    pricingTier: "standard",
    isGA: true,
    maxOutputTokens: 16384,
    pricing: { input: 0.3, output: 0.5 },
  },

  // --- Cohere ---
  {
    id: "cohere/command-r-plus",
    displayName: "Command R+",
    provider: "cohere",
    contextWindow: 128000,
    capabilities: ["chat", "code", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 4096,
    pricing: { input: 2.5, output: 10.0 },
  },
  {
    id: "cohere/command-r",
    displayName: "Command R",
    provider: "cohere",
    contextWindow: 128000,
    capabilities: ["chat", "code", "function_calling"],
    pricingTier: "standard",
    isGA: true,
    maxOutputTokens: 4096,
    pricing: { input: 0.15, output: 0.6 },
  },
  {
    id: "cohere/command-a",
    displayName: "Command A",
    provider: "cohere",
    contextWindow: 256000,
    capabilities: ["chat", "code", "reasoning", "function_calling"],
    pricingTier: "premium",
    isGA: true,
    maxOutputTokens: 8192,
    pricing: { input: 2.5, output: 10.0 },
  },

  // --- Meta (via OpenRouter) ---
  {
    id: "openrouter/meta-llama/llama-4-maverick",
    displayName: "Llama 4 Maverick",
    provider: "openrouter",
    contextWindow: 1048576,
    capabilities: ["chat", "code", "vision"],
    pricingTier: "standard",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 0.25, output: 1.0 },
  },
  {
    id: "openrouter/meta-llama/llama-4-scout",
    displayName: "Llama 4 Scout",
    provider: "openrouter",
    contextWindow: 512000,
    capabilities: ["chat", "code", "vision"],
    pricingTier: "standard",
    isGA: true,
    maxOutputTokens: 65536,
    pricing: { input: 0.15, output: 0.6 },
  },
];

// ---------------------------------------------------------------------------
// Failover chain
// ---------------------------------------------------------------------------

/**
 * Default failover chain for the registry layer.
 * NOTE: Runtime failover in convex/chat.ts and convex/mastraIntegration.ts
 * uses its own {provider, model} pairs. Wire this into the runtime or
 * keep in sync manually when updating models.
 */
export const DEFAULT_FAILOVER_CHAIN: string[] = [
  "openai/gpt-5.4",
  "openai/gpt-5.1-chat-latest",
  "openai/gpt-5.1-codex-mini",
  "anthropic/claude-haiku-4-5",
  "google/gemini-2.5-flash",
  "deepseek/deepseek-chat",
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getModelById(id: string): LLMModel | undefined {
  return LLM_MODELS.find((model) => model.id === id);
}

export function getModelsByProvider(provider: string): LLMModel[] {
  return LLM_MODELS.filter((model) => model.provider === provider);
}

export function getModelsByCapability(capability: ModelCapability): LLMModel[] {
  return LLM_MODELS.filter((model) => model.capabilities.includes(capability));
}

export function getProviderByKey(key: string): ProviderConfig | undefined {
  return LLM_PROVIDERS.find((provider) => provider.key === key);
}

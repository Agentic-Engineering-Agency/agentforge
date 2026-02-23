import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core";

/**
 * Mastra Integration for AgentForge
 * 
 * This module provides integration between AgentForge and Mastra,
 * enabling agent orchestration, workflow management, and LLM interactions.
 */

export interface AgentForgeAgentConfig {
  id: string;
  name: string;
  instructions: string;
  model: string;
  provider: string;
  tools?: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface LLMProvider {
  id: string;
  name: string;
  models: string[];
  apiKeyRequired: boolean;
  endpoint?: string;
}

/**
 * Supported LLM providers — kept in sync with convex/llmProviders.ts.
 * Model IDs use the Mastra "provider/model-name" format.
 */
export const SUPPORTED_PROVIDERS: LLMProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "openai/gpt-4.1",
      "openai/gpt-4.1-mini",
      "openai/gpt-4.1-nano",
      "openai/o1",
      "openai/o1-mini",
      "openai/o3",
      "openai/o3-mini",
      "openai/o4-mini",
    ],
    apiKeyRequired: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      "anthropic/claude-opus-4-6",
      "anthropic/claude-sonnet-4-6",
      "anthropic/claude-haiku-4-5",
    ],
    apiKeyRequired: true,
  },
  {
    id: "google",
    name: "Google",
    models: [
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "google/gemini-2.0-flash",
    ],
    apiKeyRequired: true,
  },
  {
    id: "mistral",
    name: "Mistral",
    models: [
      "mistral/mistral-large-latest",
      "mistral/mistral-small-latest",
      "mistral/codestral-latest",
      "mistral/mistral-medium-latest",
      "mistral/pixtral-large-latest",
    ],
    apiKeyRequired: true,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    models: [
      "deepseek/deepseek-chat",
      "deepseek/deepseek-reasoner",
    ],
    apiKeyRequired: true,
  },
  {
    id: "xai",
    name: "xAI",
    models: [
      "xai/grok-3",
      "xai/grok-3-mini",
    ],
    apiKeyRequired: true,
  },
  {
    id: "cohere",
    name: "Cohere",
    models: [
      "cohere/command-r-plus",
      "cohere/command-r",
      "cohere/command-a",
    ],
    apiKeyRequired: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    models: [
      "openrouter/meta-llama/llama-4-maverick",
      "openrouter/meta-llama/llama-4-scout",
    ],
    apiKeyRequired: true,
    endpoint: "https://openrouter.ai/api/v1",
  },
];

/**
 * Create a Mastra agent from AgentForge configuration
 */
export function createMastraAgent(config: AgentForgeAgentConfig): Agent {
  // Format model string for Mastra
  // Mastra expects format: "provider/model"
  const modelString = config.model.includes("/")
    ? config.model
    : `${config.provider}/${config.model}`;

  return new Agent({
    id: config.id,
    name: config.name,
    instructions: config.instructions,
    model: modelString,
    tools: config.tools || {},
    ...(config.temperature && { temperature: config.temperature }),
    ...(config.maxTokens && { maxTokens: config.maxTokens }),
    ...(config.topP && { topP: config.topP }),
  });
}

/**
 * Initialize a bare Mastra instance.
 *
 * NOTE: This function is not currently used at runtime. Agent execution is
 * handled directly via the `Agent` class in convex/mastraIntegration.ts.
 * This export is retained for future use when we need a centrally-configured
 * Mastra instance with storage, telemetry, or registered workflows.
 */
export function createMastraInstance(config?: {
  apiKeys?: Record<string, string>;
  observability?: boolean;
}): Mastra {
  const mastraConfig: any = {};
  if (config?.apiKeys) {
    mastraConfig.apiKeys = config.apiKeys;
  }
  // Note: observability expects an ObservabilityEntrypoint object, not a boolean.
  // Pass an actual ObservabilityEntrypoint instance when enabling observability.
  return new Mastra(mastraConfig);
}

/**
 * Execute an agent with a prompt
 */
export async function executeAgent(
  agent: Agent,
  prompt: string,
  options?: {
    stream?: boolean;
    context?: any;
  }
): Promise<any> {
  try {
    const result = await agent.generate(prompt, {
      ...(options?.stream && { stream: options.stream }),
      ...(options?.context && { context: options.context }),
    });

    return result;
  } catch (error) {
    console.error("Error executing agent:", error);
    throw error;
  }
}

/**
 * Get provider configuration for a given provider ID
 */
export function getProviderConfig(providerId: string): LLMProvider | undefined {
  return SUPPORTED_PROVIDERS.find((p) => p.id === providerId);
}

/**
 * Validate provider and model combination
 */
export function validateProviderModel(
  provider: string,
  model: string
): boolean {
  const providerConfig = getProviderConfig(provider);
  if (!providerConfig) {
    return false;
  }

  // Check if model is in the provider's supported models
  return providerConfig.models.some((m) => model.includes(m));
}

/**
 * Format model string for Mastra
 */
export function formatModelString(provider: string, model: string): string {
  if (model.includes("/")) {
    return model;
  }
  return `${provider}/${model}`;
}

/**
 * Parse model string to extract provider and model
 */
export function parseModelString(modelString: string): {
  provider: string;
  model: string;
} {
  const parts = modelString.split("/");
  if (parts.length === 2) {
    return {
      provider: parts[0],
      model: parts[1],
    };
  }
  return {
    provider: "openai", // default
    model: modelString,
  };
}

// ─── Workflow Helpers ─────────────────────────────────────────────────────────

/**
 * Re-export Mastra workflow primitives for use in AgentForge workflow definitions.
 */
export { createWorkflow, createStep } from "@mastra/core/workflows";

/**
 * Create a Mastra instance pre-configured with one or more workflow definitions.
 */
export function createMastraInstanceWithWorkflows(config?: {
  apiKeys?: Record<string, string>;
  workflows?: Record<string, any>;
}): Mastra {
  const mastraConfig: any = {};
  if (config?.apiKeys) {
    mastraConfig.apiKeys = config.apiKeys;
  }
  if (config?.workflows) {
    mastraConfig.workflows = config.workflows;
  }
  return new Mastra(mastraConfig);
}

// ─── Cost Estimation ──────────────────────────────────────────────────────────

/**
 * Estimate token cost for a given model and token count.
 *
 * Pricing is per million tokens (USD) and kept in sync with convex/llmProviders.ts.
 * The lookup key is the full Mastra model ID ("provider/model-name").
 */
export function estimateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Build full model key — callers may pass either "openai/gpt-4o" or just "gpt-4o".
  const modelKey = model.includes("/") ? model : `${provider}/${model}`;

  const costPerMillionTokens: Record<string, { input: number; output: number }> = {
    // OpenAI
    "openai/gpt-4o": { input: 2.5, output: 10.0 },
    "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
    "openai/gpt-4.1": { input: 2.0, output: 8.0 },
    "openai/gpt-4.1-mini": { input: 0.4, output: 1.6 },
    "openai/gpt-4.1-nano": { input: 0.1, output: 0.4 },
    "openai/o1": { input: 15.0, output: 60.0 },
    "openai/o1-mini": { input: 1.1, output: 4.4 },
    "openai/o3": { input: 10.0, output: 40.0 },
    "openai/o3-mini": { input: 1.1, output: 4.4 },
    "openai/o4-mini": { input: 1.1, output: 4.4 },
    // Anthropic
    "anthropic/claude-opus-4-6": { input: 15.0, output: 75.0 },
    "anthropic/claude-sonnet-4-6": { input: 3.0, output: 15.0 },
    "anthropic/claude-haiku-4-5": { input: 0.8, output: 4.0 },
    // Google
    "google/gemini-2.5-pro": { input: 1.25, output: 10.0 },
    "google/gemini-2.5-flash": { input: 0.15, output: 0.6 },
    "google/gemini-2.0-flash": { input: 0.1, output: 0.4 },
    // Mistral
    "mistral/mistral-large-latest": { input: 2.0, output: 6.0 },
    "mistral/mistral-small-latest": { input: 0.1, output: 0.3 },
    "mistral/codestral-latest": { input: 0.3, output: 0.9 },
    "mistral/mistral-medium-latest": { input: 0.4, output: 1.2 },
    "mistral/pixtral-large-latest": { input: 2.0, output: 6.0 },
    // DeepSeek
    "deepseek/deepseek-chat": { input: 0.27, output: 1.1 },
    "deepseek/deepseek-reasoner": { input: 0.55, output: 2.19 },
    // xAI
    "xai/grok-3": { input: 3.0, output: 15.0 },
    "xai/grok-3-mini": { input: 0.3, output: 0.5 },
    // Cohere
    "cohere/command-r-plus": { input: 2.5, output: 10.0 },
    "cohere/command-r": { input: 0.15, output: 0.6 },
    "cohere/command-a": { input: 2.5, output: 10.0 },
    // Meta via OpenRouter
    "openrouter/meta-llama/llama-4-maverick": { input: 0.25, output: 1.0 },
    "openrouter/meta-llama/llama-4-scout": { input: 0.15, output: 0.6 },
  };

  const modelCost = costPerMillionTokens[modelKey] ?? { input: 1, output: 2 };
  const inputCost = (promptTokens / 1_000_000) * modelCost.input;
  const outputCost = (completionTokens / 1_000_000) * modelCost.output;

  return inputCost + outputCost;
}

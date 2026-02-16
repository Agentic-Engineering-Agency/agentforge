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
 * Supported LLM providers
 */
export const SUPPORTED_PROVIDERS: LLMProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    models: ["gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
    apiKeyRequired: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku", "claude-3-5-sonnet"],
    apiKeyRequired: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    models: [
      "openai/gpt-4",
      "openai/gpt-4-turbo",
      "anthropic/claude-3-opus",
      "anthropic/claude-3-sonnet",
      "google/gemini-pro",
      "meta-llama/llama-3-70b",
      "deepseek/deepseek-chat",
    ],
    apiKeyRequired: true,
    endpoint: "https://openrouter.ai/api/v1",
  },
  {
    id: "google",
    name: "Google",
    models: ["gemini-pro", "gemini-pro-vision", "gemini-ultra"],
    apiKeyRequired: true,
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    models: ["grok-beta", "grok-vision-beta"],
    apiKeyRequired: true,
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
 * Initialize Mastra instance for AgentForge
 */
export function createMastraInstance(config?: {
  apiKeys?: Record<string, string>;
  observability?: boolean;
}): Mastra {
  return new Mastra({
    ...(config?.apiKeys && { apiKeys: config.apiKeys }),
    ...(config?.observability && { observability: config.observability }),
  });
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

/**
 * Estimate token cost for a given model and token count
 */
export function estimateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Simplified cost estimation
  // In production, this should use actual pricing data
  const costPerMillionTokens: Record<string, { input: number; output: number }> = {
    "gpt-4": { input: 30, output: 60 },
    "gpt-4-turbo": { input: 10, output: 30 },
    "gpt-4o": { input: 5, output: 15 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
    "claude-3-opus": { input: 15, output: 75 },
    "claude-3-sonnet": { input: 3, output: 15 },
    "claude-3-haiku": { input: 0.25, output: 1.25 },
    "claude-3-5-sonnet": { input: 3, output: 15 },
  };

  const modelCost = costPerMillionTokens[model] || { input: 1, output: 2 };
  const inputCost = (promptTokens / 1_000_000) * modelCost.input;
  const outputCost = (completionTokens / 1_000_000) * modelCost.output;

  return inputCost + outputCost;
}

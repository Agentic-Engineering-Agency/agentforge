"use node";

/**
 * Minimal Agent implementation for Convex using AI SDK directly.
 *
 * This avoids the @mastra/core bundling issues by using the AI SDK directly.
 * The AI SDK is already a dependency of @mastra/core and can be used standalone.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";

export interface AgentConfig {
  id: string;
  name: string;
  instructions: string;
  model: {
    providerId: string;
    modelId: string;
    apiKey: string;
    url?: string;
  };
  temperature?: number;
  maxTokens?: number;
}

export interface StreamChunk {
  content: string;
}

/**
 * Minimal Agent class for Convex actions.
 * Provides streaming LLM responses using the AI SDK.
 */
export class Agent {
  private readonly config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Generate a non-streaming response from the LLM.
   */
  async generate(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
  ): Promise<{ text: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    const baseUrl = this.config.model.url || this.getProviderBaseUrl(this.config.model.providerId);

    // Create the AI SDK client
    const client = createOpenAICompatible({
      baseURL: baseUrl,
      apiKey: this.config.model.apiKey,
    });

    // Build the messages array with system prompt
    const allMessages = [
      { role: "system" as const, content: this.config.instructions },
      ...messages,
    ];

    try {
      const result = await streamText({
        model: client(this.config.model.modelId),
        messages: allMessages,
        temperature: this.config.temperature ?? 0.7,
        maxTokens: this.config.maxTokens ?? 2048,
      });

      // Collect the full response
      let fullText = "";
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }

      // Wait for usage metadata
      const { usage } = await result.usage;

      return {
        text: fullText,
        usage: usage
          ? {
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
            }
          : undefined,
      };
    } catch (error) {
      throw new Error(`Agent generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stream responses from the LLM.
   * Returns an async generator of text chunks.
   */
  async *stream(input: string): AsyncGenerator<StreamChunk> {
    const baseUrl = this.config.model.url || this.getProviderBaseUrl(this.config.model.providerId);

    // Create the AI SDK client
    const client = createOpenAICompatible({
      baseURL: baseUrl,
      apiKey: this.config.model.apiKey,
    });

    // Build the messages array with system prompt
    const messages = [
      { role: "system" as const, content: this.config.instructions },
      { role: "user" as const, content: input },
    ];

    try {
      const result = await streamText({
        model: client(this.config.model.modelId),
        messages,
        temperature: this.config.temperature ?? 0.7,
        maxTokens: this.config.maxTokens ?? 2048,
      });

      for await (const chunk of result.textStream) {
        yield { content: chunk };
      }
    } catch (error) {
      throw new Error(`Agent streaming failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the base URL for a provider.
   */
  private getProviderBaseUrl(providerId: string): string {
    const urls: Record<string, string> = {
      openrouter: "https://openrouter.ai/api/v1",
      openai: "https://api.openai.com/v1",
      anthropic: "https://api.anthropic.com/v1",
      google: "https://generativelanguage.googleapis.com/v1beta",
      groq: "https://api.groq.com/openai/v1",
      deepinfra: "https://api.deepinfra.com/v1/openai",
    };
    return urls[providerId] ?? "https://api.openai.com/v1";
  }
}

/**
 * Helper to get the base model ID from a provider/model combination.
 * Strips provider prefixes like "openai/" or "anthropic/".
 */
export function getBaseModelId(providerId: string, modelId: string): string {
  // Strip provider: prefix if model is stored as "openai:gpt-4o-mini" format
  let cleanModelId = modelId;
  if (modelId.includes(":") && !modelId.includes("/")) {
    cleanModelId = modelId.split(":").slice(1).join(":");
  }

  // If modelId contains a slash, assume it's fully qualified (e.g. "openai/gpt-4o")
  if (cleanModelId.includes("/")) {
    return cleanModelId;
  }

  // Otherwise, prefix with provider ID if needed
  const providerPrefixes: Record<string, string> = {
    openrouter: "openai/",
    openai: "",
    anthropic: "",
    google: "google/",
    groq: "",
    deepinfra: "meta-llama/",
  };

  const prefix = providerPrefixes[providerId] ?? "";
  return prefix + cleanModelId;
}

/**
 * Helper to get the provider base URL.
 */
export function getProviderBaseUrl(providerId: string): string {
  const urls: Record<string, string> = {
    openrouter: "https://openrouter.ai/api/v1",
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    google: "https://generativelanguage.googleapis.com/v1beta",
    groq: "https://api.groq.com/openai/v1",
    deepinfra: "https://api.deepinfra.com/v1/openai",
  };
  return urls[providerId] ?? "https://api.openai.com/v1";
}

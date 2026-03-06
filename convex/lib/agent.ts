"use node";

/**
 * Minimal Agent implementation for Convex using AI SDK directly.
 *
 * Provider routing:
 *  - anthropic  → @ai-sdk/anthropic  (native auth: x-api-key header)
 *  - google     → @ai-sdk/google     (native auth: API key query param)
 *  - all others → @ai-sdk/openai-compatible (OpenAI-compatible REST: Bearer token)
 *    Includes: openai, openrouter, mistral, deepseek, xai/grok, groq, cohere, deepinfra
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
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
 * Build the correct AI SDK LanguageModel for a given provider.
 */
function buildLanguageModel(
  providerId: string,
  modelId: string,
  apiKey: string,
  customUrl?: string
) {
  switch (providerId) {
    case "anthropic": {
      const client = createAnthropic({ apiKey });
      return client(modelId) as any;
    }
    case "google": {
      const client = createGoogleGenerativeAI({ apiKey });
      return client(modelId) as any;
    }
    default: {
      // All OpenAI-compatible providers
      const baseURL = customUrl ?? getProviderBaseUrl(providerId);
      const client = createOpenAICompatible({
        name: providerId,
        baseURL,
        apiKey,
      });
      return client(modelId) as any;
    }
  }
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
    const { providerId, modelId, apiKey, url } = this.config.model;
    const model = buildLanguageModel(providerId, modelId, apiKey, url);

    const allMessages = [
      { role: "system" as const, content: this.config.instructions },
      ...messages,
    ];

    try {
      const result = await streamText({
        model,
        messages: allMessages,
        temperature: this.config.temperature ?? 0.7,
      });

      let fullText = "";
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }

      const usage = await result.usage;

      return {
        text: fullText,
        usage: usage
          ? {
              promptTokens: usage.inputTokens ?? 0,
              completionTokens: usage.outputTokens ?? 0,
              totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
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
    const { providerId, modelId, apiKey, url } = this.config.model;
    const model = buildLanguageModel(providerId, modelId, apiKey, url);

    const messages = [
      { role: "system" as const, content: this.config.instructions },
      { role: "user" as const, content: input },
    ];

    try {
      const result = await streamText({
        model,
        messages,
        temperature: this.config.temperature ?? 0.7,
      });

      for await (const chunk of result.textStream) {
        yield { content: chunk };
      }
    } catch (error) {
      throw new Error(`Agent streaming failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Helper to get the base model ID from a provider/model combination.
 */
export function getBaseModelId(providerId: string, modelId: string): string {
  let cleanModelId = modelId;
  if (modelId.includes(":") && !modelId.includes("/")) {
    cleanModelId = modelId.split(":").slice(1).join(":");
  }
  if (cleanModelId.includes("/")) {
    return cleanModelId;
  }
  const providerPrefixes: Record<string, string> = {
    openrouter: "openai/",
    openai: "",
    anthropic: "",
    google: "google/",
    groq: "",
    deepinfra: "meta-llama/",
    mistral: "",
    deepseek: "",
    xai: "",
    cohere: "",
  };
  const prefix = providerPrefixes[providerId] ?? "";
  return prefix + cleanModelId;
}

/**
 * Helper to get the OpenAI-compatible base URL for a provider.
 * Not used for Anthropic or Google (handled natively).
 */
export function getProviderBaseUrl(providerId: string): string {
  const urls: Record<string, string> = {
    openrouter: "https://openrouter.ai/api/v1",
    openai: "https://api.openai.com/v1",
    mistral: "https://api.mistral.ai/v1",
    deepseek: "https://api.deepseek.com",
    xai: "https://api.x.ai/v1",
    groq: "https://api.groq.com/openai/v1",
    deepinfra: "https://api.deepinfra.com/v1/openai",
    cohere: "https://api.cohere.com/compatibility/v1",
  };
  return urls[providerId] ?? "https://api.openai.com/v1";
}

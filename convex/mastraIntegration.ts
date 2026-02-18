/**
 * Mastra Integration Actions for Convex
 *
 * These actions run in the Convex Node.js runtime and execute LLM calls
 * using the Vercel AI SDK with multi-provider failover support.
 *
 * Architecture:
 * - For chat: use `chat.sendMessage` (preferred entry point)
 * - For programmatic agent execution: use `mastraIntegration.executeAgent`
 * - Model resolution: uses AI SDK providers directly with automatic failover
 * - Failover chain: primary provider → fallback1 → fallback2 → ...
 *
 * Supported providers: OpenRouter, OpenAI, Anthropic, Google Gemini, Venice, Custom
 */
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Return type for executeAgent
type ExecuteAgentResult = {
  success: boolean;
  threadId: string;
  sessionId: string;
  response: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: string;
  model: string;
  didFailover: boolean;
  latencyMs: number;
};

/**
 * Default failover chain for programmatic agent execution.
 */
const DEFAULT_FAILOVER_CHAIN = [
  { provider: "openrouter", model: "openai/gpt-4o-mini" },
  { provider: "openai", model: "gpt-4o-mini" },
  { provider: "anthropic", model: "claude-3-5-haiku-20241022" },
  { provider: "google", model: "gemini-2.0-flash" },
];

/**
 * Resolve a model instance from provider + modelId using the AI SDK.
 *
 * Supports: openrouter, openai, anthropic, google, venice, custom.
 * Falls back to OpenRouter for unknown providers (it routes to all models).
 */
async function resolveModel(provider: string, modelId: string) {
  const { createOpenAI } = await import("@ai-sdk/openai");

  switch (provider) {
    case "openai": {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      return openai(modelId);
    }

    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      return anthropic(modelId);
    }

    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      const google = createGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
      });
      return google(modelId);
    }

    case "venice": {
      const openaiCompat = createOpenAI({
        baseURL: "https://api.venice.ai/api/v1",
        apiKey: process.env.VENICE_API_KEY,
      });
      return openaiCompat(modelId);
    }

    case "openrouter":
    default: {
      const openrouter = createOpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
      });
      const routerModelId = modelId.includes("/")
        ? modelId
        : `${provider}/${modelId}`;
      return openrouter(routerModelId);
    }
  }
}

/**
 * Classify an error for failover decision-making.
 */
function classifyError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("quota exceeded")) return "rate_limit";
    if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.includes("internal server error") || msg.includes("bad gateway") || msg.includes("service unavailable")) return "server_error";
    if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("econnreset") || name.includes("timeout") || name === "aborterror") return "timeout";
    if (msg.includes("enotfound") || msg.includes("econnrefused") || msg.includes("network") || msg.includes("dns") || msg.includes("fetch failed")) return "network_error";
    if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("invalid api key")) return "auth_error";
  }
  return "unknown";
}

/**
 * Build a failover chain from an agent record.
 */
function buildFailoverChain(agent: {
  provider?: string;
  model?: string;
  failoverModels?: Array<{ provider: string; model: string }>;
}): Array<{ provider: string; model: string }> {
  const chain: Array<{ provider: string; model: string }> = [];

  // Primary model
  chain.push({
    provider: agent.provider || "openrouter",
    model: agent.model || "openai/gpt-4o-mini",
  });

  // Agent-specific failover models
  if (agent.failoverModels && agent.failoverModels.length > 0) {
    for (const fm of agent.failoverModels) {
      if (fm.provider === chain[0].provider && fm.model === chain[0].model) continue;
      chain.push(fm);
    }
  } else {
    for (const dfm of DEFAULT_FAILOVER_CHAIN) {
      if (dfm.provider === chain[0].provider && dfm.model === chain[0].model) continue;
      chain.push(dfm);
    }
  }

  return chain;
}

/**
 * Execute an LLM call with failover across multiple providers.
 */
async function executeWithFailover(
  chain: Array<{ provider: string; model: string }>,
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options: { temperature?: number; maxTokens?: number }
): Promise<{
  text: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  provider: string;
  model: string;
  didFailover: boolean;
  latencyMs: number;
}> {
  const startTime = Date.now();
  const maxRetries = 2;
  const baseBackoff = 1000;
  let totalAttempts = 0;

  for (let chainPos = 0; chainPos < chain.length; chainPos++) {
    const { provider, model: modelId } = chain[chainPos];
    const modelKey = `${provider}/${modelId}`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      totalAttempts++;

      try {
        const { generateText } = await import("ai");
        const resolvedModel = await resolveModel(provider, modelId);

        const result = await generateText({
          model: resolvedModel,
          system: systemPrompt,
          messages,
          ...(options.temperature != null && { temperature: options.temperature }),
          ...(options.maxTokens != null && { maxTokens: options.maxTokens }),
        });

        const usage = result.usage
          ? {
              promptTokens: result.usage.promptTokens || 0,
              completionTokens: result.usage.completionTokens || 0,
              totalTokens: (result.usage.promptTokens || 0) + (result.usage.completionTokens || 0),
            }
          : null;

        return {
          text: result.text,
          usage,
          provider,
          model: modelId,
          didFailover: chainPos > 0,
          latencyMs: Date.now() - startTime,
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCategory = classifyError(error);

        console.error(`[mastra.failover] ${modelKey} attempt ${attempt + 1} failed (${errorCategory}): ${errorMessage}`);

        if (!["rate_limit", "server_error", "timeout", "network_error", "auth_error", "unknown"].includes(errorCategory)) {
          throw error;
        }

        if (attempt === maxRetries) {
          if (chainPos < chain.length - 1) {
            const next = chain[chainPos + 1];
            console.warn(`[mastra.failover] Failing over from ${modelKey} → ${next.provider}/${next.model}`);
          }
          break;
        }

        const backoff = Math.min(baseBackoff * Math.pow(2, attempt), 30_000);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  throw new Error(
    `All models in failover chain exhausted after ${totalAttempts} attempts. ` +
    `Chain: ${chain.map((m) => `${m.provider}/${m.model}`).join(" → ")}`
  );
}

/**
 * Execute an agent with a prompt and return the response.
 *
 * This is the programmatic API for agent execution with automatic failover.
 * For chat UI, prefer `chat.sendMessage` which handles thread management automatically.
 */
export const executeAgent = action({
  args: {
    agentId: v.string(),
    prompt: v.string(),
    threadId: v.optional(v.id("threads")),
    userId: v.optional(v.string()),
    stream: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ExecuteAgentResult> => {
    // Get agent configuration from database
    const agent = await ctx.runQuery(api.agents.get, { id: args.agentId });

    if (!agent) {
      throw new Error(`Agent ${args.agentId} not found`);
    }

    // Create or get thread
    let threadId = args.threadId;
    if (!threadId) {
      threadId = await ctx.runMutation(api.threads.create, {
        agentId: args.agentId,
        userId: args.userId,
      });
    }

    // Add user message to thread
    await ctx.runMutation(api.messages.add, {
      threadId,
      role: "user",
      content: args.prompt,
    });

    // Create session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await ctx.runMutation(api.sessions.create, {
      sessionId,
      threadId,
      agentId: args.agentId,
      userId: args.userId,
      channel: "api",
    });

    try {
      // Build failover chain from agent config
      const failoverChain = buildFailoverChain(agent as {
        provider?: string;
        model?: string;
        failoverModels?: Array<{ provider: string; model: string }>;
      });

      // Get conversation history for context
      const messages = await ctx.runQuery(api.messages.list, { threadId });
      const conversationMessages = (messages as Array<{ role: string; content: string }>)
        .slice(-20)
        .map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));

      // Execute with failover
      const result = await executeWithFailover(
        failoverChain,
        agent.instructions || "You are a helpful AI assistant.",
        conversationMessages,
        {
          temperature: agent.temperature ?? undefined,
          maxTokens: agent.maxTokens ?? undefined,
        }
      );

      // Add assistant message to thread
      await ctx.runMutation(api.messages.add, {
        threadId,
        role: "assistant",
        content: result.text,
      });

      // Update session status
      await ctx.runMutation(api.sessions.updateStatus, {
        sessionId,
        status: "completed",
      });

      // Record usage
      if (result.usage) {
        await ctx.runMutation(api.usage.record, {
          agentId: args.agentId,
          sessionId,
          provider: result.provider,
          model: result.model,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          userId: args.userId,
        });
      }

      return {
        success: true,
        threadId: threadId as string,
        sessionId,
        response: result.text,
        usage: result.usage ?? undefined,
        provider: result.provider,
        model: result.model,
        didFailover: result.didFailover,
        latencyMs: result.latencyMs,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Update session status to error
      await ctx.runMutation(api.sessions.updateStatus, {
        sessionId,
        status: "error",
      });

      // Add error message to thread
      await ctx.runMutation(api.messages.add, {
        threadId,
        role: "assistant",
        content: `Error: ${errorMessage}`,
      });

      // Log the error
      await ctx.runMutation(api.logs.add, {
        level: "error",
        source: "mastraIntegration",
        message: `Agent execution failed: ${errorMessage}`,
        metadata: {
          agentId: args.agentId,
          threadId,
          sessionId,
        },
        userId: args.userId,
      });

      throw error;
    }
  },
});

/**
 * Stream agent response (placeholder — streaming requires SSE/WebSocket).
 *
 * For now, this falls back to non-streaming execution with failover.
 * Full streaming support will be added via Convex HTTP actions + SSE.
 */
export const streamAgent = action({
  args: {
    agentId: v.string(),
    prompt: v.string(),
    threadId: v.id("threads"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    // Fall back to non-streaming execution
    const result = await ctx.runAction(api.mastraIntegration.executeAgent, {
      agentId: args.agentId,
      prompt: args.prompt,
      threadId: args.threadId,
      userId: args.userId,
    });

    return {
      success: result.success,
      message: result.response,
    };
  },
});

/**
 * Execute workflow with multiple agents (placeholder).
 */
export const executeWorkflow = action({
  args: {
    workflowId: v.string(),
    input: v.any(),
    userId: v.optional(v.string()),
  },
  handler: async (_ctx, _args): Promise<{ success: boolean; message: string }> => {
    return {
      success: true,
      message: "Workflow execution coming soon",
    };
  },
});

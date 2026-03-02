"use node";

/**
 * Chat Actions for AgentForge
 *
 * This module provides the core chat execution pipeline with multi-provider
 * failover support:
 * 1. User sends a message → stored via mutation
 * 2. Convex action builds a failover chain from agent config
 * 3. Primary provider is tried first; on failure, automatic failover to next
 * 4. Assistant response stored back in Convex with provider/cost metadata
 * 5. Real-time subscription updates the UI automatically
 *
 * NOTE: Queries and mutations are in chatMutations.ts (non-Node runtime).
 * This file only contains actions that run in Node.js runtime.
 *
 * Supports: OpenRouter, OpenAI, Anthropic, Google Gemini, Custom.
 * Failover is configured per-agent via `failoverModels` field or falls back
 * to a global default chain.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Agent } from "./lib/agent";

// ============================================================
// Default Failover Chain Configuration
// ============================================================

/**
 * Global default failover chain used when an agent has no per-agent config.
 * Priority: OpenRouter → OpenAI → Anthropic → Google Gemini
 */
const DEFAULT_FAILOVER_CHAIN = [
  { provider: "openrouter", model: "openai/gpt-4o-mini" },
  { provider: "openai", model: "gpt-4o-mini" },
  { provider: "anthropic", model: "claude-3-5-haiku-20241022" },
  { provider: "google", model: "gemini-2.0-flash" },
];

/**
 * Build a failover chain configuration from an agent record.
 *
 * If the agent has `failoverModels` configured, those are used as fallbacks
 * after the primary model. Otherwise, the global default chain is used.
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
      // Skip if same as primary
      if (fm.provider === chain[0].provider && fm.model === chain[0].model) continue;
      chain.push(fm);
    }
  } else {
    // Use global defaults (skip any that match the primary)
    for (const dfm of DEFAULT_FAILOVER_CHAIN) {
      if (dfm.provider === chain[0].provider && dfm.model === chain[0].model) continue;
      chain.push(dfm);
    }
  }

  return chain;
}

// ============================================================
// Model Resolution with Failover
// ============================================================

/**
 * Classify an error for failover decision-making.
 */
function classifyError(error: unknown): "rate_limit" | "server_error" | "timeout" | "network_error" | "auth_error" | "unknown" {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("quota exceeded")) {
      return "rate_limit";
    }
    if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.includes("internal server error") || msg.includes("bad gateway") || msg.includes("service unavailable")) {
      return "server_error";
    }
    if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("econnreset") || name.includes("timeout") || name === "aborterror") {
      return "timeout";
    }
    if (msg.includes("enotfound") || msg.includes("econnrefused") || msg.includes("network") || msg.includes("dns") || msg.includes("fetch failed")) {
      return "network_error";
    }
    if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("invalid api key")) {
      return "auth_error";
    }
  }
  return "unknown";
}

/**
 * Determine if an error should trigger failover to the next provider.
 */
function shouldFailover(category: string): boolean {
  return ["rate_limit", "server_error", "timeout", "network_error", "auth_error", "unknown"].includes(category);
}

/**
 * Execute an LLM call with failover across multiple providers.
 *
 * Tries each model in the chain with retry + exponential backoff.
 * Returns the response from the first successful provider.
 */
async function executeWithFailover(
  chain: Array<{ provider: string; model: string }>,
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
  options: { temperature?: number; maxTokens?: number; maxRetries?: number; backoffMs?: number }
): Promise<{
  text: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  provider: string;
  model: string;
  chainPosition: number;
  totalAttempts: number;
  didFailover: boolean;
  failoverEvents: Array<{ from: string; to: string; error: string; category: string }>;
  latencyMs: number;
}> {
  const startTime = Date.now();
  const maxRetries = options.maxRetries ?? 2;
  const baseBackoff = options.backoffMs ?? 1000;
  let totalAttempts = 0;
  const failoverEvents: Array<{ from: string; to: string; error: string; category: string }> = [];

  for (let chainPos = 0; chainPos < chain.length; chainPos++) {
    const { provider, model: modelId } = chain[chainPos];
    const modelKey = `${provider}/${modelId}`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      totalAttempts++;

      try {
        const mastraAgent = new Agent({
          name: "agentforge-executor",
          instructions: systemPrompt,
          model: modelKey,
        });

        const result = await mastraAgent.generate(messages);

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
          chainPosition: chainPos,
          totalAttempts,
          didFailover: chainPos > 0,
          failoverEvents,
          latencyMs: Date.now() - startTime,
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCategory = classifyError(error);

        console.error(`[chat.failover] ${modelKey} attempt ${attempt + 1} failed (${errorCategory}): ${errorMessage}`);

        if (!shouldFailover(errorCategory)) {
          throw error;
        }

        // Last retry for this model — log failover event
        if (attempt === maxRetries) {
          if (chainPos < chain.length - 1) {
            const next = chain[chainPos + 1];
            failoverEvents.push({
              from: modelKey,
              to: `${next.provider}/${next.model}`,
              error: errorMessage,
              category: errorCategory,
            });
            console.warn(`[chat.failover] Failing over from ${modelKey} → ${next.provider}/${next.model}`);
          }
          break;
        }

        // Exponential backoff
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

// ============================================================
// Actions (Node.js runtime — can call external APIs)
// ============================================================

/**
 * Send a message and get an AI response with automatic failover.
 *
 * This is the main chat action. It:
 * 1. Looks up the agent config from the database
 * 2. Stores the user message
 * 3. Builds conversation history from the thread
 * 4. Builds a failover chain from agent config (or global defaults)
 * 5. Executes with automatic failover across providers
 * 6. Stores the assistant response with provider metadata
 * 7. Records usage metrics including cost estimation
 *
 * The UI subscribes to `chat.getThreadMessages` which auto-updates
 * when new messages are inserted.
 */
export const sendMessage = action({
  args: {
    agentId: v.string(),
    threadId: v.id("threads"),
    content: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Get agent configuration
    const agent = await ctx.runQuery(api.agents.get, { id: args.agentId });
    if (!agent) {
      throw new Error(`Agent "${args.agentId}" not found. Please create an agent first.`);
    }

    // 2. Load project settings to apply overrides (if agent belongs to a project)
    let projectSystemPrompt: string | undefined;
    let projectDefaultModel: string | undefined;
    let projectDefaultProvider: string | undefined;

    if (agent.projectId) {
      const project = await ctx.runQuery(api.projects.get, { id: agent.projectId });
      if (project?.settings) {
        const settings = project.settings as {
          systemPrompt?: string;
          defaultModel?: string;
          defaultProvider?: string;
          instructionPrefix?: string;
          defaultTemperature?: number;
          defaultMaxTokens?: number;
        };
        projectSystemPrompt = settings.systemPrompt || settings.instructionPrefix;
        projectDefaultModel = settings.defaultModel;
        projectDefaultProvider = settings.defaultProvider;
      }
    }

    // 2. Store the user message
    await ctx.runMutation(api.chat.addUserMessage, {
      threadId: args.threadId,
      content: args.content,
    });

    // 3. Get conversation history for context
    const history = await ctx.runQuery(api.chat.getThreadMessages, {
      threadId: args.threadId,
    });

    // Build messages array for the LLM (last 20 messages for context window)
    const conversationMessages = history
      .slice(-20)
      .map((msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      }));

    // 4. Build failover chain from agent config (with project overrides)
    const agentWithOverrides = {
      provider: projectDefaultProvider || agent.provider,
      model: projectDefaultModel || agent.model,
      failoverModels: agent.failoverModels,
    };
    const failoverChain = buildFailoverChain(agentWithOverrides as {
      provider?: string;
      model?: string;
      failoverModels?: Array<{ provider: string; model: string }>;
    });

    // 5. Build system prompt with project override (project settings override agent instructions)
    const baseInstructions = agent.instructions || "You are a helpful AI assistant built with AgentForge.";
    const systemPrompt = projectSystemPrompt
      ? `${projectSystemPrompt}\n\n${baseInstructions}`
      : baseInstructions;

    // 6. Execute with failover
    let responseText: string;
    let usageData: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;
    let actualProvider: string = projectDefaultProvider || agent.provider || "openrouter";
    let actualModel: string = projectDefaultModel || agent.model || "unknown";
    let didFailover = false;
    let failoverEvents: Array<{ from: string; to: string; error: string; category: string }> = [];
    let latencyMs = 0;

    try {
      const result = await executeWithFailover(
        failoverChain,
        systemPrompt,
        conversationMessages,
        {
          temperature: agent.temperature ?? undefined,
          maxTokens: agent.maxTokens ?? undefined,
        }
      );

      responseText = result.text;
      usageData = result.usage;
      actualProvider = result.provider;
      actualModel = result.model;
      didFailover = result.didFailover;
      failoverEvents = result.failoverEvents;
      latencyMs = result.latencyMs;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[chat.sendMessage] All providers failed:", errorMessage);

      // Store error as assistant message so user sees feedback
      responseText = `I encountered an error while processing your request: ${errorMessage}`;
    }

    // 7. Store the assistant response with provider metadata
    const metadata: Record<string, unknown> = {};
    if (usageData) {
      metadata.usage = usageData;
    }
    metadata.provider = actualProvider;
    metadata.model = actualModel;
    if (didFailover) {
      metadata.didFailover = true;
      metadata.failoverEvents = failoverEvents;
    }
    metadata.latencyMs = latencyMs;

    await ctx.runMutation(api.chat.addAssistantMessage, {
      threadId: args.threadId,
      content: responseText,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });

    // 8. Record usage metrics (non-blocking, best-effort)
    if (usageData) {
      try {
        // Estimate cost based on provider/model pricing
        const costPerMillion: Record<string, { input: number; output: number }> = {
          "gpt-4.1": { input: 2.0, output: 8.0 },
          "gpt-4.1-mini": { input: 0.4, output: 1.6 },
          "gpt-4o": { input: 2.5, output: 10.0 },
          "gpt-4o-mini": { input: 0.15, output: 0.6 },
          "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
          "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
          "claude-3-5-haiku-20241022": { input: 0.8, output: 4.0 },
          "gemini-2.5-flash": { input: 0.15, output: 0.6 },
          "gemini-2.0-flash": { input: 0.1, output: 0.4 },
        };

        // Strip provider prefix for cost lookup
        const modelKey = actualModel.includes("/") ? actualModel.split("/").pop()! : actualModel;
        const pricing = costPerMillion[modelKey] || { input: 1.0, output: 2.0 };
        const estimatedCost =
          (usageData.promptTokens / 1_000_000) * pricing.input +
          (usageData.completionTokens / 1_000_000) * pricing.output;

        await ctx.runMutation(api.usage.record, {
          agentId: args.agentId,
          provider: actualProvider,
          model: actualModel,
          promptTokens: usageData.promptTokens,
          completionTokens: usageData.completionTokens,
          totalTokens: usageData.totalTokens,
          cost: estimatedCost,
          userId: args.userId,
        });
      } catch (e) {
        console.error("[chat.sendMessage] Usage recording failed:", e);
      }
    }

    // 9. Log the interaction
    try {
      await ctx.runMutation(api.logs.add, {
        level: "info",
        source: "chat",
        message: `Agent "${agent.name}" responded via ${actualProvider}/${actualModel}${didFailover ? " (failover)" : ""}`,
        metadata: {
          agentId: args.agentId,
          threadId: args.threadId,
          provider: actualProvider,
          model: actualModel,
          didFailover,
          failoverEvents: failoverEvents.length > 0 ? failoverEvents : undefined,
          latencyMs,
          usage: usageData,
        },
        userId: args.userId,
      });
    } catch (e) {
      console.error("[chat.sendMessage] Logging failed:", e);
    }

    return {
      success: true,
      threadId: args.threadId,
      response: responseText,
      usage: usageData,
      provider: actualProvider,
      model: actualModel,
      didFailover,
      failoverEvents,
      latencyMs,
    };
  },
});

/**
 * Create a new thread and send the first message in one action.
 * Convenience action for starting a new conversation.
 */
export const startNewChat = action({
  args: {
    agentId: v.string(),
    content: v.string(),
    threadName: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Create a new thread
    const threadId = await ctx.runMutation(api.chat.createThread, {
      agentId: args.agentId,
      name: args.threadName || "New Chat",
      userId: args.userId,
    });

    // Send the first message
    const result = await ctx.runAction(api.chat.sendMessage, {
      agentId: args.agentId,
      threadId,
      content: args.content,
      userId: args.userId,
    });

    return {
      ...result,
      threadId,
    };
  },
});

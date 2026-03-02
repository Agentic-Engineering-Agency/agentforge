"use node";

/**
 * Mastra Integration Actions for Convex
 *
 * These actions run in the Convex Node.js runtime and execute LLM calls
 * using Mastra-native model routing with multi-provider failover support.
 *
 * Architecture:
 * - For chat: use `chat.sendMessage` (preferred entry point)
 * - For programmatic agent execution: use `mastraIntegration.executeAgent`
 * - Model resolution: uses Mastra Agent with "provider/model-name" format
 * - Failover chain: primary provider → fallback1 → fallback2 → ...
 *
 * Supported providers: OpenRouter, OpenAI, Anthropic, Google Gemini, Venice, Custom
 */
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Agent } from "./lib/agent";
import { resolveMemoryConfig } from "./lib/memoryConfig";
import { computeCost } from "./lib/costAnalytics";
import { initTracing, recordSpan, sendTraceToOpik } from "./lib/tracing";

// Initialize tracing once at module load — enabled only when OPIK_API_KEY is set
const _tracingConfig = initTracing({
  apiKey: process.env.OPIK_API_KEY,
  projectName: process.env.OPIK_PROJECT_NAME ?? "agentforge",
});

// ---------------------------------------------------------------------------
// Agent instance cache
// ---------------------------------------------------------------------------

const MAX_CACHE_SIZE = 100;
const agentCache = new Map<string, Agent>();

/**
 * Get or create a cached Agent instance.
 * Key is derived from the model string and the first 100 chars of the system prompt
 * so agents with different instructions are not conflated.
 */
function getCachedAgent(modelKey: string, systemPrompt: string): Agent {
  const cacheKey = `${modelKey}::${systemPrompt.slice(0, 100)}`;

  if (agentCache.has(cacheKey)) {
    return agentCache.get(cacheKey)!;
  }

  // Evict oldest entry when at capacity
  if (agentCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = agentCache.keys().next().value;
    if (oldestKey !== undefined) {
      agentCache.delete(oldestKey);
    }
  }

  const agent = new Agent({
    name: "agentforge-executor",
    instructions: systemPrompt,
    model: modelKey,
  });

  agentCache.set(cacheKey, agent);
  return agent;
}

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
        const mastraAgent = getCachedAgent(modelKey, systemPrompt);

        const generateOptions: Record<string, unknown> = {};
        if (options.temperature !== undefined) generateOptions.temperature = options.temperature;
        if (options.maxTokens !== undefined) generateOptions.maxTokens = options.maxTokens;

        const result = await mastraAgent.generate(messages, generateOptions);

        const usage = result.usage
          ? {
              promptTokens: result.usage.promptTokens || 0,
              completionTokens: result.usage.completionTokens || 0,
              totalTokens: (result.usage.promptTokens || 0) + (result.usage.completionTokens || 0),
            }
          : null;

        const latencyMs = Date.now() - startTime;

        // Fire-and-forget tracing — never blocks the response, never throws
        const span = recordSpan({
          name: "llm-call",
          model: modelKey,
          inputTokens: usage?.promptTokens,
          outputTokens: usage?.completionTokens,
          latencyMs,
          metadata: {
            provider,
            didFailover: chainPos > 0,
            totalAttempts,
          },
        });
        sendTraceToOpik(span, _tracingConfig).catch(() => {});

        return {
          text: result.text,
          usage,
          provider,
          model: modelId,
          didFailover: chainPos > 0,
          latencyMs,
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

    // Resolve memory configuration from agent tools/metadata
    const memoryConfig = resolveMemoryConfig(
      agent?.tools as Record<string, unknown> | undefined
    );

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
      // Recall relevant memories if memory is enabled
      let memoryContext = "";
      if (memoryConfig.enabled) {
        try {
          // Dynamic import to avoid loading when not needed
          const { hybridSearch } = await import("./lib/memorySearch");
          const memories = await hybridSearch(ctx, {
            query: args.prompt,
            agentId: args.agentId,
            projectId: agent?.projectId ? (agent.projectId as string) : undefined,
            limit: memoryConfig.maxRecallItems,
          });

          if (memories.length > 0) {
            memoryContext =
              "\n\n## Relevant Memories\n" +
              memories
                .filter((m) => m._score >= memoryConfig.recallThreshold)
                .map((m, i) => `${i + 1}. [${m.type}] ${m.content}`)
                .join("\n");
          }
        } catch (error) {
          console.warn("[memory] Recall failed, continuing without memories:", error);
        }
      }

      // Build system prompt with optional memory context
      const systemPrompt =
        (agent.instructions || "You are a helpful AI assistant.") + memoryContext;

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
        systemPrompt,
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

      // Store interaction as memory if enabled
      if (memoryConfig.enabled && memoryConfig.autoStore) {
        try {
          const interactionText = `User: ${args.prompt}\nAssistant: ${result.text}`;
          await ctx.runMutation(api.memory.add, {
            content: interactionText,
            type: "conversation",
            agentId: args.agentId,
            threadId: threadId,
            projectId: agent?.projectId,
            userId: args.userId,
            importance: 0.5,
          });
        } catch (error) {
          console.warn("[memory] Failed to store interaction:", error);
        }
      }

      // Update session status
      await ctx.runMutation(api.sessions.updateStatus, {
        sessionId,
        status: "completed",
      });

      // Record usage
      if (result.usage) {
        const modelKey = `${result.provider}/${result.model}`;
        const cost = computeCost(modelKey, result.usage.promptTokens, result.usage.completionTokens);

        await ctx.runMutation(api.usage.record, {
          agentId: args.agentId,
          sessionId,
          provider: result.provider,
          model: result.model,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          userId: args.userId,
          cost,
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
 * Execute a workflow definition stored in Convex.
 *
 * Fetches the workflow definition, creates a run record, delegates execution
 * to the workflow engine, and persists the final status back to Convex.
 */
export const executeWorkflow = action({
  args: {
    workflowId: v.id("workflowDefinitions"),
    input: v.optional(v.any()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    // 1. Fetch workflow definition
    const definition = await ctx.runQuery(api.workflows.get, { id: args.workflowId });
    if (!definition) {
      return { success: false, message: "Workflow not found" };
    }

    // 2. Create run record
    const runId = await ctx.runMutation(api.workflows.createRun, {
      workflowId: args.workflowId,
      input: args.input ? JSON.stringify(args.input) : undefined,
      projectId: definition.projectId,
      userId: args.userId,
    });

    try {
      // 3. Parse steps and execute via workflow engine
      const { parseWorkflowDefinition, executeWorkflow: runWorkflow } = await import("./lib/workflowEngine");

      const steps = parseWorkflowDefinition(definition.steps);
      const workflowData = {
        id: definition._id,
        name: definition.name,
        description: definition.description,
        steps,
      };

      const result = await runWorkflow(workflowData, (args.input as Record<string, unknown>) || {});

      // 4. Persist run result
      await ctx.runMutation(api.workflows.updateRun, {
        id: runId,
        status: result.status,
        output: result.output ? JSON.stringify(result.output) : undefined,
        error: result.error,
        completedAt: result.status !== "suspended" ? Date.now() : undefined,
        ...(result.suspendedAtStep ? { suspendedAt: result.suspendedAtStep } : {}),
        ...(result.suspendPayload
          ? { suspendPayload: JSON.stringify(result.suspendPayload) }
          : {}),
      });

      return {
        success: result.success,
        message:
          result.status === "completed"
            ? "Workflow completed successfully"
            : result.error || result.status,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";

      await ctx.runMutation(api.workflows.updateRun, {
        id: runId,
        status: "failed",
        error: errorMsg,
        completedAt: Date.now(),
      });

      return { success: false, message: errorMsg };
    }
  },
});

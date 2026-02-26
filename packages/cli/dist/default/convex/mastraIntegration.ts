"use node";

/**
 * Mastra Integration Actions for Convex
 *
 * These actions run in the Convex Node.js runtime and execute LLM calls
 * using Mastra with BYOK (Bring Your Own Key) from the Convex database.
 *
 * Architecture:
 * - For chat: use `chat.sendMessage` (preferred entry point)
 * - For programmatic agent execution: use `mastraIntegration.executeAgent`
 * - Model resolution: fetches API keys from database, creates Mastra model config
 *
 * AGE-137: API keys are stored in Convex 'apiKeys' table and fetched at inference time.
 * AGE-141: MCP connections are queried and tool context is injected into agent instructions.
 *
 * Fix (v0.10.0): Use OpenAICompatibleConfig { providerId, modelId, apiKey } instead of
 * process.env injection + magic model string. This avoids:
 *   1. "openai/gpt-4.1 does not exist" — Mastra 1.8.0 passes the full string to the API
 *      instead of stripping the provider prefix.
 *   2. "openrouter/openrouter/auto" — double prefix when model already contains provider.
 */
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Agent } from "@mastra/core/agent";
import type { MessageListInput } from "@mastra/core/agent/message-list";

/**
 * Strip provider prefix from modelId to prevent double-prefixing.
 * e.g. provider="openrouter", modelId="openrouter/auto" → "auto"
 *      provider="openai",     modelId="gpt-4.1"          → "gpt-4.1" (no change)
 */
function getBaseModelId(provider: string, modelId: string): string {
  const prefix = `${provider}/`;
  return modelId.startsWith(prefix) ? modelId.slice(prefix.length) : modelId;
}

/**
 * Return custom base URL for providers that aren't natively supported by Mastra.
 * Standard providers (openai, anthropic, google) use their built-in defaults.
 */
function getProviderBaseUrl(provider: string): string | undefined {
  const urls: Record<string, string> = {
    openrouter: "https://openrouter.ai/api/v1",
    mistral:    "https://api.mistral.ai/v1",
    deepseek:   "https://api.deepseek.com",
    xai:        "https://api.x.ai/v1",
    cohere:     "https://api.cohere.ai/v1",
  };
  return urls[provider];
}

/**
 * Build the Mastra OpenAICompatibleConfig for BYOK.
 * Using { providerId, modelId, apiKey } bypasses Mastra's magic-string router
 * so the exact modelId is passed to the API (no provider prefix collision).
 */
function buildModelConfig(
  provider: string,
  modelId: string,
  apiKey: string
): { providerId: string; modelId: string; apiKey: string; url?: string } {
  const baseModelId = getBaseModelId(provider, modelId);
  const baseUrl = getProviderBaseUrl(provider);
  return {
    providerId: provider,
    modelId: baseModelId,
    apiKey,
    ...(baseUrl ? { url: baseUrl } : {}),
  };
}

/**
 * Build MCP tool context string from active connections.
 *
 * AGE-141: Queries active MCP connections and builds a context string
 * that informs the agent about available MCP tools.
 */
function buildMcpToolContext(
  connections: Array<{ name: string; capabilities?: string[] }>
): string {
  if (connections.length === 0) return "";
  const toolsList = connections
    .map((c) => `${c.name} (${(c.capabilities || []).join(", ")})`)
    .join(", ");
  return `You have access to these MCP tools: ${toolsList}. Use them when relevant.`;
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
};

/**
 * Execute an agent with a prompt and return the response.
 *
 * This is the programmatic API for agent execution. For chat UI,
 * prefer `chat.sendMessage` which handles thread management automatically.
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
    if (!agent) throw new Error(`Agent ${args.agentId} not found`);

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
      const provider = agent.provider || "openrouter";
      const modelId  = agent.model   || "auto";

      // AGE-137: Fetch API key from database for BYOK
      const apiKey = await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, { provider });
      if (!apiKey) {
        throw new Error(
          `No active API key found for provider: ${provider}. Please add an API key in Settings.`
        );
      }

      // AGE-141: Query active MCP connections for tool context
      const mcpConnections = await ctx.runQuery(api.mcpConnections.list, { isEnabled: true });
      const mcpToolContext = buildMcpToolContext(
        mcpConnections as Array<{ name: string; capabilities?: string[] }>
      );

      // Get conversation history for context
      const messages = await ctx.runQuery(api.messages.list, { threadId });
      const conversationMessages = (messages as Array<{ role: string; content: string }>)
        .slice(-20)
        .map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content }));

      // Build full instructions with MCP tool context
      const baseInstructions = agent.instructions || "You are a helpful AI assistant.";
      const fullInstructions = mcpToolContext
        ? `${baseInstructions}\n\n${mcpToolContext}`
        : baseInstructions;

      // Build model config using OpenAICompatibleConfig (avoids magic-string bugs)
      const modelConfig = buildModelConfig(provider, modelId, apiKey);

      // Execute via Mastra Agent
      const mastraAgent = new Agent({
        id: "agentforge-executor",
        name: "agentforge-executor",
        instructions: fullInstructions,
        model: modelConfig,
      });

      const result = await mastraAgent.generate(
        conversationMessages as unknown as MessageListInput
      );

      const responseContent = result.text;

      // Persist assistant response
      await ctx.runMutation(api.messages.add, {
        threadId,
        role: "assistant",
        content: responseContent,
      });
      await ctx.runMutation(api.sessions.updateStatus, { sessionId, status: "completed" });

      // Build usage data (AI SDK v5: inputTokens/outputTokens)
      const usage = result.usage
        ? {
            promptTokens:     result.usage.inputTokens    ?? 0,
            completionTokens: result.usage.outputTokens   ?? 0,
            totalTokens:
              (result.usage.inputTokens  ?? 0) +
              (result.usage.outputTokens ?? 0),
          }
        : undefined;

      if (usage) {
        await ctx.runMutation(api.usage.record, {
          agentId: args.agentId,
          sessionId,
          provider: agent.provider || "openrouter",
          model:    agent.model    || "unknown",
          promptTokens:     usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens:      usage.totalTokens,
          userId: args.userId,
        });
      }

      return { success: true, threadId: threadId as string, sessionId, response: responseContent, usage };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await ctx.runMutation(api.sessions.updateStatus, { sessionId, status: "error" });
      await ctx.runMutation(api.messages.add, {
        threadId,
        role: "assistant",
        content: `I encountered an error while processing your request: ${errorMessage}`,
      });
      await ctx.runMutation(api.logs.add, {
        level: "error",
        source: "mastraIntegration",
        message: `Agent execution failed: ${errorMessage}`,
        metadata: { agentId: args.agentId, threadId, sessionId },
        userId: args.userId,
      });

      throw error;
    }
  },
});

/**
 * Stream agent response (placeholder — streaming requires SSE/WebSocket).
 * Falls back to non-streaming execution.
 */
export const streamAgent = action({
  args: {
    agentId: v.string(),
    prompt: v.string(),
    threadId: v.id("threads"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const result = await ctx.runAction(api.mastraIntegration.executeAgent, {
      agentId:  args.agentId,
      prompt:   args.prompt,
      threadId: args.threadId,
      userId:   args.userId,
    });
    return { success: result.success, message: result.response };
  },
});

/**
 * Execute workflow with multiple agents (placeholder).
 */
export const executeWorkflow = action({
  args: {
    workflowId: v.string(),
    input:      v.any(),
    userId:     v.optional(v.string()),
  },
  handler: async (_ctx, _args): Promise<{ success: boolean; message: string }> => {
    return { success: true, message: "Workflow execution coming soon" };
  },
});

/**
 * Thin LLM wrapper used by chat.sendMessage.
 *
 * AGE-137: BYOK — fetches API key from DB and uses OpenAICompatibleConfig.
 * AGE-141: MCP tool context injected into instructions.
 *
 * This action lives in Node.js runtime so chat.ts can stay in default runtime
 * and freely mix queries, mutations, and actions.
 */
export const generateResponse = internalAction({
  args: {
    provider: v.string(),
    modelKey:     v.string(),
    instructions: v.string(),
    messages: v.array(v.object({ role: v.string(), content: v.string() })),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    text: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    } | null;
  }> => {
    // AGE-137: Fetch API key from database
    const apiKey = await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, {
      provider: args.provider,
    });
    if (!apiKey) {
      throw new Error(
        `No active API key found for provider: ${args.provider}. Please add an API key in Settings.`
      );
    }

    // AGE-141: MCP tool context
    const mcpConnections = await ctx.runQuery(api.mcpConnections.list, { isEnabled: true });
    const mcpToolContext = buildMcpToolContext(
      mcpConnections as Array<{ name: string; capabilities?: string[] }>
    );
    const fullInstructions = mcpToolContext
      ? `${args.instructions}\n\n${mcpToolContext}`
      : args.instructions;

    // Build model config using OpenAICompatibleConfig (fixes model ID format)
    const modelConfig = buildModelConfig(args.provider, args.modelKey, apiKey);

    const mastraAgent = new Agent({
      id:           "agentforge-executor",
      name:         "agentforge-executor",
      instructions: fullInstructions,
      model:        modelConfig,
    });

    const result = await mastraAgent.generate(
      args.messages as unknown as MessageListInput
    );

    return {
      text: result.text,
      usage: result.usage
        ? {
            promptTokens:     result.usage.inputTokens    ?? 0,
            completionTokens: result.usage.outputTokens   ?? 0,
            totalTokens:
              (result.usage.inputTokens  ?? 0) +
              (result.usage.outputTokens ?? 0),
          }
        : null,
    };
  },
});

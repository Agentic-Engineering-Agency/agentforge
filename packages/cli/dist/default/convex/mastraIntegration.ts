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
 * - Model resolution: fetches API keys from database, creates AI SDK model instances
 *
 * AGE-137: API keys are stored in Convex 'apiKeys' table and fetched at inference time
 * instead of relying on process.env which doesn't exist in Convex Node.js runtime.
 *
 * AGE-141: MCP connections are queried and tool context is injected into agent instructions.
 */
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Agent } from "@mastra/core/agent";

// AI SDK factory functions for BYOK (Bring Your Own Key)
// These allow us to pass API keys directly instead of relying on process.env
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";

/**
 * Create an AI SDK model instance with the provided API key (BYOK).
 *
 * This function maps provider names to their AI SDK factory functions,
 * allowing us to pass API keys directly instead of relying on process.env.
 *
 * @param provider - The LLM provider (e.g., 'openai', 'anthropic', 'google')
 * @param apiKey - The API key fetched from the database
 * @param modelId - The model identifier (e.g., 'gpt-4o-mini', 'claude-opus-4-6')
 * @returns An AI SDK LanguageModel instance
 */
function createModelWithApiKey(provider: string, apiKey: string, modelId: string) {
  // Strip provider prefix if present (e.g., "openai/gpt-4o" -> "gpt-4o")
  const baseModelId = modelId.includes("/") ? modelId.split("/").slice(1).join("/") : modelId;

  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(baseModelId);
    case "anthropic":
      return createAnthropic({ apiKey })(baseModelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(baseModelId);
    case "xai":
      return createXai({ apiKey })(baseModelId);
    case "mistral":
      return createOpenAI({ apiKey, baseURL: "https://api.mistral.ai/v1" })(baseModelId);
    case "deepseek":
      return createOpenAI({ apiKey, baseURL: "https://api.deepseek.com" })(baseModelId);
    case "openrouter":
      return createOpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" })(baseModelId);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Build MCP tool context string from active connections.
 *
 * AGE-141: Queries active MCP connections and builds a context string
 * that informs the agent about available MCP tools.
 *
 * @param connections - Array of active MCP connections
 * @returns A string describing available MCP tools, or empty string if none
 */
function buildMcpToolContext(
  connections: Array<{ name: string; capabilities?: string[] }>
): string {
  if (connections.length === 0) {
    return "";
  }

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
      // Resolve the model
      const provider = agent.provider || "openrouter";
      const modelId = agent.model || "openai/gpt-4o-mini";
      const modelKey = `${provider}/${modelId}`;

      // AGE-137: Fetch API key from database for BYOK
      const apiKey = await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, { provider });
      if (!apiKey) {
        throw new Error(`No active API key found for provider: ${provider}. Please add an API key in Settings.`);
      }

      // Create AI SDK model instance with fetched API key
      const resolvedModel = createModelWithApiKey(provider, apiKey, modelId);

      // AGE-141: Query active MCP connections for tool context
      const mcpConnections = await ctx.runQuery(api.mcpConnections.list, { isEnabled: true });
      const mcpToolContext = buildMcpToolContext(mcpConnections as Array<{ name: string; capabilities?: string[] }>);

      // Get conversation history for context
      const messages = await ctx.runQuery(api.messages.list, { threadId });
      const conversationMessages = (messages as Array<{ role: string; content: string }>)
        .slice(-20)
        .map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));

      // Build full instructions with MCP tool context
      const baseInstructions = agent.instructions || "You are a helpful AI assistant.";
      const fullInstructions = mcpToolContext
        ? `${baseInstructions}\n\n${mcpToolContext}`
        : baseInstructions;

      // Execute via Mastra Agent with resolved model
      const mastraAgent = new Agent({
        id: "agentforge-executor",
        name: "agentforge-executor",
        instructions: fullInstructions,
        model: resolvedModel,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await mastraAgent.generate(conversationMessages as any);

      const responseContent = result.text;

      // Add assistant message to thread
      await ctx.runMutation(api.messages.add, {
        threadId,
        role: "assistant",
        content: responseContent,
      });

      // Update session status
      await ctx.runMutation(api.sessions.updateStatus, {
        sessionId,
        status: "completed",
      });

      // Build usage data (AI SDK v5: inputTokens/outputTokens)
      const usage = result.usage
        ? {
            promptTokens: result.usage.inputTokens ?? 0,
            completionTokens: result.usage.outputTokens ?? 0,
            totalTokens:
              (result.usage.inputTokens ?? 0) +
              (result.usage.outputTokens ?? 0),
          }
        : undefined;

      // Record usage
      if (usage) {
        await ctx.runMutation(api.usage.record, {
          agentId: args.agentId,
          sessionId,
          provider: agent.provider || "openrouter",
          model: agent.model || "unknown",
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          userId: args.userId,
        });
      }

      return {
        success: true,
        threadId: threadId as string,
        sessionId,
        response: responseContent,
        usage,
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
 * For now, this falls back to non-streaming execution.
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

/**
 * Thin LLM wrapper used by chat.sendMessage.
 *
 * AGE-137: Now accepts provider argument for BYOK (Bring Your Own Key).
 * Fetches the API key from the database and creates a model instance with it.
 *
 * Accepts a provider, modelKey, system instructions, and conversation messages.
 * Returns the generated text and token usage. No message storage — callers
 * handle persistence themselves.
 *
 * This action lives here (Node.js runtime) so that chat.ts can remain in the
 * default Convex runtime and freely mix queries, mutations, and actions.
 */
export const generateResponse = action({
  args: {
    provider: v.string(), // AGE-137: Added provider argument
    modelKey: v.string(),
    instructions: v.string(),
    messages: v.array(
      v.object({ role: v.string(), content: v.string() })
    ),
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
    // AGE-137: Fetch API key from database for BYOK
    const apiKey = await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, { provider: args.provider });
    if (!apiKey) {
      throw new Error(`No active API key found for provider: ${args.provider}. Please add an API key in Settings.`);
    }

    // Create AI SDK model instance with fetched API key
    const resolvedModel = createModelWithApiKey(args.provider, apiKey, args.modelKey);

    // AGE-141: Query active MCP connections for tool context
    const mcpConnections = await ctx.runQuery(api.mcpConnections.list, { isEnabled: true });
    const mcpToolContext = buildMcpToolContext(mcpConnections as Array<{ name: string; capabilities?: string[] }>);

    // Build full instructions with MCP tool context
    const fullInstructions = mcpToolContext
      ? `${args.instructions}\n\n${mcpToolContext}`
      : args.instructions;

    const mastraAgent = new Agent({
      id: "agentforge-executor",
      name: "agentforge-executor",
      instructions: fullInstructions,
      model: resolvedModel,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await mastraAgent.generate(args.messages as any);

    // AI SDK v5 renamed promptTokens→inputTokens, completionTokens→outputTokens
    return {
      text: result.text,
      usage: result.usage
        ? {
            promptTokens: result.usage.inputTokens ?? 0,
            completionTokens: result.usage.outputTokens ?? 0,
            totalTokens:
              (result.usage.inputTokens ?? 0) +
              (result.usage.outputTokens ?? 0),
          }
        : null,
    };
  },
});

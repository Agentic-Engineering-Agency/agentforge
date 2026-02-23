/**
 * Mastra Integration Actions for Convex
 *
 * These actions run in the Convex Node.js runtime and execute LLM calls
 * using Mastra-native model routing with OpenRouter as the default provider.
 *
 * Architecture:
 * - For chat: use `chat.sendMessage` (preferred entry point)
 * - For programmatic agent execution: use `mastraIntegration.executeAgent`
 * - Model resolution: uses Mastra Agent with "provider/model-name" format
 */
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Agent } from "@mastra/core/agent";

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

      // Get conversation history for context
      const messages = await ctx.runQuery(api.messages.list, { threadId });
      const conversationMessages = (messages as Array<{ role: string; content: string }>)
        .slice(-20)
        .map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));

      // Execute via Mastra Agent
      const mastraAgent = new Agent({
        name: "agentforge-executor",
        instructions: agent.instructions || "You are a helpful AI assistant.",
        model: modelKey,
      });

      const result = await mastraAgent.generate(conversationMessages);

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

      // Build usage data
      const usage = result.usage
        ? {
            promptTokens: result.usage.promptTokens || 0,
            completionTokens: result.usage.completionTokens || 0,
            totalTokens:
              (result.usage.promptTokens || 0) +
              (result.usage.completionTokens || 0),
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

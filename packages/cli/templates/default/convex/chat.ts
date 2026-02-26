/**
 * Chat Actions for AgentForge
 *
 * This module provides the core chat execution pipeline:
 * 1. User sends a message → stored via mutation
 * 2. Convex action triggers LLM generation via Mastra Agent
 * 3. Assistant response stored back in Convex
 * 4. Real-time subscription updates the UI automatically
 *
 * LLM calls are delegated to mastraIntegration.generateResponse (Node.js runtime).
 * This file runs in the default Convex runtime and can contain queries,
 * mutations, and actions.
 */
import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Explicit return type shared by sendMessage and startNewChat.
// Required to break circular type inference when Convex actions in the same
// file call each other through the generated `api` object (TS7022/TS7023).
type UsageData = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} | null;

type SendMessageResult = {
  success: boolean;
  threadId: Id<"threads">;
  response: string;
  usage: UsageData;
};

// ============================================================
// Queries
// ============================================================

/**
 * Get the current chat state for a thread: messages + thread metadata.
 */
export const getThreadMessages = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("byThread", (q) => q.eq("threadId", args.threadId))
      .collect();
    return messages;
  },
});

/**
 * List all threads for a user, ordered by most recent activity.
 */
export const listThreads = query({
  args: {
    userId: v.optional(v.string()),
    agentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let threads;
    if (args.agentId) {
      threads = await ctx.db
        .query("threads")
        .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
        .collect();
    } else if (args.userId) {
      threads = await ctx.db
        .query("threads")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    } else {
      threads = await ctx.db.query("threads").collect();
    }
    // Sort by most recently updated
    return threads.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// ============================================================
// Mutations
// ============================================================

/**
 * Create a new chat thread for an agent.
 */
export const createThread = mutation({
  args: {
    agentId: v.string(),
    name: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const threadId = await ctx.db.insert("threads", {
      name: args.name || "New Chat",
      agentId: args.agentId,
      userId: args.userId,
      createdAt: now,
      updatedAt: now,
    });
    return threadId;
  },
});

/**
 * Store a user message in a thread (called before triggering LLM).
 */
export const addUserMessage = mutation({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: "user",
      content: args.content,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.threadId, { updatedAt: Date.now() });
    return messageId;
  },
});

/**
 * Store an assistant message in a thread (called after LLM responds).
 */
export const addAssistantMessage = mutation({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: "assistant",
      content: args.content,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.threadId, { updatedAt: Date.now() });
    return messageId;
  },
});

// ============================================================
// Actions (Node.js runtime — can call external APIs)
// ============================================================

/**
 * Send a message and get an AI response.
 *
 * This is the main chat action. It:
 * 1. Looks up the agent config from the database
 * 2. Stores the user message
 * 3. Builds conversation history from the thread
 * 4. Calls the provider via Mastra Agent.generate()
 * 5. Stores the assistant response
 * 6. Records usage metrics
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
  handler: async (ctx, args): Promise<SendMessageResult> => {
    // 1. Get agent configuration
    const agent = await ctx.runQuery(api.agents.get, { id: args.agentId });
    if (!agent) {
      throw new Error(`Agent "${args.agentId}" not found. Please create an agent first.`);
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

    // 4. Call the LLM via mastraIntegration.generateResponse (Node.js action)
    let responseText: string;
    let usageData: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;

    try {
      const provider = agent.provider || "openrouter";
      const modelId = agent.model || "openai/gpt-4o-mini";

      const result = await ctx.runAction(api.mastraIntegration.generateResponse, {
        provider, // AGE-137: Pass provider for BYOK
        modelKey: `${provider}/${modelId}`,
        instructions: agent.instructions || "You are a helpful AI assistant built with AgentForge.",
        messages: conversationMessages,
      });

      responseText = result.text;
      usageData = result.usage ?? null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[chat.sendMessage] Mastra error:", errorMessage);

      // Store error as assistant message so user sees feedback
      responseText = `I encountered an error while processing your request: ${errorMessage}`;
    }

    // 5. Store the assistant response
    await ctx.runMutation(api.chat.addAssistantMessage, {
      threadId: args.threadId,
      content: responseText,
      metadata: usageData ? { usage: usageData } : undefined,
    });

    // 6. Record usage metrics (non-blocking, best-effort)
    if (usageData) {
      try {
        await ctx.runMutation(api.usage.record, {
          agentId: args.agentId,
          provider: agent.provider || "openrouter",
          model: agent.model || "unknown",
          promptTokens: usageData.promptTokens,
          completionTokens: usageData.completionTokens,
          totalTokens: usageData.totalTokens,
          userId: args.userId,
        });
      } catch (e) {
        console.error("[chat.sendMessage] Usage recording failed:", e);
      }
    }

    // 7. Log the interaction
    try {
      await ctx.runMutation(api.logs.add, {
        level: "info",
        source: "chat",
        message: `Agent "${agent.name}" responded to user message`,
        metadata: {
          agentId: args.agentId,
          threadId: args.threadId,
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
  handler: async (ctx, args): Promise<SendMessageResult> => {
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

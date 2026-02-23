import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * HEARTBEAT System
 * 
 * Similar to OpenClaw's HEARTBEAT.md, this system allows agents to:
 * 1. Check on ongoing conversations
 * 2. Continue unfinished tasks
 * 3. Perform scheduled tasks
 * 4. Maintain context across sessions
 * 
 * The heartbeat table stores the current state of each agent's awareness
 * of ongoing tasks, pending actions, and conversation context.
 */

// Add heartbeat table to schema (this will need to be added to schema.ts)
// heartbeats: defineTable({
//   agentId: v.string(),
//   threadId: v.optional(v.id("threads")),
//   status: v.string(), // "active", "waiting", "completed", "error"
//   currentTask: v.optional(v.string()),
//   pendingTasks: v.array(v.string()),
//   context: v.string(), // Markdown-formatted context
//   lastCheck: v.number(),
//   nextCheck: v.number(),
//   metadata: v.optional(v.any()),
// })

// Query: Get heartbeat for an agent
export const get = query({
  args: {
    agentId: v.string(),
    threadId: v.optional(v.id("threads")),
  },
  handler: async (ctx, args) => {
    const heartbeats = await ctx.db
      .query("heartbeats")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
      .collect();
    
    if (args.threadId) {
      return heartbeats.find((h) => h.threadId === args.threadId);
    }
    
    return heartbeats[0]; // Return the most recent one
  },
});

// Query: Get all active heartbeats
export const listActive = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const heartbeats = await ctx.db
      .query("heartbeats")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();
    
    if (args.userId) {
      // Filter by userId if provided
      const userAgents = await ctx.db
        .query("agents")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
      
      const userAgentIds = new Set(userAgents.map((a) => a.id));
      return heartbeats.filter((h) => userAgentIds.has(h.agentId));
    }
    
    return heartbeats;
  },
});

// Query: Get heartbeats due for check
export const getDueForCheck = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const heartbeats = await ctx.db
      .query("heartbeats")
      .withIndex("byNextCheck")
      .collect();
    
    return heartbeats.filter((h) => h.nextCheck <= now && h.status === "active");
  },
});

// Mutation: Create or update heartbeat
export const upsert = mutation({
  args: {
    agentId: v.string(),
    threadId: v.optional(v.id("threads")),
    status: v.string(),
    currentTask: v.optional(v.string()),
    pendingTasks: v.array(v.string()),
    context: v.string(),
    checkIntervalMs: v.optional(v.number()), // How often to check (default: 5 minutes)
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { checkIntervalMs = 5 * 60 * 1000, ...data } = args;
    const now = Date.now();
    
    // Check if heartbeat exists
    const existing = await ctx.db
      .query("heartbeats")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
      .filter((q) =>
        args.threadId
          ? q.eq(q.field("threadId"), args.threadId!)
          : q.eq(q.field("threadId"), undefined)
      )
      .first();
    
    if (existing) {
      // Update existing heartbeat
      await ctx.db.patch(existing._id, {
        ...data,
        lastCheck: now,
        nextCheck: now + checkIntervalMs,
      });
      return existing._id;
    } else {
      // Create new heartbeat
      const heartbeatId = await ctx.db.insert("heartbeats", {
        ...data,
        lastCheck: now,
        nextCheck: now + checkIntervalMs,
      });
      return heartbeatId;
    }
  },
});

// Mutation: Update heartbeat status
export const updateStatus = mutation({
  args: {
    agentId: v.string(),
    threadId: v.optional(v.id("threads")),
    status: v.string(),
    currentTask: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const heartbeat = await ctx.db
      .query("heartbeats")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
      .filter((q) =>
        args.threadId
          ? q.eq(q.field("threadId"), args.threadId!)
          : q.eq(q.field("threadId"), undefined)
      )
      .first();
    
    if (!heartbeat) {
      throw new Error(`Heartbeat not found for agent ${args.agentId}`);
    }
    
    await ctx.db.patch(heartbeat._id, {
      status: args.status,
      currentTask: args.currentTask,
      lastCheck: Date.now(),
    });
    
    return heartbeat._id;
  },
});

// Mutation: Add pending task
export const addPendingTask = mutation({
  args: {
    agentId: v.string(),
    threadId: v.optional(v.id("threads")),
    task: v.string(),
  },
  handler: async (ctx, args) => {
    const heartbeat = await ctx.db
      .query("heartbeats")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
      .filter((q) =>
        args.threadId
          ? q.eq(q.field("threadId"), args.threadId!)
          : q.eq(q.field("threadId"), undefined)
      )
      .first();
    
    if (!heartbeat) {
      throw new Error(`Heartbeat not found for agent ${args.agentId}`);
    }
    
    const updatedTasks = [...heartbeat.pendingTasks, args.task];
    
    await ctx.db.patch(heartbeat._id, {
      pendingTasks: updatedTasks,
    });
    
    return heartbeat._id;
  },
});

// Mutation: Remove pending task
export const removePendingTask = mutation({
  args: {
    agentId: v.string(),
    threadId: v.optional(v.id("threads")),
    task: v.string(),
  },
  handler: async (ctx, args) => {
    const heartbeat = await ctx.db
      .query("heartbeats")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
      .filter((q) =>
        args.threadId
          ? q.eq(q.field("threadId"), args.threadId!)
          : q.eq(q.field("threadId"), undefined)
      )
      .first();
    
    if (!heartbeat) {
      throw new Error(`Heartbeat not found for agent ${args.agentId}`);
    }
    
    const updatedTasks = heartbeat.pendingTasks.filter((t) => t !== args.task);
    
    await ctx.db.patch(heartbeat._id, {
      pendingTasks: updatedTasks,
    });
    
    return heartbeat._id;
  },
});

// Mutation: Update context
export const updateContext = mutation({
  args: {
    agentId: v.string(),
    threadId: v.optional(v.id("threads")),
    context: v.string(),
  },
  handler: async (ctx, args) => {
    const heartbeat = await ctx.db
      .query("heartbeats")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
      .filter((q) =>
        args.threadId
          ? q.eq(q.field("threadId"), args.threadId!)
          : q.eq(q.field("threadId"), undefined)
      )
      .first();
    
    if (!heartbeat) {
      throw new Error(`Heartbeat not found for agent ${args.agentId}`);
    }
    
    await ctx.db.patch(heartbeat._id, {
      context: args.context,
      lastCheck: Date.now(),
    });
    
    return heartbeat._id;
  },
});

// Action: Generate heartbeat context from thread
export const generateContext = action({
  args: {
    agentId: v.string(),
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    // Get thread and messages
    const thread = await ctx.runQuery(api.threads.get, { id: args.threadId });
    const messages = await ctx.runQuery(api.messages.list, {
      threadId: args.threadId,
    });
    
    if (!thread) {
      throw new Error(`Thread ${args.threadId} not found`);
    }
    
    // Generate markdown context
    let context = `# Heartbeat Context\n\n`;
    context += `**Agent ID:** ${args.agentId}\n`;
    context += `**Thread:** ${thread.name || "Unnamed"}\n`;
    context += `**Last Updated:** ${new Date().toISOString()}\n\n`;
    
    context += `## Recent Conversation\n\n`;
    
    // Include last 10 messages
    const recentMessages = messages.slice(-10);
    for (const msg of recentMessages) {
      const timestamp = new Date(msg.createdAt).toLocaleString();
      context += `### ${msg.role.toUpperCase()} (${timestamp})\n`;
      context += `${msg.content}\n\n`;
    }
    
    context += `## Status\n\n`;
    context += `- Total messages: ${messages.length}\n`;
    context += `- Last activity: ${new Date(thread.updatedAt).toLocaleString()}\n`;
    
    return context;
  },
});

// Action: Process heartbeat check
export const processCheck = action({
  args: {
    agentId: v.string(),
    threadId: v.optional(v.id("threads")),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message?: string; pendingTasks?: number; status?: string }> => {
    // Get heartbeat
    const heartbeat = await ctx.runQuery(api.heartbeat.get, {
      agentId: args.agentId,
      threadId: args.threadId,
    }) as { status: string; pendingTasks: string[]; currentTask?: string } | null;
    
    if (!heartbeat) {
      return { success: false, message: "Heartbeat not found" };
    }
    
    // Check if there are pending tasks
    if (heartbeat.pendingTasks.length > 0) {
      // TODO: Integrate with Mastra to execute pending tasks
      // For now, just log
      console.log(`Agent ${args.agentId} has ${heartbeat.pendingTasks.length} pending tasks`);
    }
    
    // Update last check time
    await ctx.runMutation(api.heartbeat.updateStatus, {
      agentId: args.agentId,
      threadId: args.threadId,
      status: heartbeat.status,
      currentTask: heartbeat.currentTask,
    });
    
    return {
      success: true,
      pendingTasks: heartbeat.pendingTasks.length,
      status: heartbeat.status,
    };
  },
});

// Mutation: Delete heartbeat
export const remove = mutation({
  args: {
    agentId: v.string(),
    threadId: v.optional(v.id("threads")),
  },
  handler: async (ctx, args) => {
    const heartbeat = await ctx.db
      .query("heartbeats")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
      .filter((q) =>
        args.threadId
          ? q.eq(q.field("threadId"), args.threadId!)
          : q.eq(q.field("threadId"), undefined)
      )
      .first();
    
    if (!heartbeat) {
      throw new Error(`Heartbeat not found for agent ${args.agentId}`);
    }
    
    await ctx.db.delete(heartbeat._id);
    return { success: true };
  },
});

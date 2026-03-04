import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query: Get all sessions
export const list = query({
  args: {
    userId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    status: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    if (args.projectId) {
      // Query by projectId index
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("byProjectId", (q) => q.eq("projectId", args.projectId!))
        .collect();

      if (args.status) {
        return sessions.filter((s) => s.status === args.status);
      }
      if (args.agentId) {
        return sessions.filter((s) => s.agentId === args.agentId);
      }
      if (args.userId) {
        return sessions.filter((s) => s.userId === args.userId);
      }
      return sessions;
    }

    if (args.status) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("byStatus", (q) => q.eq("status", args.status! as any))
        .collect();

      if (args.userId) {
        return sessions.filter((s) => s.userId === args.userId);
      }
      if (args.agentId) {
        return sessions.filter((s) => s.agentId === args.agentId);
      }
      return sessions;
    }

    if (args.agentId) {
      return await ctx.db
        .query("sessions")
        .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId!))
        .collect();
    }

    if (args.userId) {
      return await ctx.db
        .query("sessions")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    }

    return await ctx.db.query("sessions").collect();
  },
});

// Query: Get session by ID
export const get = query({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // First, try the bySessionId index (handles the sessionId field)
    const bySessionId = await ctx.db
      .query("sessions")
      .withIndex("bySessionId", (q) => q.eq("sessionId", args.sessionId!))
      .first();
    if (bySessionId) return bySessionId;

    // If not found, scan all sessions to match by Convex _id
    // This handles the case where user passes the full Convex document ID
    const allSessions = await ctx.db.query("sessions").collect();
    return allSessions.find(s => s._id === args.sessionId || s._id.endsWith(args.sessionId!)) || null;
  },
});

// Query: Get session by ID with message preview
export const getWithMessages = query({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // First, try the bySessionId index (handles the sessionId field)
    let session = await ctx.db
      .query("sessions")
      .withIndex("bySessionId", (q) => q.eq("sessionId", args.sessionId!))
      .first();

    // If not found, try suffix match (short ID like "c981y6rv")
    if (!session) {
      const allSessions = await ctx.db.query("sessions").collect();
      session = allSessions.find(s => s._id.endsWith(args.sessionId!)) || null;
    } 

    if (!session) {
      return null;
    }

    // Get the last 3 messages for this thread
    const messages = await ctx.db
      .query("messages")
      .withIndex("byThread", (q) => q.eq("threadId", session.threadId))
      .order("desc")
      .take(3);

    // Reverse to get chronological order
    const messagePreview = messages.reverse();

    return {
      ...session,
      messagePreview,
      messageCount: messagePreview.length,
    };
  },
});

// Query: Get active sessions
export const listActive = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("byStatus", (q) => q.eq("status", "active"))
      .collect();
    
    if (args.userId) {
      return sessions.filter((s) => s.userId === args.userId);
    }
    
    return sessions;
  },
});

// Mutation: Create a new session
export const create = mutation({
  args: {
    sessionId: v.string(),
    threadId: v.id("threads"),
    agentId: v.string(),
    userId: v.optional(v.string()),
    channel: v.optional(v.string()),
    metadata: v.optional(v.any()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sessionId = await ctx.db.insert("sessions", {
      ...args,
      status: "active",
      startedAt: now,
      lastActivityAt: now,
    });
    return sessionId;
  },
});

// Mutation: Update session activity
export const updateActivity = mutation({
  args: {
    sessionId: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("bySessionId", (q) => q.eq("sessionId", args.sessionId!))
      .first();
    
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }
    
    await ctx.db.patch(session._id, {
      lastActivityAt: Date.now(),
      ...(args.metadata && { metadata: args.metadata }),
    });
    
    return session._id;
  },
});

// Mutation: Update session status
export const updateStatus = mutation({
  args: {
    sessionId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("error")
    ),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("bySessionId", (q) => q.eq("sessionId", args.sessionId!))
      .first();
    
    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }
    
    const updates: any = {
      status: args.status,
      lastActivityAt: Date.now(),
    };
    
    if (args.status === "completed" || args.status === "error") {
      updates.completedAt = Date.now();
    }
    
    await ctx.db.patch(session._id, updates);
    
    return session._id;
  },
});

// Mutation: Delete session
export const remove = mutation({
  args: { sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("bySessionId", (q) => q.eq("sessionId", args.sessionId!))
      .first();

    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    await ctx.db.delete(session._id);
    return { success: true };
  },
});

// Query: List sessions by agent ID (ordered by createdAt desc)
export const listByAgent = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("byAgentId", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .collect();
  },
});

// Mutation: End session (alias for updateStatus with "completed")
export const endSession = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("bySessionId", (q) => q.eq("sessionId", args.sessionId!))
      .first();

    if (!session) {
      throw new Error(`Session ${args.sessionId} not found`);
    }

    await ctx.db.patch(session._id, {
      status: "completed",
      completedAt: Date.now(),
      lastActivityAt: Date.now(),
    });

    return session._id;
  },
});

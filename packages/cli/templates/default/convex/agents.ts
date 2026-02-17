import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

// Query: Get all agents
export const list = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.userId) {
      return await ctx.db
        .query("agents")
        .withIndex("byUserId", (q) => q.eq("userId", args.userId!))
        .collect();
    }
    return await ctx.db.query("agents").collect();
  },
});

// Query: Get agent by ID
export const get = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("byAgentId", (q) => q.eq("id", args.id!))
      .first();
  },
});

// Query: Get active agents
export const listActive = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const activeQuery = ctx.db
      .query("agents")
      .withIndex("byIsActive", (q) => q.eq("isActive", true));
    
    const agents = await activeQuery.collect();
    
    if (args.userId) {
      return agents.filter((agent) => agent.userId === args.userId);
    }
    
    return agents;
  },
});

// Mutation: Create a new agent
export const create = mutation({
  args: {
    id: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    instructions: v.string(),
    model: v.string(),
    provider: v.string(),
    tools: v.optional(v.any()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    topP: v.optional(v.number()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const agentId = await ctx.db.insert("agents", {
      ...args,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return agentId;
  },
});

// Mutation: Update an agent
export const update = mutation({
  args: {
    id: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    instructions: v.optional(v.string()),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    tools: v.optional(v.any()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    topP: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const agent = await ctx.db
      .query("agents")
      .withIndex("byAgentId", (q) => q.eq("id", id))
      .first();

    if (!agent) {
      throw new Error(`Agent with id ${id} not found`);
    }

    await ctx.db.patch(agent._id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return agent._id;
  },
});

// Mutation: Delete an agent
export const remove = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("byAgentId", (q) => q.eq("id", args.id!))
      .first();

    if (!agent) {
      throw new Error(`Agent with id ${args.id} not found`);
    }

    await ctx.db.delete(agent._id);
    return { success: true };
  },
});

// Mutation: Toggle agent active status
export const toggleActive = mutation({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("byAgentId", (q) => q.eq("id", args.id!))
      .first();

    if (!agent) {
      throw new Error(`Agent with id ${args.id} not found`);
    }

    await ctx.db.patch(agent._id, {
      isActive: !agent.isActive,
      updatedAt: Date.now(),
    });

    return { success: true, isActive: !agent.isActive };
  },
});

// Action: Run agent with Mastra (to be implemented with Mastra integration)
export const run = action({
  args: {
    agentId: v.string(),
    prompt: v.string(),
    threadId: v.optional(v.id("threads")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get agent configuration
    const agent = await ctx.runQuery(api.agents.get, { id: args.agentId });
    
    if (!agent) {
      throw new Error(`Agent with id ${args.agentId} not found`);
    }

    // Create or get thread
    let threadId = args.threadId;
    if (!threadId) {
      threadId = await ctx.runMutation(api.threads.create, {
        agentId: args.agentId,
        userId: args.userId,
      });
    }

    // Add user message
    await ctx.runMutation(api.messages.add, {
      threadId,
      role: "user",
      content: args.prompt,
    });

    // TODO: Integrate with Mastra to run the agent
    // This will be implemented in the Mastra integration phase
    // For now, return a placeholder response
    const response = {
      threadId,
      message: "Agent execution will be implemented with Mastra integration",
      agentId: args.agentId,
    };

    // Add assistant message placeholder
    await ctx.runMutation(api.messages.add, {
      threadId,
      role: "assistant",
      content: response.message,
    });

    return response;
  },
});

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * Mastra Integration Actions for Convex
 * 
 * These actions run in the Node.js runtime and can use Mastra
 * to execute agents and manage workflows.
 */

// Action: Execute agent with Mastra
export const executeAgent = action({
  args: {
    agentId: v.string(),
    prompt: v.string(),
    threadId: v.optional(v.id("threads")),
    userId: v.optional(v.string()),
    stream: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
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
      channel: "dashboard",
    });

    try {
      // Import Mastra dynamically (Node.js runtime)
      const { Agent } = await import("@mastra/core/agent");
      
      // Format model string for Mastra
      const modelString = agent.model.includes("/")
        ? agent.model
        : `${agent.provider}/${agent.model}`;

      // Create Mastra agent
      const mastraAgent = new Agent({
        id: agent.id,
        name: agent.name,
        instructions: agent.instructions,
        model: modelString,
        tools: agent.tools || {},
        ...(agent.temperature && { temperature: agent.temperature }),
        ...(agent.maxTokens && { maxTokens: agent.maxTokens }),
        ...(agent.topP && { topP: agent.topP }),
      });

      // Get conversation history for context
      const messages = await ctx.runQuery(api.messages.list, { threadId });
      
      // Build context from message history
      const context = messages
        .slice(-10) // Last 10 messages for context
        .map((m) => `${m.role}: ${m.content}`)
        .join("\n");

      // Execute agent
      const result = await mastraAgent.generate(args.prompt, {
        ...(args.stream && { stream: args.stream }),
        context: context || undefined,
      });

      // Extract response content
      const responseContent = typeof result === "string" 
        ? result 
        : result.text || result.content || JSON.stringify(result);

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

      // Record usage (if available in result)
      if (result.usage) {
        await ctx.runMutation(api.usage.record, {
          agentId: args.agentId,
          sessionId,
          provider: agent.provider,
          model: agent.model,
          promptTokens: result.usage.promptTokens || 0,
          completionTokens: result.usage.completionTokens || 0,
          totalTokens: result.usage.totalTokens || 0,
          cost: result.usage.cost,
          userId: args.userId,
        });
      }

      return {
        success: true,
        threadId,
        sessionId,
        response: responseContent,
        usage: result.usage,
      };
    } catch (error: any) {
      // Update session status to error
      await ctx.runMutation(api.sessions.updateStatus, {
        sessionId,
        status: "error",
      });

      // Add error message
      await ctx.runMutation(api.messages.add, {
        threadId,
        role: "assistant",
        content: `Error: ${error.message}`,
      });

      throw error;
    }
  },
});

// Action: Stream agent response
export const streamAgent = action({
  args: {
    agentId: v.string(),
    prompt: v.string(),
    threadId: v.id("threads"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Similar to executeAgent but with streaming support
    // This would require WebSocket or SSE implementation
    // For now, return a placeholder
    return {
      success: true,
      message: "Streaming support coming soon",
    };
  },
});

// Action: Execute workflow with multiple agents
export const executeWorkflow = action({
  args: {
    workflowId: v.string(),
    input: v.any(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Placeholder for workflow execution
    // This would orchestrate multiple agents in sequence or parallel
    return {
      success: true,
      message: "Workflow execution coming soon",
    };
  },
});

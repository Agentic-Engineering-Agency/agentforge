"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

/**
 * Workflow Engine — Execute workflows using AgentPipeline.
 * This runs in a Node.js environment (internalAction) to support AgentPipeline.
 */

// Execute a workflow run using AgentPipeline
export const executeWorkflow = internalAction({
  args: {
    runId: v.id("workflowRuns"),
  },
  handler: async (ctx, args) => {
    // Get the workflow run
    const run = await ctx.runQuery(api.workflows.getRun, { id: args.runId });
    if (!run) {
      throw new Error(`Workflow run not found: ${args.runId}`);
    }

    // Get the workflow definition
    const workflow = await ctx.runQuery(api.workflows.get, { id: run.workflowId });
    if (!workflow) {
      throw new Error(`Workflow definition not found: ${run.workflowId}`);
    }

    // Parse workflow steps from JSON string
    const stepsConfig = JSON.parse(workflow.steps) as Array<{
      agentId: string;
      name: string;
    }>;

    // Import AgentPipeline from local lib
    const { AgentPipeline } = await import("./lib/pipeline");

    // Build pipeline from workflow steps
    const pipeline = new AgentPipeline({
      name: workflow.name,
      context: {
        workflowId: workflow._id,
        runId: args.runId,
        userId: run.userId,
        projectId: run.projectId,
      },
    });

    // Add steps for each agent in the workflow
    for (const stepConfig of stepsConfig) {
      pipeline.addStep({
        name: stepConfig.name,
        execute: async (input) => {
          // Get agent configuration
          const agent = await ctx.runQuery(api.agents.get, { id: stepConfig.agentId });
          if (!agent) {
            throw new Error(`Agent not found: ${stepConfig.agentId}`);
          }

          // Create step record in database
          const stepRecordId = await ctx.runMutation(api.workflows.createStep, {
            runId: args.runId,
            stepId: stepConfig.agentId,
            name: stepConfig.name,
            input,
            projectId: run.projectId,
          });

          // Update step to running
          await ctx.runMutation(api.workflows.updateStep, {
            id: stepRecordId,
            status: "running",
            startedAt: Date.now(),
          });

          try {
            // NOTE: LLM execution moved to runtime daemon (SPEC-020).
            // Queue the workflow step as a message; daemon processes it.
            const threadId = await ctx.runMutation(api.threads.createThread, {
              agentId: stepConfig.agentId,
              name: `Workflow: ${stepConfig.agentId}`,
            });
            await ctx.runMutation(api.messages.create, {
              threadId,
              content: input || "Execute workflow step.",
              role: "user" as const,
            });
            const fullResponse = "Workflow step queued for daemon processing";

            await ctx.runMutation(api.workflows.updateStep, {
              id: stepRecordId,
              status: "completed",
              output: fullResponse,
              completedAt: Date.now(),
            });

            return fullResponse;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Update step to failed
            await ctx.runMutation(api.workflows.updateStep, {
              id: stepRecordId,
              status: "failed",
              error: errorMessage,
              completedAt: Date.now(),
            });

            throw error;
          }
        },
      });
    }

    // Update run status to running
    await ctx.runMutation(api.workflows.updateRun, {
      id: args.runId,
      status: "running",
    });

    try {
      // Execute the pipeline
      const result = await pipeline.run(run.input);

      // Update run to completed
      await ctx.runMutation(api.workflows.updateRun, {
        id: args.runId,
        status: "completed",
        output: result,
        completedAt: Date.now(),
      });

      return { success: true, output: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update run to failed
      await ctx.runMutation(api.workflows.updateRun, {
        id: args.runId,
        status: "failed",
        error: errorMessage,
        completedAt: Date.now(),
      });

      throw error;
    }
  },
});

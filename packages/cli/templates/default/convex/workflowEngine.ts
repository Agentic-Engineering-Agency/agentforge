import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

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
    const run = await ctx.runQuery(internal.workflows.getRun, { id: args.runId });
    if (!run) {
      throw new Error(`Workflow run not found: ${args.runId}`);
    }

    // Get the workflow definition
    const workflow = await ctx.runQuery(internal.workflows.get, { id: run.workflowId });
    if (!workflow) {
      throw new Error(`Workflow definition not found: ${run.workflowId}`);
    }

    // Parse workflow steps from JSON string
    const stepsConfig = JSON.parse(workflow.steps) as Array<{
      agentId: string;
      name: string;
    }>;

    // Import AgentPipeline dynamically (runs in Node environment)
    const { AgentPipeline } = await import("@agentforge-ai/core");

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
          const agent = await ctx.runQuery(internal.agents.get, { id: stepConfig.agentId });
          if (!agent) {
            throw new Error(`Agent not found: ${stepConfig.agentId}`);
          }

          // Create step record in database
          const stepRecordId = await ctx.runMutation(internal.workflows.createStep, {
            runId: args.runId,
            stepId: stepConfig.agentId,
            name: stepConfig.name,
            input,
            projectId: run.projectId,
          });

          // Update step to running
          await ctx.runMutation(internal.workflows.updateStep, {
            id: stepRecordId,
            status: "running",
            startedAt: Date.now(),
          });

          try {
            // Import Agent class
            const { Agent: AgentClass } = await import("@agentforge-ai/core");
            const { getBaseModelId, getProviderBaseUrl } = await import("./lib/apiKeys");

            // Get API key for provider
            const apiKeyData = await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, {
              provider: agent.provider || "openrouter",
            });

            if (!apiKeyData || !apiKeyData.apiKey) {
              throw new Error(`No API key found for provider: ${agent.provider}`);
            }

            // Create agent instance
            const mastraAgent = new AgentClass({
              id: stepConfig.agentId,
              name: agent.name,
              instructions: agent.instructions || "You are a helpful AI assistant.",
              model: {
                providerId: agent.provider || "openrouter",
                modelId: getBaseModelId(agent.provider || "openrouter", agent.model || "gpt-4o-mini"),
                apiKey: apiKeyData.apiKey,
                url: getProviderBaseUrl(agent.provider || "openrouter"),
              },
              temperature: agent.temperature,
              maxTokens: agent.maxTokens,
            });

            // Execute agent
            let fullResponse = "";
            for await (const chunk of mastraAgent.stream(input || "")) {
              fullResponse += chunk.content;
            }

            // Update step to completed
            await ctx.runMutation(internal.workflows.updateStep, {
              id: stepRecordId,
              status: "completed",
              output: fullResponse,
              completedAt: Date.now(),
            });

            return fullResponse;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Update step to failed
            await ctx.runMutation(internal.workflows.updateStep, {
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
    await ctx.runMutation(internal.workflows.updateRun, {
      id: args.runId,
      status: "running",
    });

    try {
      // Execute the pipeline
      const result = await pipeline.run(run.input);

      // Update run to completed
      await ctx.runMutation(internal.workflows.updateRun, {
        id: args.runId,
        status: "completed",
        output: result,
        completedAt: Date.now(),
      });

      return { success: true, output: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update run to failed
      await ctx.runMutation(internal.workflows.updateRun, {
        id: args.runId,
        status: "failed",
        error: errorMessage,
        completedAt: Date.now(),
      });

      throw error;
    }
  },
});

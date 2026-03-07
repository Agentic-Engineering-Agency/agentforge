import type { AgentForgeDaemon, WorkflowExecutionResult } from '@agentforge-ai/runtime';
import { executeAgentWorkflow } from '@agentforge-ai/runtime';
import type { ConvexHttpClient } from 'convex/browser';

interface WorkflowStepConfig {
  agentId: string;
  name: string;
  description?: string;
}

interface StepStartParams {
  step: WorkflowStepConfig;
  input: string;
}

interface StepCompleteParams {
  output: string;
  stepRecordId?: string;
}

interface StepErrorParams {
  error: string;
  stepRecordId?: string;
}

export function createDaemonWorkflowExecutor(
  client: ConvexHttpClient,
  daemon: AgentForgeDaemon,
): (runId: string) => Promise<WorkflowExecutionResult> {
  return async (runId: string) => {
    const run = await client.query('workflows:getRun' as never, { id: runId } as never) as any;
    if (!run) {
      throw new Error(`Workflow run not found: ${runId}`);
    }

    const workflow = await client.query('workflows:get' as never, { id: run.workflowId } as never) as any;
    if (!workflow) {
      throw new Error(`Workflow definition not found: ${run.workflowId}`);
    }

    const steps = JSON.parse(workflow.steps) as WorkflowStepConfig[];
    await client.mutation('workflows:updateRun' as never, {
      id: runId,
      status: 'running',
    } as never);

    try {
      const result = await executeAgentWorkflow({
        runId,
        workflowId: String(run.workflowId),
        workflowName: workflow.name,
        input: run.input,
        steps,
        getAgent: (agentId: string) => daemon.getAgent(agentId),
        persistence: {
          onStepStart: async ({ step, input }: StepStartParams) => {
            const stepRecordId = await client.mutation('workflows:createStep' as never, {
              runId,
              stepId: step.agentId,
              name: step.name,
              input,
              projectId: run.projectId,
            } as never);
            await client.mutation('workflows:updateStep' as never, {
              id: stepRecordId,
              status: 'running',
              startedAt: Date.now(),
            } as never);
            return stepRecordId as string;
          },
          onStepComplete: async ({ output, stepRecordId }: StepCompleteParams) => {
            if (!stepRecordId) return;
            await client.mutation('workflows:updateStep' as never, {
              id: stepRecordId,
              status: 'completed',
              output,
              completedAt: Date.now(),
            } as never);
          },
          onStepError: async ({ error, stepRecordId }: StepErrorParams) => {
            if (!stepRecordId) return;
            await client.mutation('workflows:updateStep' as never, {
              id: stepRecordId,
              status: 'failed',
              error,
              completedAt: Date.now(),
            } as never);
          },
        },
      });

      await client.mutation('workflows:updateRun' as never, {
        id: runId,
        status: result.status === 'success' ? 'completed' : 'failed',
        output: result.output,
        error: result.error,
        completedAt: Date.now(),
      } as never);

      return {
        runId,
        status: result.status,
        output: result.output,
        error: result.error,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await client.mutation('workflows:updateRun' as never, {
        id: runId,
        status: 'failed',
        error: message,
        completedAt: Date.now(),
      } as never);
      return {
        runId,
        status: 'failed',
        error: message,
      };
    }
  };
}

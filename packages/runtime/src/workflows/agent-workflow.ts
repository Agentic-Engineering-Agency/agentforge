import { z } from 'zod';
import type { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';

export interface AgentWorkflowStepDefinition {
  agentId: string;
  name: string;
  description?: string;
}

export interface AgentWorkflowPersistence<TStepRecordId = string> {
  onStepStart?(params: {
    runId: string;
    workflowId: string;
    step: AgentWorkflowStepDefinition;
    stepIndex: number;
    input: string;
  }): Promise<TStepRecordId | undefined>;
  onStepComplete?(params: {
    runId: string;
    workflowId: string;
    step: AgentWorkflowStepDefinition;
    stepIndex: number;
    input: string;
    output: string;
    stepRecordId?: TStepRecordId;
  }): Promise<void>;
  onStepError?(params: {
    runId: string;
    workflowId: string;
    step: AgentWorkflowStepDefinition;
    stepIndex: number;
    input: string;
    error: string;
    stepRecordId?: TStepRecordId;
  }): Promise<void>;
}

export interface ExecuteAgentWorkflowInput<TStepRecordId = string> {
  runId: string;
  workflowId: string;
  workflowName: string;
  input?: string;
  steps: AgentWorkflowStepDefinition[];
  getAgent(agentId: string): Agent | undefined;
  persistence?: AgentWorkflowPersistence<TStepRecordId>;
}

export interface ExecuteAgentWorkflowResult {
  status: 'success' | 'failed';
  output?: string;
  error?: string;
}

const workflowInputSchema = z.object({
  text: z.string(),
});

const workflowOutputSchema = z.object({
  text: z.string(),
});

export async function executeAgentWorkflow<TStepRecordId = string>(
  input: ExecuteAgentWorkflowInput<TStepRecordId>,
): Promise<ExecuteAgentWorkflowResult> {
  const workflow = createWorkflow({
    id: `agentforge-workflow-${input.runId}`,
    description: input.workflowName,
    inputSchema: workflowInputSchema,
    outputSchema: workflowOutputSchema,
  });

  let chain = workflow;

  input.steps.forEach((stepDefinition, stepIndex) => {
    const step = createStep({
      id: `workflow-step-${stepIndex + 1}`,
      description: stepDefinition.description ?? stepDefinition.name,
      inputSchema: workflowInputSchema,
      outputSchema: workflowOutputSchema,
      execute: async ({ inputData }) => {
        const agent = input.getAgent(stepDefinition.agentId);
        if (!agent) {
          throw new Error(`Agent not found for workflow step: ${stepDefinition.agentId}`);
        }

        const stepInput = inputData.text;
        const stepRecordId = await input.persistence?.onStepStart?.({
          runId: input.runId,
          workflowId: input.workflowId,
          step: stepDefinition,
          stepIndex,
          input: stepInput,
        });

        try {
          const response = await agent.generate(
            [{ role: 'user', content: stepInput }],
            {
              memory: {
                thread: `workflow:${input.runId}:${stepIndex}`,
                resource: `workflow:${input.workflowId}`,
              },
            },
          );
          const output = response.text;

          await input.persistence?.onStepComplete?.({
            runId: input.runId,
            workflowId: input.workflowId,
            step: stepDefinition,
            stepIndex,
            input: stepInput,
            output,
            stepRecordId,
          });

          return { text: output };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await input.persistence?.onStepError?.({
            runId: input.runId,
            workflowId: input.workflowId,
            step: stepDefinition,
            stepIndex,
            input: stepInput,
            error: message,
            stepRecordId,
          });
          throw error;
        }
      },
    });

    chain = chain.then(step);
  });

  const committedWorkflow = chain.commit();
  const run = await committedWorkflow.createRun({ runId: input.runId });
  const result = await run.start({
    inputData: {
      text: input.input ?? '',
    },
  });

  if (result.status === 'success') {
    return {
      status: 'success',
      output: result.result.text,
    };
  }

  if (result.status === 'failed') {
    return {
      status: 'failed',
      error: result.error.message,
    };
  }

  return {
    status: 'failed',
    error: `Workflow ended in unsupported state: ${result.status}`,
  };
}

import { describe, expect, it, vi } from 'vitest';
import { executeAgentWorkflow } from '../src/workflows/agent-workflow.js';

describe('executeAgentWorkflow', () => {
  it('executes agent steps through the Mastra workflow API', async () => {
    const persistence = {
      onStepStart: vi.fn(async ({ stepIndex }) => `step-${stepIndex}`),
      onStepComplete: vi.fn(async () => {}),
      onStepError: vi.fn(async () => {}),
    };

    const agents = new Map([
      ['researcher', { generate: vi.fn(async () => ({ text: 'researched facts' })) }],
      ['writer', { generate: vi.fn(async () => ({ text: 'final answer' })) }],
    ]);

    const result = await executeAgentWorkflow({
      runId: 'run-1',
      workflowId: 'wf-1',
      workflowName: 'Test workflow',
      input: 'start here',
      steps: [
        { agentId: 'researcher', name: 'Research' },
        { agentId: 'writer', name: 'Write' },
      ],
      getAgent: (agentId) => agents.get(agentId) as any,
      persistence,
    });

    expect(result).toEqual({
      status: 'success',
      output: 'final answer',
    });
    expect(agents.get('researcher')!.generate).toHaveBeenCalled();
    expect(agents.get('writer')!.generate).toHaveBeenCalled();
    expect(persistence.onStepStart).toHaveBeenCalledTimes(2);
    expect(persistence.onStepComplete).toHaveBeenCalledTimes(2);
    expect(persistence.onStepError).not.toHaveBeenCalled();
  });
});

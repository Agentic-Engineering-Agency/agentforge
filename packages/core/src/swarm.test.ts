/**
 * Tests for Parallel Multi-Agent Orchestration (Swarm)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SwarmOrchestrator,
  InMemorySwarmStore,
  SubTaskRunner,
  ResultAggregator,
  swarmDispatchSchema,
  subTaskInputSchema,
  DEFAULT_RESOURCE_LIMITS,
  PRO_RESOURCE_LIMITS,
  ENTERPRISE_RESOURCE_LIMITS,
  type SubAgentExecutor,
  type SwarmEvent,
  type SwarmJob,
  type SubTask,
  type SubTaskResult,
} from './swarm.js';

// =====================================================
// Test Helpers
// =====================================================

function createMockExecutor(
  delay = 10,
  shouldFail = false,
  failMessage = 'Mock execution failed'
): SubAgentExecutor {
  return async (prompt: string, _instructions: string, _model: string) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (shouldFail) {
      throw new Error(failMessage);
    }
    return {
      text: `Result for: ${prompt}`,
      tokenUsage: { promptTokens: 100, completionTokens: 50 },
    };
  };
}

function createSubTasks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `task-${i}`,
    prompt: `Research topic ${i}`,
  }));
}

// =====================================================
// Tests
// =====================================================

describe('SwarmOrchestrator', () => {
  let store: InMemorySwarmStore;
  let orchestrator: SwarmOrchestrator;

  beforeEach(() => {
    store = new InMemorySwarmStore();
    orchestrator = new SwarmOrchestrator(store);
  });

  describe('dispatch', () => {
    it('should dispatch a swarm job and complete successfully', async () => {
      const executor = createMockExecutor(10);

      const jobId = await orchestrator.dispatch({
        name: 'test-swarm',
        orchestratorAgentId: 'agent-1',
        subTasks: createSubTasks(3),
        synthesisPrompt: 'Synthesize the results.',
        executor,
      });

      expect(jobId).toBeDefined();
      expect(jobId).toContain('swarm-');

      const job = await store.getJob(jobId);
      expect(job).toBeDefined();
      expect(job!.status).toBe('completed');
      expect(job!.totalTasks).toBe(3);
      expect(job!.completedTasks).toBe(3);
      expect(job!.failedTasks).toBe(0);
      expect(job!.finalResult).toBeDefined();
    });

    it('should handle partial failures gracefully', async () => {
      let callCount = 0;
      const executor: SubAgentExecutor = async (prompt) => {
        callCount++;
        await new Promise((r) => setTimeout(r, 10));
        // Fail the second task permanently
        if (prompt.includes('topic 1')) {
          throw new Error('Research failed');
        }
        return {
          text: `Result for: ${prompt}`,
          tokenUsage: { promptTokens: 100, completionTokens: 50 },
        };
      };

      const jobId = await orchestrator.dispatch({
        name: 'partial-failure-swarm',
        orchestratorAgentId: 'agent-1',
        subTasks: createSubTasks(3),
        synthesisPrompt: 'Synthesize available results.',
        executor,
        maxRetries: 0, // No retries for faster test
      });

      const job = await store.getJob(jobId);
      expect(job!.status).toBe('completed');
      expect(job!.completedTasks).toBe(2);
      expect(job!.failedTasks).toBe(1);
      expect(job!.finalResult).toBeDefined();
    });

    it('should respect concurrency limits', async () => {
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      const executor: SubAgentExecutor = async (prompt) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((r) => setTimeout(r, 50));
        currentConcurrent--;
        return { text: `Result for: ${prompt}` };
      };

      await orchestrator.dispatch({
        name: 'concurrency-test',
        orchestratorAgentId: 'agent-1',
        subTasks: createSubTasks(10),
        synthesisPrompt: 'Synthesize.',
        executor,
        maxConcurrent: 3,
        limits: { ...PRO_RESOURCE_LIMITS, maxConcurrentSubAgents: 3 },
      });

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('should enforce resource limits on sub-task count', async () => {
      const executor = createMockExecutor(10);

      await expect(
        orchestrator.dispatch({
          name: 'too-many-tasks',
          orchestratorAgentId: 'agent-1',
          subTasks: createSubTasks(15),
          synthesisPrompt: 'Synthesize.',
          executor,
          limits: DEFAULT_RESOURCE_LIMITS, // max 10
        })
      ).rejects.toThrow('Too many sub-tasks: 15 exceeds limit of 10');
    });

    it('should emit events during execution', async () => {
      const events: SwarmEvent[] = [];
      orchestrator.onEvent((event) => events.push(event));

      const executor = createMockExecutor(10);

      await orchestrator.dispatch({
        name: 'event-test',
        orchestratorAgentId: 'agent-1',
        subTasks: createSubTasks(2),
        synthesisPrompt: 'Synthesize.',
        executor,
      });

      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain('job_created');
      expect(eventTypes).toContain('job_started');
      expect(eventTypes).toContain('subtask_started');
      expect(eventTypes).toContain('subtask_completed');
      expect(eventTypes).toContain('job_synthesizing');
      expect(eventTypes).toContain('synthesis_started');
      expect(eventTypes).toContain('synthesis_completed');
      expect(eventTypes).toContain('job_completed');
    });

    it('should unregister event handlers', async () => {
      const events: SwarmEvent[] = [];
      const unsub = orchestrator.onEvent((event) => events.push(event));
      unsub();

      const executor = createMockExecutor(10);

      await orchestrator.dispatch({
        name: 'unsub-test',
        orchestratorAgentId: 'agent-1',
        subTasks: createSubTasks(1),
        synthesisPrompt: 'Synthesize.',
        executor,
      });

      expect(events).toHaveLength(0);
    });

    it('should use custom synthesizer when provided', async () => {
      const executor = createMockExecutor(10);
      const synthesizer: SubAgentExecutor = async () => ({
        text: 'Custom synthesis result',
      });

      const jobId = await orchestrator.dispatch({
        name: 'custom-synth',
        orchestratorAgentId: 'agent-1',
        subTasks: createSubTasks(2),
        synthesisPrompt: 'Synthesize.',
        executor,
        synthesizer,
      });

      const job = await store.getJob(jobId);
      expect(job!.finalResult).toBe('Custom synthesis result');
    });

    it('should handle synthesis failure', async () => {
      const executor = createMockExecutor(10);
      const synthesizer: SubAgentExecutor = async () => {
        throw new Error('Synthesis failed');
      };

      const events: SwarmEvent[] = [];
      orchestrator.onEvent((event) => events.push(event));

      const jobId = await orchestrator.dispatch({
        name: 'synth-fail',
        orchestratorAgentId: 'agent-1',
        subTasks: createSubTasks(2),
        synthesisPrompt: 'Synthesize.',
        executor,
        synthesizer,
      });

      const job = await store.getJob(jobId);
      expect(job!.status).toBe('failed');

      const failEvents = events.filter((e) => e.type === 'job_failed');
      expect(failEvents).toHaveLength(1);
    });

    it('should apply default model and instructions', async () => {
      const capturedCalls: Array<{ prompt: string; instructions: string; model: string }> = [];

      const executor: SubAgentExecutor = async (
        prompt,
        instructions,
        model
      ) => {
        capturedCalls.push({ prompt, instructions, model });
        return { text: 'ok' };
      };

      await orchestrator.dispatch({
        name: 'defaults-test',
        orchestratorAgentId: 'agent-1',
        subTasks: createSubTasks(1),
        synthesisPrompt: 'Synthesize.',
        executor,
      });

      // First call is the sub-task, second is the synthesis
      expect(capturedCalls.length).toBeGreaterThanOrEqual(1);
      expect(capturedCalls[0].model).toBe('openai/gpt-4o');
      expect(capturedCalls[0].instructions).toContain('research assistant');
    });
  });

  describe('getStatus', () => {
    it('should return job status with summary', async () => {
      const executor = createMockExecutor(10);

      const jobId = await orchestrator.dispatch({
        name: 'status-test',
        orchestratorAgentId: 'agent-1',
        subTasks: createSubTasks(3),
        synthesisPrompt: 'Synthesize.',
        executor,
      });

      const status = await orchestrator.getStatus(jobId);
      expect(status.job).toBeDefined();
      expect(status.job!.status).toBe('completed');
      expect(status.subTasks).toHaveLength(3);
      expect(status.results).toHaveLength(3);
      expect(status.summary.successCount).toBe(3);
      expect(status.summary.totalTokens).toBeGreaterThan(0);
    });
  });
});

describe('SubTaskRunner', () => {
  it('should run a sub-task successfully', async () => {
    const subTask: SubTask = {
      id: 'task-1',
      swarmJobId: 'job-1',
      taskIndex: 0,
      prompt: 'Research topic',
      status: 'running',
      retryCount: 0,
      maxRetries: 2,
      timeoutMs: 5000,
      createdAt: Date.now(),
    };

    const executor = createMockExecutor(10);
    const result = await SubTaskRunner.run(subTask, executor, 'instructions', 'model');

    expect(result.result).toContain('Research topic');
    expect(result.error).toBeUndefined();
    expect(result.executionTimeMs).toBeDefined();
    expect(result.tokenUsage).toBeDefined();
  });

  it('should handle execution errors', async () => {
    const subTask: SubTask = {
      id: 'task-2',
      swarmJobId: 'job-1',
      taskIndex: 0,
      prompt: 'Failing task',
      status: 'running',
      retryCount: 0,
      maxRetries: 2,
      timeoutMs: 5000,
      createdAt: Date.now(),
    };

    const executor = createMockExecutor(10, true, 'API rate limited');
    const result = await SubTaskRunner.run(subTask, executor, 'instructions', 'model');

    expect(result.result).toBeUndefined();
    expect(result.error).toBe('API rate limited');
  });

  it('should handle timeouts', async () => {
    const subTask: SubTask = {
      id: 'task-3',
      swarmJobId: 'job-1',
      taskIndex: 0,
      prompt: 'Slow task',
      status: 'running',
      retryCount: 0,
      maxRetries: 2,
      timeoutMs: 50, // Very short timeout
      createdAt: Date.now(),
    };

    const executor = createMockExecutor(200); // Takes longer than timeout
    const result = await SubTaskRunner.run(subTask, executor, 'instructions', 'model');

    expect(result.result).toBeUndefined();
    expect(result.error).toContain('Timed out');
  });
});

describe('ResultAggregator', () => {
  it('should format results for synthesis', () => {
    const job: SwarmJob = {
      id: 'job-1',
      name: 'test',
      status: 'synthesizing',
      orchestratorAgentId: 'agent-1',
      synthesisPrompt: 'Combine all results.',
      subAgentModel: 'openai/gpt-4o',
      subAgentInstructions: 'Research.',
      totalTasks: 3,
      completedTasks: 2,
      failedTasks: 1,
      maxConcurrent: 10,
      createdAt: Date.now(),
    };

    const results: SubTaskResult[] = [
      {
        id: 'r1',
        subTaskId: 't1',
        swarmJobId: 'job-1',
        result: 'Market size is $50B',
        createdAt: Date.now(),
      },
      {
        id: 'r2',
        subTaskId: 't2',
        swarmJobId: 'job-1',
        result: 'Top competitor is X',
        createdAt: Date.now(),
      },
      {
        id: 'r3',
        subTaskId: 't3',
        swarmJobId: 'job-1',
        error: 'API rate limited',
        createdAt: Date.now(),
      },
    ];

    const formatted = ResultAggregator.formatForSynthesis(job, results);
    expect(formatted).toContain('Combine all results.');
    expect(formatted).toContain('Total sub-tasks: 3');
    expect(formatted).toContain('Successful: 2');
    expect(formatted).toContain('Failed: 1');
    expect(formatted).toContain('Market size is $50B');
    expect(formatted).toContain('API rate limited');
    expect(formatted).toContain('(SUCCESS)');
    expect(formatted).toContain('(FAILED)');
  });

  it('should calculate summary statistics', () => {
    const results: SubTaskResult[] = [
      {
        id: 'r1',
        subTaskId: 't1',
        swarmJobId: 'job-1',
        result: 'ok',
        tokenUsage: { promptTokens: 100, completionTokens: 50 },
        executionTimeMs: 1000,
        createdAt: Date.now(),
      },
      {
        id: 'r2',
        subTaskId: 't2',
        swarmJobId: 'job-1',
        result: 'ok',
        tokenUsage: { promptTokens: 200, completionTokens: 100 },
        executionTimeMs: 2000,
        createdAt: Date.now(),
      },
      {
        id: 'r3',
        subTaskId: 't3',
        swarmJobId: 'job-1',
        error: 'failed',
        executionTimeMs: 500,
        createdAt: Date.now(),
      },
    ];

    const summary = ResultAggregator.getSummary(results);
    expect(summary.totalResults).toBe(3);
    expect(summary.successCount).toBe(2);
    expect(summary.failedCount).toBe(1);
    expect(summary.totalTokens).toBe(450); // 100+50+200+100
    expect(summary.totalExecutionTimeMs).toBe(3500);
    expect(summary.averageExecutionTimeMs).toBe(1167); // 3500/3 rounded
  });

  it('should handle empty results', () => {
    const summary = ResultAggregator.getSummary([]);
    expect(summary.totalResults).toBe(0);
    expect(summary.successCount).toBe(0);
    expect(summary.failedCount).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.averageExecutionTimeMs).toBe(0);
  });
});

describe('InMemorySwarmStore', () => {
  let store: InMemorySwarmStore;

  beforeEach(() => {
    store = new InMemorySwarmStore();
  });

  it('should create and retrieve a job', async () => {
    const job: SwarmJob = {
      id: 'job-1',
      name: 'test',
      status: 'pending',
      orchestratorAgentId: 'agent-1',
      synthesisPrompt: 'Synthesize.',
      subAgentModel: 'openai/gpt-4o',
      subAgentInstructions: 'Research.',
      totalTasks: 3,
      completedTasks: 0,
      failedTasks: 0,
      maxConcurrent: 10,
      createdAt: Date.now(),
    };

    await store.createJob(job);
    const retrieved = await store.getJob('job-1');
    expect(retrieved).toEqual(job);
  });

  it('should update a job', async () => {
    const job: SwarmJob = {
      id: 'job-2',
      name: 'test',
      status: 'pending',
      orchestratorAgentId: 'agent-1',
      synthesisPrompt: 'Synthesize.',
      subAgentModel: 'openai/gpt-4o',
      subAgentInstructions: 'Research.',
      totalTasks: 3,
      completedTasks: 0,
      failedTasks: 0,
      maxConcurrent: 10,
      createdAt: Date.now(),
    };

    await store.createJob(job);
    await store.updateJob('job-2', { status: 'running', startedAt: Date.now() });

    const updated = await store.getJob('job-2');
    expect(updated!.status).toBe('running');
    expect(updated!.startedAt).toBeDefined();
  });

  it('should return null for non-existent job', async () => {
    const job = await store.getJob('nonexistent');
    expect(job).toBeNull();
  });

  it('should create and retrieve sub-tasks', async () => {
    const subTasks: SubTask[] = [
      {
        id: 'st-1',
        swarmJobId: 'job-1',
        taskIndex: 0,
        prompt: 'Task 1',
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
        timeoutMs: 120000,
        createdAt: Date.now(),
      },
      {
        id: 'st-2',
        swarmJobId: 'job-1',
        taskIndex: 1,
        prompt: 'Task 2',
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
        timeoutMs: 120000,
        createdAt: Date.now(),
      },
    ];

    await store.createSubTasks(subTasks);
    const retrieved = await store.getSubTasks('job-1');
    expect(retrieved).toHaveLength(2);
  });

  it('should store and retrieve results', async () => {
    const result: SubTaskResult = {
      id: 'r-1',
      subTaskId: 'st-1',
      swarmJobId: 'job-1',
      result: 'Success',
      tokenUsage: { promptTokens: 100, completionTokens: 50 },
      executionTimeMs: 1000,
      createdAt: Date.now(),
    };

    await store.storeResult(result);
    const results = await store.getResults('job-1');
    expect(results).toHaveLength(1);
    expect(results[0].result).toBe('Success');
  });

  it('should clear all data', async () => {
    const job: SwarmJob = {
      id: 'job-clear',
      name: 'test',
      status: 'pending',
      orchestratorAgentId: 'agent-1',
      synthesisPrompt: 'Synthesize.',
      subAgentModel: 'openai/gpt-4o',
      subAgentInstructions: 'Research.',
      totalTasks: 1,
      completedTasks: 0,
      failedTasks: 0,
      maxConcurrent: 10,
      createdAt: Date.now(),
    };

    await store.createJob(job);
    store.clear();

    const retrieved = await store.getJob('job-clear');
    expect(retrieved).toBeNull();
  });
});

describe('Zod Schemas', () => {
  it('should validate sub-task input', () => {
    const result = subTaskInputSchema.safeParse({
      id: 'task-1',
      prompt: 'Research topic',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid sub-task input', () => {
    const result = subTaskInputSchema.safeParse({ id: 'task-1' });
    expect(result.success).toBe(false);
  });

  it('should validate swarm dispatch input', () => {
    const result = swarmDispatchSchema.safeParse({
      name: 'test-swarm',
      subTasks: [
        { id: 'task-1', prompt: 'Research topic 1' },
        { id: 'task-2', prompt: 'Research topic 2' },
      ],
      synthesisPrompt: 'Synthesize the results.',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty sub-tasks array', () => {
    const result = swarmDispatchSchema.safeParse({
      name: 'test-swarm',
      subTasks: [],
      synthesisPrompt: 'Synthesize.',
    });
    expect(result.success).toBe(false);
  });

  it('should reject too many sub-tasks', () => {
    const result = swarmDispatchSchema.safeParse({
      name: 'test-swarm',
      subTasks: Array.from({ length: 201 }, (_, i) => ({
        id: `task-${i}`,
        prompt: `Topic ${i}`,
      })),
      synthesisPrompt: 'Synthesize.',
    });
    expect(result.success).toBe(false);
  });

  it('should validate optional fields', () => {
    const result = swarmDispatchSchema.safeParse({
      name: 'test-swarm',
      subTasks: [{ id: 'task-1', prompt: 'Research' }],
      synthesisPrompt: 'Synthesize.',
      subAgentModel: 'anthropic/claude-3-sonnet',
      maxConcurrent: 5,
      timeoutMs: 60000,
      maxRetries: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe('Resource Limits', () => {
  it('should have correct default limits', () => {
    expect(DEFAULT_RESOURCE_LIMITS.maxConcurrentSubAgents).toBe(5);
    expect(DEFAULT_RESOURCE_LIMITS.maxSubTasksPerSwarm).toBe(10);
    expect(DEFAULT_RESOURCE_LIMITS.maxSubAgentTimeoutMs).toBe(60_000);
    expect(DEFAULT_RESOURCE_LIMITS.maxSwarmsPerHour).toBe(5);
    expect(DEFAULT_RESOURCE_LIMITS.maxTokenBudgetPerSwarm).toBe(100_000);
  });

  it('should have correct pro limits', () => {
    expect(PRO_RESOURCE_LIMITS.maxConcurrentSubAgents).toBe(25);
    expect(PRO_RESOURCE_LIMITS.maxSubTasksPerSwarm).toBe(50);
    expect(PRO_RESOURCE_LIMITS.maxSubAgentTimeoutMs).toBe(120_000);
  });

  it('should have correct enterprise limits', () => {
    expect(ENTERPRISE_RESOURCE_LIMITS.maxConcurrentSubAgents).toBe(100);
    expect(ENTERPRISE_RESOURCE_LIMITS.maxSubTasksPerSwarm).toBe(200);
    expect(ENTERPRISE_RESOURCE_LIMITS.maxSwarmsPerHour).toBe(Infinity);
  });
});

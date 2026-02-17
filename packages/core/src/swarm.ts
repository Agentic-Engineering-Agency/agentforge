/**
 * Parallel Multi-Agent Orchestration (Swarm) for AgentForge.
 *
 * Provides the core swarm primitives for dispatching N agents in parallel,
 * tracking progress, handling partial failures, and synthesizing results.
 *
 * Architecture:
 * - `SwarmOrchestrator` — Manages the full lifecycle of a swarm job
 * - `SubTaskRunner` — Executes individual sub-tasks with timeout and retry
 * - `SwarmMCPServer` — MCP tool interface for agent-driven swarm dispatch
 * - `ResultAggregator` — Collects and formats results for synthesis
 *
 * This module is runtime-agnostic. It can run in:
 * - Convex Node Actions (production)
 * - Cloudflare Workers (sub-agent execution)
 * - Local Node.js (development/testing)
 *
 * @packageDocumentation
 */

import { z } from 'zod';

// =====================================================
// Schemas
// =====================================================

/**
 * Schema for a single sub-task definition.
 */
export const subTaskInputSchema = z.object({
  id: z.string().describe('A unique identifier for this sub-task.'),
  prompt: z
    .string()
    .describe('The self-contained prompt for the sub-agent.'),
});

/**
 * Schema for dispatching a swarm.
 */
export const swarmDispatchSchema = z.object({
  name: z.string().describe('A human-readable name for this swarm job.'),
  subTasks: z
    .array(subTaskInputSchema)
    .min(1)
    .max(200)
    .describe('Array of independent sub-tasks to execute in parallel.'),
  synthesisPrompt: z
    .string()
    .describe(
      'Instructions for synthesizing all sub-task results into a final response.'
    ),
  subAgentModel: z
    .string()
    .optional()
    .describe(
      'Model to use for sub-agents. Defaults to the orchestrator model.'
    ),
  subAgentInstructions: z
    .string()
    .optional()
    .describe(
      'System instructions for sub-agents. Defaults to a generic research prompt.'
    ),
  maxConcurrent: z
    .number()
    .int()
    .positive()
    .max(200)
    .optional()
    .describe('Maximum number of sub-agents running concurrently. Default: 10.'),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Timeout per sub-task in milliseconds. Default: 120000 (2 min).'),
  maxRetries: z
    .number()
    .int()
    .min(0)
    .max(5)
    .optional()
    .describe('Maximum retry attempts per sub-task. Default: 2.'),
});

export type SwarmDispatchInput = z.infer<typeof swarmDispatchSchema>;
export type SubTaskInput = z.infer<typeof subTaskInputSchema>;

// =====================================================
// Core Types
// =====================================================

/**
 * Status of a swarm job.
 */
export type SwarmJobStatus =
  | 'pending'
  | 'running'
  | 'synthesizing'
  | 'completed'
  | 'failed';

/**
 * Status of a sub-task.
 */
export type SubTaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'timed_out';

/**
 * Token usage for a sub-agent execution.
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

/**
 * A swarm job definition.
 */
export interface SwarmJob {
  id: string;
  name: string;
  status: SwarmJobStatus;
  orchestratorAgentId: string;
  synthesisPrompt: string;
  subAgentModel: string;
  subAgentInstructions: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  maxConcurrent: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  finalResult?: string;
}

/**
 * A sub-task within a swarm job.
 */
export interface SubTask {
  id: string;
  swarmJobId: string;
  taskIndex: number;
  prompt: string;
  status: SubTaskStatus;
  workerId?: string;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  createdAt: number;
  queuedAt?: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Result of a sub-agent execution.
 */
export interface SubTaskResult {
  id: string;
  subTaskId: string;
  swarmJobId: string;
  result?: string;
  error?: string;
  tokenUsage?: TokenUsage;
  executionTimeMs?: number;
  createdAt: number;
}

/**
 * Resource limits for swarm execution.
 */
export interface SwarmResourceLimits {
  maxConcurrentSubAgents: number;
  maxSubTasksPerSwarm: number;
  maxSubAgentTimeoutMs: number;
  maxSwarmsPerHour: number;
  maxTokenBudgetPerSwarm: number;
}

/**
 * Default resource limits (Free tier).
 */
export const DEFAULT_RESOURCE_LIMITS: SwarmResourceLimits = {
  maxConcurrentSubAgents: 5,
  maxSubTasksPerSwarm: 10,
  maxSubAgentTimeoutMs: 60_000,
  maxSwarmsPerHour: 5,
  maxTokenBudgetPerSwarm: 100_000,
};

/**
 * Pro tier resource limits.
 */
export const PRO_RESOURCE_LIMITS: SwarmResourceLimits = {
  maxConcurrentSubAgents: 25,
  maxSubTasksPerSwarm: 50,
  maxSubAgentTimeoutMs: 120_000,
  maxSwarmsPerHour: 20,
  maxTokenBudgetPerSwarm: 500_000,
};

/**
 * Enterprise tier resource limits.
 */
export const ENTERPRISE_RESOURCE_LIMITS: SwarmResourceLimits = {
  maxConcurrentSubAgents: 100,
  maxSubTasksPerSwarm: 200,
  maxSubAgentTimeoutMs: 300_000,
  maxSwarmsPerHour: Infinity,
  maxTokenBudgetPerSwarm: 2_000_000,
};

// =====================================================
// Sub-Task Runner
// =====================================================

/**
 * Function that executes a sub-agent with a prompt and returns the result.
 */
export type SubAgentExecutor = (
  prompt: string,
  instructions: string,
  model: string
) => Promise<{ text: string; tokenUsage?: TokenUsage }>;

/**
 * Runs a single sub-task with timeout and error handling.
 */
export class SubTaskRunner {
  /**
   * Execute a sub-task with timeout.
   */
  static async run(
    subTask: SubTask,
    executor: SubAgentExecutor,
    instructions: string,
    model: string
  ): Promise<SubTaskResult> {
    const startTime = Date.now();

    try {
      const result = await SubTaskRunner.withTimeout(
        executor(subTask.prompt, instructions, model),
        subTask.timeoutMs
      );

      return {
        id: `result-${subTask.id}`,
        subTaskId: subTask.id,
        swarmJobId: subTask.swarmJobId,
        result: result.text,
        tokenUsage: result.tokenUsage,
        executionTimeMs: Date.now() - startTime,
        createdAt: Date.now(),
      };
    } catch (error) {
      const isTimeout =
        error instanceof Error && error.message === 'Sub-task timed out';

      return {
        id: `result-${subTask.id}`,
        subTaskId: subTask.id,
        swarmJobId: subTask.swarmJobId,
        error: isTimeout
          ? `Timed out after ${subTask.timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : String(error),
        executionTimeMs: Date.now() - startTime,
        createdAt: Date.now(),
      };
    }
  }

  /**
   * Wrap a promise with a timeout.
   */
  private static withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Sub-task timed out'));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}

// =====================================================
// Result Aggregator
// =====================================================

/**
 * Aggregates and formats sub-task results for synthesis.
 */
export class ResultAggregator {
  /**
   * Format all results into a synthesis input string.
   */
  static formatForSynthesis(
    job: SwarmJob,
    results: SubTaskResult[]
  ): string {
    const formattedResults = results
      .map((r, i) => {
        if (r.result) {
          return `## Sub-Task ${i + 1} (SUCCESS)\n${r.result}`;
        } else {
          return `## Sub-Task ${i + 1} (FAILED)\nError: ${r.error}`;
        }
      })
      .join('\n\n---\n\n');

    return (
      `${job.synthesisPrompt}\n\n` +
      `Total sub-tasks: ${job.totalTasks}\n` +
      `Successful: ${job.completedTasks}\n` +
      `Failed: ${job.failedTasks}\n\n` +
      `---\n\n${formattedResults}`
    );
  }

  /**
   * Get summary statistics for a set of results.
   */
  static getSummary(results: SubTaskResult[]): {
    totalResults: number;
    successCount: number;
    failedCount: number;
    totalTokens: number;
    totalExecutionTimeMs: number;
    averageExecutionTimeMs: number;
  } {
    const successResults = results.filter((r) => r.result !== undefined);
    const failedResults = results.filter((r) => r.error !== undefined);

    const totalTokens = results.reduce((sum, r) => {
      if (r.tokenUsage) {
        return sum + r.tokenUsage.promptTokens + r.tokenUsage.completionTokens;
      }
      return sum;
    }, 0);

    const totalExecutionTimeMs = results.reduce(
      (sum, r) => sum + (r.executionTimeMs || 0),
      0
    );

    return {
      totalResults: results.length,
      successCount: successResults.length,
      failedCount: failedResults.length,
      totalTokens,
      totalExecutionTimeMs,
      averageExecutionTimeMs:
        results.length > 0
          ? Math.round(totalExecutionTimeMs / results.length)
          : 0,
    };
  }
}

// =====================================================
// Swarm Orchestrator
// =====================================================

/**
 * Callback interface for swarm state persistence.
 * Implement this to connect the orchestrator to your storage layer
 * (Convex, in-memory for tests, etc.).
 */
export interface SwarmStateStore {
  /** Create a new swarm job record. */
  createJob(job: SwarmJob): Promise<void>;
  /** Update a swarm job record. */
  updateJob(id: string, updates: Partial<SwarmJob>): Promise<void>;
  /** Get a swarm job by ID. */
  getJob(id: string): Promise<SwarmJob | null>;
  /** Create sub-task records. */
  createSubTasks(subTasks: SubTask[]): Promise<void>;
  /** Update a sub-task record. */
  updateSubTask(id: string, updates: Partial<SubTask>): Promise<void>;
  /** Get all sub-tasks for a job. */
  getSubTasks(swarmJobId: string): Promise<SubTask[]>;
  /** Store a sub-task result. */
  storeResult(result: SubTaskResult): Promise<void>;
  /** Get all results for a job. */
  getResults(swarmJobId: string): Promise<SubTaskResult[]>;
}

/**
 * Event emitted during swarm execution.
 */
export type SwarmEvent =
  | { type: 'job_created'; job: SwarmJob }
  | { type: 'job_started'; jobId: string }
  | { type: 'job_synthesizing'; jobId: string }
  | { type: 'job_completed'; jobId: string; finalResult: string }
  | { type: 'job_failed'; jobId: string; error: string }
  | { type: 'subtask_started'; subTask: SubTask }
  | { type: 'subtask_completed'; subTaskId: string; result: SubTaskResult }
  | { type: 'subtask_failed'; subTaskId: string; error: string; willRetry: boolean }
  | { type: 'subtask_timed_out'; subTaskId: string; willRetry: boolean }
  | { type: 'synthesis_started'; jobId: string }
  | { type: 'synthesis_completed'; jobId: string };

export type SwarmEventHandler = (event: SwarmEvent) => void | Promise<void>;

/**
 * The Swarm Orchestrator manages the full lifecycle of a parallel
 * multi-agent job: dispatch, execution, progress tracking, and synthesis.
 *
 * @example
 * ```typescript
 * const store = new InMemorySwarmStore();
 * const orchestrator = new SwarmOrchestrator(store);
 *
 * orchestrator.onEvent((event) => {
 *   console.log(event.type, event);
 * });
 *
 * const jobId = await orchestrator.dispatch({
 *   name: 'market-research',
 *   orchestratorAgentId: 'research-agent',
 *   subTasks: [
 *     { id: 'task-1', prompt: 'Research market size...' },
 *     { id: 'task-2', prompt: 'Research competitors...' },
 *   ],
 *   synthesisPrompt: 'Synthesize into a report...',
 *   subAgentModel: 'openai/gpt-4o',
 *   executor: async (prompt, instructions, model) => {
 *     return { text: 'Result for: ' + prompt };
 *   },
 * });
 *
 * const job = await store.getJob(jobId);
 * console.log(job?.finalResult);
 * ```
 */
export class SwarmOrchestrator {
  private store: SwarmStateStore;
  private eventHandlers: Set<SwarmEventHandler> = new Set();

  constructor(store: SwarmStateStore) {
    this.store = store;
  }

  /**
   * Register an event handler.
   */
  onEvent(handler: SwarmEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Dispatch a new swarm job.
   *
   * Creates the job and sub-tasks, then executes all sub-tasks
   * in parallel (respecting concurrency limits), and finally
   * synthesizes the results.
   */
  async dispatch(params: {
    name: string;
    orchestratorAgentId: string;
    subTasks: SubTaskInput[];
    synthesisPrompt: string;
    subAgentModel?: string;
    subAgentInstructions?: string;
    maxConcurrent?: number;
    timeoutMs?: number;
    maxRetries?: number;
    executor: SubAgentExecutor;
    synthesizer?: SubAgentExecutor;
    limits?: SwarmResourceLimits;
  }): Promise<string> {
    const limits = params.limits || DEFAULT_RESOURCE_LIMITS;
    const maxConcurrent = Math.min(
      params.maxConcurrent || 10,
      limits.maxConcurrentSubAgents
    );
    const timeoutMs = Math.min(
      params.timeoutMs || 120_000,
      limits.maxSubAgentTimeoutMs
    );
    const maxRetries = params.maxRetries ?? 2;
    const model = params.subAgentModel || 'openai/gpt-4o';
    const instructions =
      params.subAgentInstructions ||
      'You are a research assistant. Complete the given task thoroughly and return a detailed response.';

    // Validate against resource limits
    if (params.subTasks.length > limits.maxSubTasksPerSwarm) {
      throw new Error(
        `Too many sub-tasks: ${params.subTasks.length} exceeds limit of ${limits.maxSubTasksPerSwarm}`
      );
    }

    // Generate job ID
    const jobId = `swarm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = Date.now();

    // Create job
    const job: SwarmJob = {
      id: jobId,
      name: params.name,
      status: 'pending',
      orchestratorAgentId: params.orchestratorAgentId,
      synthesisPrompt: params.synthesisPrompt,
      subAgentModel: model,
      subAgentInstructions: instructions,
      totalTasks: params.subTasks.length,
      completedTasks: 0,
      failedTasks: 0,
      maxConcurrent,
      createdAt: now,
    };

    await this.store.createJob(job);
    this.emit({ type: 'job_created', job });

    // Create sub-tasks
    const subTasks: SubTask[] = params.subTasks.map((st, index) => ({
      id: `${jobId}-task-${index}`,
      swarmJobId: jobId,
      taskIndex: index,
      prompt: st.prompt,
      status: 'pending' as SubTaskStatus,
      retryCount: 0,
      maxRetries,
      timeoutMs,
      createdAt: now,
    }));

    await this.store.createSubTasks(subTasks);

    // Start execution
    await this.store.updateJob(jobId, {
      status: 'running',
      startedAt: Date.now(),
    });
    this.emit({ type: 'job_started', jobId });

    // Execute sub-tasks with concurrency control
    await this.executeSubTasks(
      subTasks,
      jobId,
      params.executor,
      instructions,
      model,
      maxConcurrent
    );

    // Synthesize results
    const updatedJob = await this.store.getJob(jobId);
    if (!updatedJob) throw new Error(`Job ${jobId} not found after execution`);

    await this.store.updateJob(jobId, { status: 'synthesizing' });
    this.emit({ type: 'job_synthesizing', jobId });
    this.emit({ type: 'synthesis_started', jobId });

    const results = await this.store.getResults(jobId);
    const synthesisInput = ResultAggregator.formatForSynthesis(
      { ...updatedJob, status: 'synthesizing' },
      results
    );

    try {
      const synthesizer = params.synthesizer || params.executor;
      const synthesisResult = await synthesizer(
        synthesisInput,
        params.synthesisPrompt,
        model
      );

      await this.store.updateJob(jobId, {
        status: 'completed',
        finalResult: synthesisResult.text,
        completedAt: Date.now(),
      });

      this.emit({ type: 'synthesis_completed', jobId });
      this.emit({
        type: 'job_completed',
        jobId,
        finalResult: synthesisResult.text,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      await this.store.updateJob(jobId, {
        status: 'failed',
        completedAt: Date.now(),
      });
      this.emit({ type: 'job_failed', jobId, error: errorMsg });
    }

    return jobId;
  }

  /**
   * Get the current status of a swarm job.
   */
  async getStatus(jobId: string): Promise<{
    job: SwarmJob | null;
    subTasks: SubTask[];
    results: SubTaskResult[];
    summary: ReturnType<typeof ResultAggregator.getSummary>;
  }> {
    const job = await this.store.getJob(jobId);
    const subTasks = await this.store.getSubTasks(jobId);
    const results = await this.store.getResults(jobId);
    const summary = ResultAggregator.getSummary(results);

    return { job, subTasks, results, summary };
  }

  // ----- Internal: Parallel Execution -----

  private async executeSubTasks(
    subTasks: SubTask[],
    jobId: string,
    executor: SubAgentExecutor,
    instructions: string,
    model: string,
    maxConcurrent: number
  ): Promise<void> {
    // Create a queue of tasks to process
    const taskQueue = [...subTasks];
    const activeTasks: Promise<void>[] = [];
    let completedCount = 0;
    let failedCount = 0;

    const processTask = async (subTask: SubTask): Promise<void> => {
      let currentTask = subTask;
      let attempts = 0;

      while (attempts <= currentTask.maxRetries) {
        // Update status to running
        await this.store.updateSubTask(currentTask.id, {
          status: 'running',
          startedAt: Date.now(),
          workerId: `worker-${Math.random().toString(36).substring(2, 8)}`,
        });
        this.emit({ type: 'subtask_started', subTask: currentTask });

        // Execute
        const result = await SubTaskRunner.run(
          currentTask,
          executor,
          instructions,
          model
        );

        if (result.result !== undefined) {
          // Success
          await this.store.updateSubTask(currentTask.id, {
            status: 'success',
            completedAt: Date.now(),
          });
          await this.store.storeResult(result);
          completedCount++;
          await this.store.updateJob(jobId, { completedTasks: completedCount });
          this.emit({
            type: 'subtask_completed',
            subTaskId: currentTask.id,
            result,
          });
          return;
        }

        // Failure
        attempts++;
        const isTimeout = result.error?.includes('Timed out');
        const willRetry = attempts <= currentTask.maxRetries;

        if (isTimeout) {
          await this.store.updateSubTask(currentTask.id, {
            status: 'timed_out',
            retryCount: attempts,
          });
          this.emit({
            type: 'subtask_timed_out',
            subTaskId: currentTask.id,
            willRetry,
          });
        } else {
          await this.store.updateSubTask(currentTask.id, {
            status: 'failed',
            retryCount: attempts,
          });
          this.emit({
            type: 'subtask_failed',
            subTaskId: currentTask.id,
            error: result.error || 'Unknown error',
            willRetry,
          });
        }

        if (!willRetry) {
          // Store the error result
          await this.store.storeResult(result);
          failedCount++;
          await this.store.updateJob(jobId, { failedTasks: failedCount });
          return;
        }

        // Wait before retry (exponential backoff)
        const backoffMs = 5000 * Math.pow(2, attempts - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));

        // Update task for retry
        currentTask = {
          ...currentTask,
          retryCount: attempts,
          status: 'queued',
        };
        await this.store.updateSubTask(currentTask.id, {
          status: 'queued',
          queuedAt: Date.now(),
        });
      }
    };

    // Process tasks with concurrency limit
    const semaphore = new Semaphore(maxConcurrent);

    const promises = taskQueue.map((task) =>
      semaphore.acquire().then(async () => {
        try {
          await processTask(task);
        } finally {
          semaphore.release();
        }
      })
    );

    await Promise.allSettled(promises);
  }

  // ----- Internal: Events -----

  private emit(event: SwarmEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((err) =>
            console.error('[SwarmOrchestrator] Event handler error:', err)
          );
        }
      } catch (err) {
        console.error('[SwarmOrchestrator] Event handler error:', err);
      }
    }
  }
}

// =====================================================
// Semaphore (Concurrency Control)
// =====================================================

/**
 * A simple counting semaphore for concurrency control.
 */
class Semaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}

// =====================================================
// In-Memory State Store (for testing)
// =====================================================

/**
 * In-memory implementation of SwarmStateStore for testing.
 */
export class InMemorySwarmStore implements SwarmStateStore {
  private jobs: Map<string, SwarmJob> = new Map();
  private subTasks: Map<string, SubTask> = new Map();
  private results: Map<string, SubTaskResult> = new Map();

  async createJob(job: SwarmJob): Promise<void> {
    this.jobs.set(job.id, { ...job });
  }

  async updateJob(id: string, updates: Partial<SwarmJob>): Promise<void> {
    const job = this.jobs.get(id);
    if (job) {
      this.jobs.set(id, { ...job, ...updates });
    }
  }

  async getJob(id: string): Promise<SwarmJob | null> {
    return this.jobs.get(id) || null;
  }

  async createSubTasks(subTasks: SubTask[]): Promise<void> {
    for (const st of subTasks) {
      this.subTasks.set(st.id, { ...st });
    }
  }

  async updateSubTask(id: string, updates: Partial<SubTask>): Promise<void> {
    const st = this.subTasks.get(id);
    if (st) {
      this.subTasks.set(id, { ...st, ...updates });
    }
  }

  async getSubTasks(swarmJobId: string): Promise<SubTask[]> {
    return Array.from(this.subTasks.values()).filter(
      (st) => st.swarmJobId === swarmJobId
    );
  }

  async storeResult(result: SubTaskResult): Promise<void> {
    this.results.set(result.id, { ...result });
  }

  async getResults(swarmJobId: string): Promise<SubTaskResult[]> {
    return Array.from(this.results.values()).filter(
      (r) => r.swarmJobId === swarmJobId
    );
  }

  /** Clear all data (for test cleanup). */
  clear(): void {
    this.jobs.clear();
    this.subTasks.clear();
    this.results.clear();
  }
}

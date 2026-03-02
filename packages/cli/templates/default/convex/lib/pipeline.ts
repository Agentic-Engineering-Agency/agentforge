"use node";

/**
 * AgentPipeline — Multi-agent workflow orchestration.
 * Execute agents in sequence, passing output from one to the next.
 *
 * NOTE: Copied from @agentforge-ai/core to avoid bundling issues with
 * Node.js dependencies in the workspace package.
 */

export interface PipelineStep {
  /** Step name for logging/history */
  name: string;
  /**
   * Execute the step.
   * @param previousResult - Output from previous step (or initial input for first step)
   * @param context - Optional context object (userId, traceId, etc.)
   * @returns Step output (passed to next step)
   */
  execute: (
    previousResult?: string,
    context?: Record<string, unknown>
  ) => Promise<string>;
}

export interface PipelineHistoryEntry {
  stepName: string;
  input?: string;
  output: string;
  timestamp: number;
  duration?: number;
}

export interface AgentPipelineConfig {
  /** Pipeline name */
  name: string;
  /** Initial steps to add */
  steps?: PipelineStep[];
  /** Optional context object available to all steps */
  context?: Record<string, unknown>;
}

/**
 * AgentPipeline — Execute agents/steps in sequence.
 */
export class AgentPipeline {
  public readonly name: string;
  private readonly steps: PipelineStep[] = [];
  private readonly context?: Record<string, unknown>;
  private history: PipelineHistoryEntry[] = [];

  constructor(config: AgentPipelineConfig) {
    this.name = config.name;
    this.context = config.context;

    // Add initial steps if provided
    if (config.steps) {
      for (const step of config.steps) {
        this.addStep(step);
      }
    }
  }

  /**
   * Add a step to the pipeline.
   */
  addStep(step: PipelineStep): this {
    this.steps.push(step);
    return this;
  }

  /**
   * Add multiple parallel steps (executed with Promise.all).
   * The results are combined with newline separators.
   */
  addParallelSteps(steps: PipelineStep[]): this {
    this.addStep({
      name: `parallel-${steps.length}`,
      execute: async (prev, ctx) => {
        const results = await Promise.all(
          steps.map((step) => step.execute(prev, ctx))
        );
        return results.join('\n');
      },
    });
    return this;
  }

  /**
   * Run the pipeline with optional initial input.
   * @param initialInput - Input for the first step (optional)
   * @returns Final output from the last step
   */
  async run(initialInput?: string): Promise<string> {
    let currentResult = initialInput;

    for (const step of this.steps) {
      const startTime = Date.now();
      try {
        const output = await step.execute(currentResult, this.context);
        const duration = Date.now() - startTime;

        this.history.push({
          stepName: step.name,
          input: currentResult,
          output,
          timestamp: startTime,
          duration,
        });

        currentResult = output;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.history.push({
          stepName: step.name,
          input: currentResult,
          output: error instanceof Error ? error.message : String(error),
          timestamp: startTime,
          duration,
        });
        throw error;
      }
    }

    return currentResult ?? '';
  }

  /**
   * Get execution history.
   */
  getHistory(): PipelineHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Clear execution history.
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get the number of steps in the pipeline.
   */
  get stepCount(): number {
    return this.steps.length;
  }
}

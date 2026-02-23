/**
 * Workflow Engine for AgentForge
 *
 * Provides utilities for building and executing Mastra workflows
 * from serialized workflow definitions stored in Convex.
 *
 * NOTE: Function-type steps use a registered handler map rather than
 * dynamic code evaluation for security. Register handlers via
 * registerFunctionHandler() before executing workflows that use them.
 */
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// ─── Registered Function Handlers ────────────────────────────────────────────

type StepHandler = (
  inputData: Record<string, unknown>,
  resumeData?: Record<string, unknown>
) => Promise<Record<string, unknown>>;

const _registeredHandlers: Map<string, StepHandler> = new Map();

/**
 * Register a named function handler for use in "function" type workflow steps.
 * The handlerName must match the stepDef.config.handlerName value.
 */
export function registerFunctionHandler(handlerName: string, handler: StepHandler): void {
  _registeredHandlers.set(handlerName, handler);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StepDefinition {
  id: string;
  name: string;
  type: "agent" | "function" | "condition";
  config: Record<string, unknown>;
  // For agent steps:     agentId, promptTemplate
  // For function steps:  handlerName (must be registered via registerFunctionHandler)
  // For condition steps: branches: Array<{ condition: "truthy" | "falsy" | "always", stepId }>
}

export interface WorkflowDefinitionData {
  id: string;
  name: string;
  description?: string;
  steps: StepDefinition[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  success: boolean;
  status: "completed" | "failed" | "suspended";
  output?: Record<string, unknown>;
  error?: string;
  suspendedAtStep?: string;
  suspendPayload?: Record<string, unknown>;
  runId?: string;
}

// ─── Suspended Run Tracking ───────────────────────────────────────────────────

export interface SuspendedRunRecord {
  runId: string;
  workflowId: string;
  suspendedAtStep: string;
  suspendPayload?: Record<string, unknown>;
  suspendedAt: number;
  /** The Mastra run object, kept in memory for resumption */
  _run: unknown;
}

const _suspendedRuns: Map<string, SuspendedRunRecord> = new Map();

/**
 * Retrieve a suspended run record by runId.
 */
export function getSuspendedRun(runId: string): SuspendedRunRecord | undefined {
  return _suspendedRuns.get(runId);
}

/**
 * List all currently suspended run IDs.
 */
export function listSuspendedRunIds(): string[] {
  return Array.from(_suspendedRuns.keys());
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parse JSON-serialized step definitions with basic validation.
 */
export function parseWorkflowDefinition(stepsJson: string): StepDefinition[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stepsJson);
  } catch {
    throw new Error(`Invalid workflow steps JSON: ${stepsJson}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Workflow steps must be a JSON array");
  }

  return parsed.map((step: unknown, index: number) => {
    if (typeof step !== "object" || step === null) {
      throw new Error(`Step at index ${index} must be an object`);
    }
    const s = step as Record<string, unknown>;

    if (typeof s.id !== "string" || !s.id) {
      throw new Error(`Step at index ${index} must have a string 'id'`);
    }
    if (typeof s.name !== "string" || !s.name) {
      throw new Error(`Step at index ${index} must have a string 'name'`);
    }
    if (s.type !== "agent" && s.type !== "function" && s.type !== "condition") {
      throw new Error(
        `Step '${s.id}' has invalid type '${String(s.type)}'. Must be 'agent', 'function', or 'condition'`
      );
    }

    return {
      id: s.id,
      name: s.name,
      type: s.type as StepDefinition["type"],
      config:
        typeof s.config === "object" && s.config !== null
          ? (s.config as Record<string, unknown>)
          : {},
    };
  });
}

// ─── Shared Zod Schemas ───────────────────────────────────────────────────────

/** Common input schema for agent steps */
const agentStepInputSchema = z.object({
  input: z.record(z.unknown()).optional(),
  prompt: z.string().optional(),
  agentId: z.string().optional(),
});

/** Common output schema for agent steps */
const agentStepOutputSchema = z.object({
  agentId: z.string().optional(),
  prompt: z.string(),
  input: z.record(z.unknown()),
});

/** Common input schema for function steps */
const functionStepInputSchema = z.object({
  input: z.record(z.unknown()).optional(),
}).passthrough();

/** Common output schema for function steps */
const functionStepOutputSchema = z.record(z.unknown());

/** Resume schema for steps that support human-in-the-loop */
const humanApprovalResumeSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
  resumedBy: z.string().optional(),
});

/** Suspend schema describing why a step suspended */
const humanApprovalSuspendSchema = z.object({
  reason: z.string(),
  requestedAt: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─── Step Builder ─────────────────────────────────────────────────────────────

/**
 * Convert a StepDefinition into a Mastra createStep() call.
 *
 * - "agent" type:    creates a step that prepares agent invocation context.
 * - "function" type: creates a step that calls a registered handler by name.
 * - "condition" type: throws — conditions are handled at the workflow level via .branch().
 *
 * Steps that have `config.requiresApproval = true` are given suspend/resume schemas
 * and will call `suspend()` on first execution until resumed with approval data.
 */
export function buildMastraStep(stepDef: StepDefinition): ReturnType<typeof createStep> {
  if (stepDef.type === "condition") {
    throw new Error(
      `Condition step '${stepDef.id}' must be handled at workflow level via .branch(), not built as a standalone step`
    );
  }

  const requiresApproval = Boolean(stepDef.config.requiresApproval);

  if (stepDef.type === "agent") {
    const agentId = stepDef.config.agentId as string | undefined;
    const promptTemplate =
      (stepDef.config.promptTemplate as string | undefined) || "{{input}}";

    if (requiresApproval) {
      return createStep({
        id: stepDef.id,
        description: stepDef.name,
        inputSchema: agentStepInputSchema,
        outputSchema: agentStepOutputSchema,
        resumeSchema: humanApprovalResumeSchema,
        suspendSchema: humanApprovalSuspendSchema,
        execute: async ({
          inputData,
          resumeData,
          suspend,
        }: {
          inputData: Record<string, unknown>;
          resumeData?: z.infer<typeof humanApprovalResumeSchema>;
          suspend: (payload: z.infer<typeof humanApprovalSuspendSchema>) => Promise<void>;
        }) => {
          if (!resumeData) {
            await suspend({
              reason: (stepDef.config.approvalReason as string | undefined) ?? "Human approval required",
              requestedAt: Date.now(),
            });
            return { agentId: agentId ?? "", prompt: "", input: inputData };
          }

          if (!resumeData.approved) {
            throw new Error(
              `Step '${stepDef.id}' was rejected: ${resumeData.reason ?? "No reason provided"}`
            );
          }

          const prompt = promptTemplate.replace(
            /\{\{(\w+)\}\}/g,
            (_, key: string) => {
              const val = inputData[key];
              return val !== undefined ? String(val) : `{{${key}}}`;
            }
          );

          return { agentId, prompt, input: inputData };
        },
      });
    }

    return createStep({
      id: stepDef.id,
      description: stepDef.name,
      inputSchema: agentStepInputSchema,
      outputSchema: agentStepOutputSchema,
      execute: async ({
        inputData,
      }: {
        inputData: Record<string, unknown>;
        resumeData?: Record<string, unknown>;
        suspend: (payload: Record<string, unknown>) => Promise<void>;
      }) => {
        // Replace {{key}} placeholders in the prompt template
        const prompt = promptTemplate.replace(
          /\{\{(\w+)\}\}/g,
          (_, key: string) => {
            const val = inputData[key];
            return val !== undefined ? String(val) : `{{${key}}}`;
          }
        );

        // Return agent invocation context. Actual LLM calls are handled by
        // Convex actions that call mastraIntegration.executeAgent.
        return { agentId, prompt, input: inputData };
      },
    });
  }

  // "function" type — call a registered handler by name
  const handlerName = stepDef.config.handlerName as string | undefined;

  if (requiresApproval) {
    return createStep({
      id: stepDef.id,
      description: stepDef.name,
      inputSchema: functionStepInputSchema,
      outputSchema: functionStepOutputSchema,
      resumeSchema: humanApprovalResumeSchema,
      suspendSchema: humanApprovalSuspendSchema,
      execute: async ({
        inputData,
        resumeData,
        suspend,
      }: {
        inputData: Record<string, unknown>;
        resumeData?: z.infer<typeof humanApprovalResumeSchema>;
        suspend: (payload: z.infer<typeof humanApprovalSuspendSchema>) => Promise<void>;
      }) => {
        if (!resumeData) {
          await suspend({
            reason: (stepDef.config.approvalReason as string | undefined) ?? "Human approval required",
            requestedAt: Date.now(),
          });
          return inputData;
        }

        if (!resumeData.approved) {
          throw new Error(
            `Step '${stepDef.id}' was rejected: ${resumeData.reason ?? "No reason provided"}`
          );
        }

        if (!handlerName) {
          return inputData;
        }

        const handler = _registeredHandlers.get(handlerName);
        if (!handler) {
          throw new Error(
            `No handler registered for function step '${stepDef.id}' (handlerName: '${handlerName}'). ` +
              `Register it with registerFunctionHandler('${handlerName}', fn) before executing the workflow.`
          );
        }

        return handler(inputData, resumeData as unknown as Record<string, unknown>);
      },
    });
  }

  return createStep({
    id: stepDef.id,
    description: stepDef.name,
    inputSchema: functionStepInputSchema,
    outputSchema: functionStepOutputSchema,
    execute: async ({
      inputData,
    }: {
      inputData: Record<string, unknown>;
      resumeData?: Record<string, unknown>;
      suspend: (payload: Record<string, unknown>) => Promise<void>;
    }) => {
      if (!handlerName) {
        // No handler configured — pass data through unchanged
        return inputData;
      }

      const handler = _registeredHandlers.get(handlerName);
      if (!handler) {
        throw new Error(
          `No handler registered for function step '${stepDef.id}' (handlerName: '${handlerName}'). ` +
            `Register it with registerFunctionHandler('${handlerName}', fn) before executing the workflow.`
        );
      }

      return handler(inputData);
    },
  });
}

// ─── Workflow Builder ─────────────────────────────────────────────────────────

/**
 * Build a complete Mastra workflow from a WorkflowDefinitionData.
 *
 * Sequential steps are chained with .then().
 * Condition steps (type === "condition") trigger .branch() on adjacent steps.
 *
 * Condition step config.branches is an array of:
 *   { mode: "truthy" | "falsy" | "always", stepId: string }
 * where mode determines when the branch fires.
 */
export function buildMastraWorkflow(definition: WorkflowDefinitionData) {
  const workflowBase = createWorkflow({
    id: definition.id,
    inputSchema: z.object({}).passthrough(),
    outputSchema: z.object({}).passthrough(),
  });

  let workflow = workflowBase as any;

  for (const stepDef of definition.steps) {
    if (stepDef.type === "condition") {
      const branches = (
        stepDef.config.branches as
          | Array<{ mode?: string; stepId: string }>
          | undefined
      ) ?? [];

      if (branches.length === 0) {
        continue;
      }

      // Build [conditionFn, mastraStep] pairs for each branch
      const branchPairs: Array<[
        (params: { inputData: Record<string, unknown> }) => Promise<boolean>,
        ReturnType<typeof createStep>
      ]> = branches.map(({ mode, stepId }) => {
        const targetStepDef = definition.steps.find(
          (s) => s.id === stepId && s.type !== "condition"
        );
        if (!targetStepDef) {
          throw new Error(
            `Branch in condition step '${stepDef.id}' references unknown or condition step '${stepId}'`
          );
        }

        const effectiveMode = mode ?? "always";
        const condFn = async ({
          inputData,
        }: {
          inputData: Record<string, unknown>;
        }): Promise<boolean> => {
          if (effectiveMode === "always") return true;
          if (effectiveMode === "truthy") return Boolean(inputData.result ?? inputData.value);
          if (effectiveMode === "falsy") return !Boolean(inputData.result ?? inputData.value);
          return true;
        };

        return [condFn, buildMastraStep(targetStepDef)];
      });

      workflow = workflow.branch(branchPairs);
    } else {
      workflow = workflow.then(buildMastraStep(stepDef));
    }
  }

  return workflow.commit();
}

// ─── Executor ─────────────────────────────────────────────────────────────────

/**
 * Build and execute a workflow, returning a normalised WorkflowExecutionResult.
 *
 * Maps Mastra run statuses to our result type and captures suspend payloads.
 * When a workflow suspends, the run is registered in _suspendedRuns so it can
 * be resumed later via resumeWorkflow().
 */
export async function executeWorkflow(
  definition: WorkflowDefinitionData,
  input: Record<string, unknown>
): Promise<WorkflowExecutionResult> {
  try {
    const workflow = buildMastraWorkflow(definition);

    const run = workflow.createRun();
    const runId = (run as any).runId ?? `run_${Date.now()}`;
    const result = await run.start({ inputData: input });

    const status = (result as any).status as string | undefined;

    if (status === "success" || status === "completed") {
      _suspendedRuns.delete(runId);
      return {
        success: true,
        status: "completed",
        output: (result as any).result as Record<string, unknown> | undefined,
        runId,
      };
    }

    if (status === "suspended") {
      const steps = (result as any).steps as
        | Record<string, { status: string; output?: unknown }>
        | undefined;

      let suspendedAtStep: string | undefined;
      let suspendPayload: Record<string, unknown> | undefined;

      if (steps) {
        for (const [stepId, stepResult] of Object.entries(steps)) {
          if ((stepResult as any).status === "suspended") {
            suspendedAtStep = stepId;
            suspendPayload = (stepResult as any).output as
              | Record<string, unknown>
              | undefined;
            break;
          }
        }
      }

      // Register the suspended run for later resumption
      if (suspendedAtStep) {
        _suspendedRuns.set(runId, {
          runId,
          workflowId: definition.id,
          suspendedAtStep,
          suspendPayload,
          suspendedAt: Date.now(),
          _run: run,
        });
      }

      return {
        success: false,
        status: "suspended",
        suspendedAtStep,
        suspendPayload,
        runId,
      };
    }

    // "failed" or unknown status
    _suspendedRuns.delete(runId);
    const error = (result as any).error;
    const errorMsg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Workflow failed with unknown status";

    return {
      success: false,
      status: "failed",
      error: errorMsg,
      runId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      status: "failed",
      error: errorMsg,
    };
  }
}

// ─── Resume ───────────────────────────────────────────────────────────────────

/**
 * Resume a previously suspended workflow run.
 *
 * Looks up the in-memory run record by runId, then calls run.resume()
 * with the given stepId and resumeData. Clears the suspended run entry
 * regardless of outcome.
 *
 * @param runId      The run ID returned by executeWorkflow()
 * @param stepId     The step to resume (must match suspendedAtStep)
 * @param resumeData Data to pass to the step's execute function as resumeData
 */
export async function resumeWorkflow(
  runId: string,
  stepId: string,
  resumeData: Record<string, unknown>
): Promise<WorkflowExecutionResult> {
  const record = _suspendedRuns.get(runId);
  if (!record) {
    return {
      success: false,
      status: "failed",
      error: `No suspended workflow run found with runId '${runId}'. It may have already been resumed or expired.`,
      runId,
    };
  }

  if (record.suspendedAtStep !== stepId) {
    return {
      success: false,
      status: "failed",
      error: `Run '${runId}' is suspended at step '${record.suspendedAtStep}', not '${stepId}'.`,
      runId,
    };
  }

  try {
    const run = record._run as any;
    const result = await run.resume({ stepId, resumeData });

    // Clean up regardless of outcome
    _suspendedRuns.delete(runId);

    const status = (result as any).status as string | undefined;

    if (status === "success" || status === "completed") {
      return {
        success: true,
        status: "completed",
        output: (result as any).result as Record<string, unknown> | undefined,
        runId,
      };
    }

    if (status === "suspended") {
      const steps = (result as any).steps as
        | Record<string, { status: string; output?: unknown }>
        | undefined;

      let suspendedAtStep: string | undefined;
      let suspendPayload: Record<string, unknown> | undefined;

      if (steps) {
        for (const [sid, stepResult] of Object.entries(steps)) {
          if ((stepResult as any).status === "suspended") {
            suspendedAtStep = sid;
            suspendPayload = (stepResult as any).output as
              | Record<string, unknown>
              | undefined;
            break;
          }
        }
      }

      // Re-register if it suspended again (e.g. multi-step approval flow)
      if (suspendedAtStep) {
        _suspendedRuns.set(runId, {
          runId,
          workflowId: record.workflowId,
          suspendedAtStep,
          suspendPayload,
          suspendedAt: Date.now(),
          _run: run,
        });
      }

      return {
        success: false,
        status: "suspended",
        suspendedAtStep,
        suspendPayload,
        runId,
      };
    }

    const error = (result as any).error;
    const errorMsg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Workflow failed after resume with unknown status";

    return {
      success: false,
      status: "failed",
      error: errorMsg,
      runId,
    };
  } catch (err: unknown) {
    _suspendedRuns.delete(runId);
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      status: "failed",
      error: errorMsg,
      runId,
    };
  }
}

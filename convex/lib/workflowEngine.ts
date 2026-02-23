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

type StepHandler = (inputData: Record<string, unknown>) => Promise<Record<string, unknown>>;

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

// ─── Step Builder ─────────────────────────────────────────────────────────────

/**
 * Convert a StepDefinition into a Mastra createStep() call.
 *
 * - "agent" type:    creates a step that prepares agent invocation context.
 * - "function" type: creates a step that calls a registered handler by name.
 * - "condition" type: throws — conditions are handled at the workflow level via .branch().
 */
export function buildMastraStep(stepDef: StepDefinition): ReturnType<typeof createStep> {
  if (stepDef.type === "condition") {
    throw new Error(
      `Condition step '${stepDef.id}' must be handled at workflow level via .branch(), not built as a standalone step`
    );
  }

  if (stepDef.type === "agent") {
    const agentId = stepDef.config.agentId as string | undefined;
    const promptTemplate =
      (stepDef.config.promptTemplate as string | undefined) || "{{input}}";

    return createStep({
      id: stepDef.id,
      description: stepDef.name,
      inputSchema: z.object({}).passthrough(),
      outputSchema: z.object({}).passthrough(),
      execute: async ({ inputData }: { inputData: Record<string, unknown> }) => {
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

  return createStep({
    id: stepDef.id,
    description: stepDef.name,
    inputSchema: z.object({}).passthrough(),
    outputSchema: z.object({}).passthrough(),
    execute: async ({ inputData }: { inputData: Record<string, unknown> }) => {
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
 */
export async function executeWorkflow(
  definition: WorkflowDefinitionData,
  input: Record<string, unknown>
): Promise<WorkflowExecutionResult> {
  try {
    const workflow = buildMastraWorkflow(definition);

    const run = workflow.createRun();
    const result = await run.start({ inputData: input });

    const status = (result as any).status as string | undefined;

    if (status === "success" || status === "completed") {
      return {
        success: true,
        status: "completed",
        output: (result as any).result as Record<string, unknown> | undefined,
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

      return {
        success: false,
        status: "suspended",
        suspendedAtStep,
        suspendPayload,
      };
    }

    // "failed" or unknown status
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

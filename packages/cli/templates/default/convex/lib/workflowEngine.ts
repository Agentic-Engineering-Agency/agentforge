"use node";

/**
 * Workflow Engine for AgentForge
 *
 * NOTE: Temporarily disabled due to @mastra/core/workflows bundling issues.
 * The Mastra workflow engine will be replaced with a custom implementation
 * that doesn't have Node.js built-in dependencies.
 *
 * For now, use convex/workflowEngine.ts which uses the local AgentPipeline.
 */

// Re-export types for compatibility
export type { PipelineStep, PipelineHistoryEntry, AgentPipelineConfig } from "./pipeline";
export { AgentPipeline } from "./pipeline";

// Workflow functions are temporarily disabled
export function parseWorkflowDefinition(_stepsJson: string): never[] {
  throw new Error("Workflow parsing temporarily disabled. Use convex/workflowEngine.ts instead.");
}

export function buildMastraWorkflow(_definition: unknown): never {
  throw new Error("Mastra workflow building temporarily disabled. Use convex/workflowEngine.ts instead.");
}

export async function executeWorkflow(
  _definition: unknown,
  _input: Record<string, unknown>
): Promise<never> {
  throw new Error("Workflow execution temporarily disabled. Use convex/workflowEngine.ts instead.");
}

export function registerFunctionHandler(_handlerName: string, _handler: unknown): void {
  // No-op for now
}

export function getSuspendedRun(_runId: string): never {
  throw new Error("Suspended runs temporarily disabled.");
}

export function listSuspendedRunIds(): never[] {
  return [];
}

export async function resumeWorkflow(
  _runId: string,
  _stepId: string,
  _resumeData: Record<string, unknown>
): Promise<never> {
  throw new Error("Workflow resume temporarily disabled.");
}

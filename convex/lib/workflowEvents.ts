/**
 * Workflow event system for AgentForge.
 * Provides structured event types for workflow lifecycle tracking,
 * auditing, and integration with external systems.
 */

// ---------------------------------------------------------------------------
// Event Types
// ---------------------------------------------------------------------------

export type WorkflowEventType =
  | "workflow.started"
  | "workflow.completed"
  | "workflow.failed"
  | "workflow.suspended"
  | "workflow.resumed"
  | "step.started"
  | "step.completed"
  | "step.failed"
  | "step.skipped";

export interface WorkflowEvent {
  /** Unique event ID */
  id: string;
  /** Event type */
  type: WorkflowEventType;
  /** Workflow run ID */
  runId: string;
  /** Workflow definition ID */
  workflowId: string;
  /** Step ID (for step-level events) */
  stepId?: string;
  /** Step name (for step-level events) */
  stepName?: string;
  /** Event timestamp (epoch ms) */
  timestamp: number;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
  /** Error message (for failure events) */
  error?: string;
  /** Input data snapshot */
  input?: Record<string, unknown>;
  /** Output data snapshot */
  output?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Event Construction
// ---------------------------------------------------------------------------

let eventCounter = 0;

/**
 * Create a structured workflow event.
 */
export function createWorkflowEvent(
  event: Omit<WorkflowEvent, "id" | "timestamp"> & {
    id?: string;
    timestamp?: number;
  }
): WorkflowEvent {
  eventCounter++;
  return {
    id: event.id ?? `wfe_${Date.now()}_${eventCounter}`,
    timestamp: event.timestamp ?? Date.now(),
    ...event,
  };
}

// ---------------------------------------------------------------------------
// Event Log Builder
// ---------------------------------------------------------------------------

export interface EventLog {
  events: WorkflowEvent[];
  runId: string;
  workflowId: string;
  startedAt?: number;
  completedAt?: number;
  status: "running" | "completed" | "failed" | "suspended";
}

/**
 * Build a summary event log string from a list of events.
 * Accepts either typed WorkflowEvent[] or generic Record<string, unknown>[].
 * Overload: when runId and workflowId are provided, returns structured EventLog.
 */
export function buildEventLog(
  events: Array<Record<string, unknown>>
): string;
export function buildEventLog(
  events: WorkflowEvent[],
  runId: string,
  workflowId: string
): EventLog;
export function buildEventLog(
  events: Array<Record<string, unknown> | WorkflowEvent>,
  runId?: string,
  workflowId?: string
): string | EventLog {
  // Single-arg form: return a formatted string log
  if (runId === undefined) {
    const sorted = [...events].sort(
      (a, b) => ((a.timestamp as number) ?? 0) - ((b.timestamp as number) ?? 0)
    );
    const lines = sorted.map((e) => {
      const ts = e.timestamp ?? 0;
      const type = (e.type as string) ?? "unknown";
      const step = e.stepId ? ` [${e.stepId}]` : "";
      const err = e.error ? ` — ${e.error}` : "";
      return `[${ts}] ${type}${step}${err}`;
    });
    return lines.join("\n");
  }

  // Three-arg form: return structured EventLog
  const typed = events as WorkflowEvent[];
  const sorted = [...typed]
    .filter((e) => e.runId === runId)
    .sort((a, b) => a.timestamp - b.timestamp);

  const started = sorted.find((e) => e.type === "workflow.started");
  const completed = sorted.find((e) => e.type === "workflow.completed");
  const failed = sorted.find((e) => e.type === "workflow.failed");
  const suspended = sorted.find((e) => e.type === "workflow.suspended");

  let status: EventLog["status"] = "running";
  if (completed) status = "completed";
  else if (failed) status = "failed";
  else if (suspended) status = "suspended";

  return {
    events: sorted,
    runId,
    workflowId: workflowId!,
    startedAt: started?.timestamp,
    completedAt: completed?.timestamp ?? failed?.timestamp,
    status,
  };
}

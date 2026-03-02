/**
 * Opik LLM Observability Tracing — AGE-19
 *
 * Provides fire-and-forget tracing utilities that send LLM call data to
 * the Opik REST API (https://www.comet.com/opik/api/v1/private/traces).
 *
 * Design decisions:
 * - Uses fetch() (Web API) so it works in both Convex V8 isolates and Node.js
 * - Uses crypto.randomUUID() (Web API) for ID generation — no external packages
 * - All functions are no-ops when tracing is disabled (no API key)
 * - sendTraceToOpik() NEVER throws — tracing failures must not affect LLM calls
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TraceConfig {
  apiKey?: string;
  projectName?: string;
  enabled: boolean;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  name: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  agentId?: string;
  threadId?: string;
  startTime: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Opik Cloud REST API base URL
// ---------------------------------------------------------------------------

const OPIK_API_BASE = "https://www.comet.com/opik/api";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize tracing configuration.
 * Returns a config with enabled=true only when an API key is provided.
 */
export function initTracing(config?: {
  apiKey?: string;
  projectName?: string;
}): TraceConfig {
  const apiKey = config?.apiKey;
  return {
    apiKey,
    projectName: config?.projectName ?? "agentforge",
    enabled: typeof apiKey === "string" && apiKey.length > 0,
  };
}

/**
 * Start a new trace span, recording the current time as startTime.
 * Returns a TraceSpan object with generated traceId and spanId.
 * When config.enabled is false, returns a minimal no-op span that is still
 * safe to pass to endTrace() and sendTraceToOpik().
 */
export function startTrace(name: string, config: TraceConfig): TraceSpan {
  return {
    traceId: crypto.randomUUID(),
    spanId: crypto.randomUUID(),
    name,
    startTime: Date.now(),
  };
}

/**
 * Complete a trace span by setting endTime.
 * Returns a new span object — does not mutate the input.
 */
export function endTrace(span: TraceSpan): TraceSpan {
  return {
    ...span,
    endTime: Date.now(),
  };
}

/**
 * Create a completed span in one call, capturing all LLM call metadata.
 * Convenience wrapper over startTrace + endTrace.
 */
export function recordSpan(params: {
  name: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  agentId?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}): TraceSpan {
  const now = Date.now();
  return {
    traceId: crypto.randomUUID(),
    spanId: crypto.randomUUID(),
    name: params.name,
    model: params.model,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    latencyMs: params.latencyMs,
    agentId: params.agentId,
    threadId: params.threadId,
    startTime: params.latencyMs !== undefined ? now - params.latencyMs : now,
    endTime: now,
    metadata: params.metadata,
  };
}

/**
 * Send a trace span to the Opik REST API.
 *
 * This function is ALWAYS fire-and-forget:
 * - If config.enabled is false (no API key), it is a silent no-op.
 * - If the HTTP call fails for any reason, the error is swallowed — tracing
 *   failures must NEVER propagate to callers or affect the LLM response flow.
 *
 * Uses the Opik REST API:
 *   POST https://www.comet.com/opik/api/v1/private/traces
 *
 * Authentication header: `authorization: <api-key>`
 */
export async function sendTraceToOpik(
  span: TraceSpan,
  config: TraceConfig
): Promise<void> {
  if (!config.enabled || !config.apiKey) {
    return;
  }

  try {
    const startIso = new Date(span.startTime).toISOString();
    const endIso = span.endTime
      ? new Date(span.endTime).toISOString()
      : new Date().toISOString();

    const body: Record<string, unknown> = {
      id: span.traceId,
      name: span.name,
      project_name: config.projectName ?? "agentforge",
      start_time: startIso,
      end_time: endIso,
      input: {
        prompt_tokens: span.inputTokens,
        model: span.model,
      },
      output: {
        completion_tokens: span.outputTokens,
      },
      metadata: {
        agentId: span.agentId,
        threadId: span.threadId,
        latencyMs: span.latencyMs,
        spanId: span.spanId,
        ...(span.metadata ?? {}),
      },
      tags: ["agentforge"],
    };

    await fetch(`${OPIK_API_BASE}/v1/private/traces`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authorization": config.apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Intentionally swallowed — tracing must never throw
  }
}

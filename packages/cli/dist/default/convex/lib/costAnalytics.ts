/**
 * Cost Analytics for AgentForge
 *
 * Provides cost computation and aggregation utilities for LLM usage tracking.
 * Pricing is per 1M tokens (input/output) in USD.
 *
 * Sources (as of Feb 2026):
 *   - Anthropic: https://www.anthropic.com/pricing
 *   - OpenAI:    https://openai.com/api/pricing
 *   - Google:    https://ai.google.dev/gemini-api/docs/pricing
 */

// ---------------------------------------------------------------------------
// Pricing map
// ---------------------------------------------------------------------------

export const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  // Anthropic
  "anthropic/claude-sonnet-4-6": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "anthropic/claude-opus-4-6":   { inputPer1M: 15.0, outputPer1M: 75.0 },
  "anthropic/claude-haiku-4-5":  { inputPer1M: 0.80, outputPer1M: 4.0 },

  // OpenAI
  "openai/gpt-4o":      { inputPer1M: 2.50, outputPer1M: 10.0 },
  "openai/gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.60 },
  "openai/gpt-4.1":     { inputPer1M: 2.00, outputPer1M: 8.0 },
  "openai/o3":          { inputPer1M: 10.0, outputPer1M: 40.0 },
  "openai/o4-mini":     { inputPer1M: 1.10, outputPer1M: 4.40 },

  // Google Gemini
  "google/gemini-3.1-pro": { inputPer1M: 1.25, outputPer1M: 5.0 },
  "google/gemini-3-flash":  { inputPer1M: 0.075, outputPer1M: 0.30 },
  "google/gemini-2.5-pro":  { inputPer1M: 1.25, outputPer1M: 10.0 },
  "google/gemini-2.0-flash": { inputPer1M: 0.10, outputPer1M: 0.40 },
};

// ---------------------------------------------------------------------------
// computeCost
// ---------------------------------------------------------------------------

/**
 * Compute the cost in USD for a single LLM call.
 *
 * @param model        - Model identifier in "provider/model-name" format
 * @param inputTokens  - Number of prompt / input tokens
 * @param outputTokens - Number of completion / output tokens
 * @returns Cost in USD. Returns 0 if the model is not in the pricing map.
 */
export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  if (inputTokens === 0 && outputTokens === 0) return 0;

  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    console.warn(`[costAnalytics] Unknown model "${model}" — cost set to 0`);
    return 0;
  }

  const inputCost  = (inputTokens  / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return inputCost + outputCost;
}

// ---------------------------------------------------------------------------
// UsageEvent type
// ---------------------------------------------------------------------------

export interface UsageEvent {
  agentId: string;
  projectId?: string;
  threadId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// aggregateUsage
// ---------------------------------------------------------------------------

export interface AggregatedUsage {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  count: number;
}

/**
 * Aggregate usage events by a given dimension.
 *
 * @param events  - Array of usage events to aggregate
 * @param groupBy - Dimension to group by: 'model' | 'agentId' | 'projectId'
 * @returns A map from group key → aggregated totals.
 *          Events with a missing groupBy field (e.g. no projectId) are bucketed
 *          under "unknown".
 */
export function aggregateUsage(
  events: UsageEvent[],
  groupBy: 'model' | 'agentId' | 'projectId',
): Record<string, AggregatedUsage> {
  const result: Record<string, AggregatedUsage> = {};

  for (const event of events) {
    const key: string = (event[groupBy] as string | undefined) ?? 'unknown';

    if (!result[key]) {
      result[key] = { totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, count: 0 };
    }

    result[key].totalCost         += event.costUsd;
    result[key].totalInputTokens  += event.inputTokens;
    result[key].totalOutputTokens += event.outputTokens;
    result[key].count             += 1;
  }

  return result;
}

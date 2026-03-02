/**
 * Mastra-compatible Scorer functions for AgentForge observability (AGE-19).
 *
 * Scorers evaluate agent responses on specific dimensions and return a
 * normalized 0-1 score with a human-readable reason.
 *
 * All scorers conform to the Mastra eval/scorer pattern:
 *   https://mastra.ai/docs/evals
 */

export interface ScorerInput {
  input: string;    // The user's input/prompt
  output: string;   // The agent's response
  context?: string; // Optional context
}

export interface ScorerResult {
  score: number;  // 0-1 scale (0 = worst, 1 = best)
  reason: string; // Human-readable explanation
}

// ---------------------------------------------------------------------------
// Scorer 1: Latency Scorer
// Normalizes request latency to a 0-1 score.
// < 1000ms = 1.0 (excellent), > 10000ms = 0.0 (unacceptable), linear between.
// ---------------------------------------------------------------------------

const LATENCY_LOWER_BOUND_MS = 1000;  // ≤ this → score 1.0
const LATENCY_UPPER_BOUND_MS = 10000; // ≥ this → score 0.0
const LATENCY_RANGE_MS = LATENCY_UPPER_BOUND_MS - LATENCY_LOWER_BOUND_MS; // 9000

export function latencyScorer(latencyMs: number): ScorerResult {
  if (latencyMs <= LATENCY_LOWER_BOUND_MS) {
    return {
      score: 1.0,
      reason: `Latency ${latencyMs}ms is at or below the ${LATENCY_LOWER_BOUND_MS}ms threshold — excellent response time.`,
    };
  }

  if (latencyMs >= LATENCY_UPPER_BOUND_MS) {
    return {
      score: 0.0,
      reason: `Latency ${latencyMs}ms exceeds the ${LATENCY_UPPER_BOUND_MS}ms ceiling — unacceptable response time.`,
    };
  }

  // Linear interpolation: score = 1 - ((latencyMs - lower) / range)
  const score = 1 - (latencyMs - LATENCY_LOWER_BOUND_MS) / LATENCY_RANGE_MS;

  return {
    score,
    reason: `Latency ${latencyMs}ms maps to score ${score.toFixed(3)} on the linear scale (${LATENCY_LOWER_BOUND_MS}ms–${LATENCY_UPPER_BOUND_MS}ms).`,
  };
}

// ---------------------------------------------------------------------------
// Scorer 2: Token Efficiency Scorer
// Measures how much useful output (by character length) is produced per
// input token consumed. Normalized to [0, 1].
//
// Heuristic: efficiency = outputLength / inputTokens
// Typical "good" ratio: ~10 chars per input token → score 1.0
// ---------------------------------------------------------------------------

const EFFICIENCY_SATURATION = 10; // chars per input token → maps to score 1.0

export function tokenEfficiencyScorer(params: {
  inputTokens: number;
  outputTokens: number;
  outputLength: number;
}): ScorerResult {
  const { inputTokens, outputTokens, outputLength } = params;

  if (inputTokens === 0) {
    return {
      score: 0,
      reason: 'Cannot compute efficiency: inputTokens is 0 (division by zero avoided).',
    };
  }

  const rawRatio = outputLength / inputTokens;
  const score = Math.min(1.0, Math.max(0.0, rawRatio / EFFICIENCY_SATURATION));

  return {
    score,
    reason: `Output ${outputLength} chars / ${inputTokens} input tokens = ${rawRatio.toFixed(2)} chars/token. ` +
      `Normalized to score ${score.toFixed(3)} (saturation at ${EFFICIENCY_SATURATION} chars/token). ` +
      `Output tokens: ${outputTokens}.`,
  };
}

// ---------------------------------------------------------------------------
// Scorer 3: Response Quality Scorer
// Heuristic-based quality assessment using response length, keyword overlap
// with the input, and structural quality signals.
//
// TODO: Upgrade to LLM-as-judge by calling an LLM to evaluate response
// quality. The current heuristic approach serves as a lightweight baseline.
//
// Scoring components (each weighted, summed to final 0-1 score):
//   - Length adequacy (0-0.4): Is the response long enough?
//   - Keyword relevance (0-0.4): Does the response address the input?
//   - Structural quality (0-0.2): Does it have sentences and coherence?
// ---------------------------------------------------------------------------

const MIN_ADEQUATE_LENGTH = 50;   // chars — below this is penalized heavily
const GOOD_LENGTH = 200;          // chars — at or above this is full length score

function computeLengthScore(outputLength: number): number {
  if (outputLength === 0) return 0;
  if (outputLength >= GOOD_LENGTH) return 1.0;
  return outputLength / GOOD_LENGTH;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3) // skip short stopwords
  );
}

function computeKeywordRelevance(input: string, output: string): number {
  const inputTokens = tokenize(input);
  const outputTokens = tokenize(output);

  if (inputTokens.size === 0) return 0.5; // no meaningful input keywords → neutral

  let overlap = 0;
  for (const token of inputTokens) {
    if (outputTokens.has(token)) overlap++;
  }

  return Math.min(1.0, overlap / inputTokens.size);
}

function computeStructuralScore(output: string): number {
  if (output.trim().length === 0) return 0;

  // Count sentences (rough heuristic via punctuation)
  const sentences = output.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const hasMeaningfulContent = sentences.length >= 1 && output.trim().length >= MIN_ADEQUATE_LENGTH;

  // Bonus for multiple sentences (indicates elaboration)
  const multiSentenceBonus = sentences.length > 1 ? 0.3 : 0;
  const baseScore = hasMeaningfulContent ? 0.7 : 0.3;

  return Math.min(1.0, baseScore + multiSentenceBonus);
}

export function responseQualityScorer(input: ScorerInput): ScorerResult {
  const { input: userInput, output, context } = input;

  const lengthScore = computeLengthScore(output.length);
  const relevanceScore = computeKeywordRelevance(userInput, output);
  const structuralScore = computeStructuralScore(output);

  // Weighted combination
  const score = Math.min(
    1.0,
    Math.max(0.0, lengthScore * 0.4 + relevanceScore * 0.4 + structuralScore * 0.2)
  );

  const contextNote = context ? ` Context was provided (${context.length} chars).` : '';

  return {
    score,
    reason:
      `Heuristic quality assessment — ` +
      `length score: ${lengthScore.toFixed(2)} (output ${output.length} chars), ` +
      `keyword relevance: ${relevanceScore.toFixed(2)}, ` +
      `structural score: ${structuralScore.toFixed(2)}.` +
      contextNote +
      ` Final weighted score: ${score.toFixed(3)}. ` +
      `(TODO: upgrade to LLM-as-judge for higher accuracy)`,
  };
}

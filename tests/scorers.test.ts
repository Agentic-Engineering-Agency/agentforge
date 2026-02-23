import { describe, it, expect, vi } from 'vitest';
import {
  latencyScorer,
  tokenEfficiencyScorer,
  responseQualityScorer,
  type ScorerInput,
  type ScorerResult,
} from '../convex/lib/scorers';

// ---------------------------------------------------------------------------
// latencyScorer tests
// ---------------------------------------------------------------------------

describe('latencyScorer', () => {
  it('latency 500ms → score close to 1.0 (below 1s threshold)', () => {
    const result = latencyScorer(500);
    expect(result.score).toBeCloseTo(1.0, 5);
  });

  it('latency 1000ms → score 1.0 (at lower boundary)', () => {
    const result = latencyScorer(1000);
    expect(result.score).toBeCloseTo(1.0, 5);
  });

  it('latency 5500ms → score ~0.5 (midpoint of linear scale)', () => {
    // Linear: score = 1 - ((5500 - 1000) / 9000) = 1 - 0.5 = 0.5
    const result = latencyScorer(5500);
    expect(result.score).toBeCloseTo(0.5, 5);
  });

  it('latency 10000ms → score 0.0 (at upper boundary)', () => {
    const result = latencyScorer(10000);
    expect(result.score).toBeCloseTo(0.0, 5);
  });

  it('latency 15000ms → score 0.0 (clamped at upper boundary)', () => {
    const result = latencyScorer(15000);
    expect(result.score).toBe(0.0);
  });

  it('latency 0ms → score 1.0 (clamped at lower boundary)', () => {
    const result = latencyScorer(0);
    expect(result.score).toBe(1.0);
  });

  it('returns reason string explaining the score', () => {
    const result = latencyScorer(3000);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('result conforms to ScorerResult shape', () => {
    const result = latencyScorer(2000);
    expect(typeof result.score).toBe('number');
    expect(typeof result.reason).toBe('string');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// tokenEfficiencyScorer tests
// ---------------------------------------------------------------------------

describe('tokenEfficiencyScorer', () => {
  it('short input, long output → high score (efficient)', () => {
    // Few input tokens, lots of output → high efficiency
    const result = tokenEfficiencyScorer({ inputTokens: 10, outputTokens: 200, outputLength: 1500 });
    expect(result.score).toBeGreaterThan(0.7);
  });

  it('long input, short output → low score (inefficient)', () => {
    // Many input tokens, tiny output → low efficiency
    const result = tokenEfficiencyScorer({ inputTokens: 500, outputTokens: 20, outputLength: 50 });
    expect(result.score).toBeLessThan(0.3);
  });

  it('equal input and output tokens → medium score', () => {
    const result = tokenEfficiencyScorer({ inputTokens: 100, outputTokens: 100, outputLength: 400 });
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('zero input tokens → score 0 (avoid division by zero)', () => {
    const result = tokenEfficiencyScorer({ inputTokens: 0, outputTokens: 100, outputLength: 500 });
    expect(result.score).toBe(0);
  });

  it('returns reason string', () => {
    const result = tokenEfficiencyScorer({ inputTokens: 50, outputTokens: 100, outputLength: 400 });
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('score is always clamped to [0, 1]', () => {
    const highEfficiency = tokenEfficiencyScorer({ inputTokens: 1, outputTokens: 10000, outputLength: 50000 });
    const zeroOutput = tokenEfficiencyScorer({ inputTokens: 100, outputTokens: 0, outputLength: 0 });
    expect(highEfficiency.score).toBeLessThanOrEqual(1.0);
    expect(zeroOutput.score).toBeGreaterThanOrEqual(0.0);
  });

  it('result conforms to ScorerResult shape', () => {
    const result = tokenEfficiencyScorer({ inputTokens: 100, outputTokens: 150, outputLength: 600 });
    expect(typeof result.score).toBe('number');
    expect(typeof result.reason).toBe('string');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// responseQualityScorer tests
// ---------------------------------------------------------------------------

describe('responseQualityScorer', () => {
  it('well-formed, helpful response → returns score and reason', () => {
    const input: ScorerInput = {
      input: 'What is the capital of France?',
      output:
        'The capital of France is Paris. It is one of the most populous cities in Europe and serves as the political, economic, and cultural center of the country.',
    };
    const result = responseQualityScorer(input);
    expect(result.score).toBeGreaterThan(0.5);
    expect(typeof result.reason).toBe('string');
  });

  it('empty response → low score', () => {
    const input: ScorerInput = {
      input: 'Explain quantum entanglement.',
      output: '',
    };
    const result = responseQualityScorer(input);
    expect(result.score).toBeLessThan(0.3);
  });

  it('very short response to a complex question → low score', () => {
    const input: ScorerInput = {
      input: 'Can you explain the full history of the Roman Empire?',
      output: 'Yes.',
    };
    const result = responseQualityScorer(input);
    expect(result.score).toBeLessThan(0.5);
  });

  it('response with context → uses context in evaluation', () => {
    const input: ScorerInput = {
      input: 'What should I do next?',
      output: 'Based on the deployment context, you should run the migration scripts first.',
      context: 'User is deploying a database migration.',
    };
    const result = responseQualityScorer(input);
    expect(typeof result.score).toBe('number');
    expect(typeof result.reason).toBe('string');
  });

  it('returns { score: number, reason: string } shape', () => {
    const input: ScorerInput = {
      input: 'Hello',
      output: 'Hello! How can I help you today?',
    };
    const result = responseQualityScorer(input);
    expect(typeof result.score).toBe('number');
    expect(typeof result.reason).toBe('string');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('response that addresses the input keywords → higher score than unrelated response', () => {
    const relevantInput: ScorerInput = {
      input: 'How do I sort an array in JavaScript?',
      output:
        'You can sort an array in JavaScript using the Array.prototype.sort() method. For example: [3, 1, 2].sort() returns [1, 2, 3].',
    };
    const irrelevantInput: ScorerInput = {
      input: 'How do I sort an array in JavaScript?',
      output: 'The weather today is sunny and warm, perfect for a walk outside.',
    };
    const relevantResult = responseQualityScorer(relevantInput);
    const irrelevantResult = responseQualityScorer(irrelevantInput);
    expect(relevantResult.score).toBeGreaterThan(irrelevantResult.score);
  });
});

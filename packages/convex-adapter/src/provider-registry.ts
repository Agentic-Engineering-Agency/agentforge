/**
 * Provider Registry — Centralized LLM provider management with cost & latency tracking.
 *
 * Maintains a registry of all supported LLM providers, their models, pricing,
 * and runtime health metrics. Used by the failover chain and chat pipeline
 * to make intelligent routing decisions.
 *
 * @packageDocumentation
 */

import type { LLMProvider } from './types.js';

// =====================================================
// Types
// =====================================================

/**
 * Pricing information for a model (cost per million tokens in USD).
 */
export interface ModelPricing {
  /** Cost per million input/prompt tokens in USD */
  inputPerMillion: number;
  /** Cost per million output/completion tokens in USD */
  outputPerMillion: number;
}

/**
 * A model entry in the provider registry.
 */
export interface RegisteredModel {
  /** The model ID as used by the provider API */
  modelId: string;
  /** Human-readable display name */
  displayName: string;
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Pricing information */
  pricing: ModelPricing;
  /** Whether the model supports streaming */
  supportsStreaming: boolean;
  /** Whether the model supports tool/function calling */
  supportsTools: boolean;
}

/**
 * A provider entry in the registry.
 */
export interface RegisteredProvider {
  /** Provider identifier */
  id: LLMProvider;
  /** Human-readable name */
  name: string;
  /** Default base URL for the provider API */
  baseUrl?: string;
  /** Environment variable name for the API key */
  apiKeyEnvVar: string;
  /** Available models */
  models: RegisteredModel[];
}

/**
 * Runtime metrics for a provider/model combination.
 */
export interface ProviderMetrics {
  /** Provider ID */
  provider: LLMProvider;
  /** Model ID */
  model: string;
  /** Total requests made */
  totalRequests: number;
  /** Total successful requests */
  successfulRequests: number;
  /** Total failed requests */
  failedRequests: number;
  /** Average latency in ms */
  avgLatencyMs: number;
  /** P95 latency in ms */
  p95LatencyMs: number;
  /** Total input tokens consumed */
  totalInputTokens: number;
  /** Total output tokens consumed */
  totalOutputTokens: number;
  /** Total estimated cost in USD */
  totalCostUsd: number;
  /** Last request timestamp */
  lastRequestAt: number;
  /** Last error message (if any) */
  lastError?: string;
}

/**
 * Cost estimate for a single request.
 */
export interface CostEstimate {
  /** Provider used */
  provider: LLMProvider;
  /** Model used */
  model: string;
  /** Input token count */
  inputTokens: number;
  /** Output token count */
  outputTokens: number;
  /** Input cost in USD */
  inputCostUsd: number;
  /** Output cost in USD */
  outputCostUsd: number;
  /** Total cost in USD */
  totalCostUsd: number;
}

// =====================================================
// Default Provider Registry Data
// =====================================================

/**
 * Built-in provider registry with pricing data.
 * Pricing as of 2025 — update periodically.
 */
const DEFAULT_PROVIDERS: RegisteredProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    models: [
      {
        modelId: 'gpt-4.1',
        displayName: 'GPT-4.1',
        contextWindow: 1_048_576,
        pricing: { inputPerMillion: 2.0, outputPerMillion: 8.0 },
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        modelId: 'gpt-4.1-mini',
        displayName: 'GPT-4.1 Mini',
        contextWindow: 1_048_576,
        pricing: { inputPerMillion: 0.4, outputPerMillion: 1.6 },
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        modelId: 'gpt-4.1-nano',
        displayName: 'GPT-4.1 Nano',
        contextWindow: 1_048_576,
        pricing: { inputPerMillion: 0.1, outputPerMillion: 0.4 },
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        modelId: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128_000,
        pricing: { inputPerMillion: 2.5, outputPerMillion: 10.0 },
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        modelId: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        contextWindow: 128_000,
        pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        modelId: 'o3-mini',
        displayName: 'o3-mini',
        contextWindow: 200_000,
        pricing: { inputPerMillion: 1.1, outputPerMillion: 4.4 },
        supportsStreaming: true,
        supportsTools: true,
      },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    models: [
      {
        modelId: 'claude-sonnet-4-20250514',
        displayName: 'Claude Sonnet 4',
        contextWindow: 200_000,
        pricing: { inputPerMillion: 3.0, outputPerMillion: 15.0 },
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        modelId: 'claude-3-5-sonnet-20241022',
        displayName: 'Claude 3.5 Sonnet',
        contextWindow: 200_000,
        pricing: { inputPerMillion: 3.0, outputPerMillion: 15.0 },
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        modelId: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        contextWindow: 200_000,
        pricing: { inputPerMillion: 0.8, outputPerMillion: 4.0 },
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        modelId: 'claude-3-opus-20240229',
        displayName: 'Claude 3 Opus',
        contextWindow: 200_000,
        pricing: { inputPerMillion: 15.0, outputPerMillion: 75.0 },
        supportsStreaming: true,
        supportsTools: true,
      },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    models: [
      {
        modelId: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        contextWindow: 1_048_576,
        pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        modelId: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        contextWindow: 1_048_576,
        pricing: { inputPerMillion: 1.25, outputPerMillion: 10.0 },
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        modelId: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        contextWindow: 1_048_576,
        pricing: { inputPerMillion: 0.1, outputPerMillion: 0.4 },
        supportsStreaming: true,
        supportsTools: true,
      },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    models: [
      {
        modelId: 'openai/gpt-4.1',
        displayName: 'GPT-4.1 (via OpenRouter)',
        contextWindow: 1_048_576,
        pricing: { inputPerMillion: 2.0, outputPerMillion: 8.0 },
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        modelId: 'anthropic/claude-sonnet-4-20250514',
        displayName: 'Claude Sonnet 4 (via OpenRouter)',
        contextWindow: 200_000,
        pricing: { inputPerMillion: 3.0, outputPerMillion: 15.0 },
        supportsStreaming: true,
        supportsTools: true,
      },
      {
        modelId: 'google/gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash (via OpenRouter)',
        contextWindow: 1_048_576,
        pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
        supportsStreaming: true,
        supportsTools: true,
      },
    ],
  },
  {
    id: 'venice',
    name: 'Venice AI',
    baseUrl: 'https://api.venice.ai/api/v1',
    apiKeyEnvVar: 'VENICE_API_KEY',
    models: [
      {
        modelId: 'llama-3.3-70b',
        displayName: 'Llama 3.3 70B',
        contextWindow: 128_000,
        pricing: { inputPerMillion: 0.35, outputPerMillion: 0.4 },
        supportsStreaming: true,
        supportsTools: false,
      },
    ],
  },
];

// =====================================================
// Provider Registry Class
// =====================================================

/**
 * Centralized provider registry with runtime metrics tracking.
 *
 * Provides:
 * - Provider and model lookup
 * - Cost estimation per request
 * - Runtime latency and error tracking
 * - Health scoring for intelligent routing
 *
 * @example
 * ```typescript
 * const registry = new ProviderRegistry();
 *
 * // Estimate cost
 * const cost = registry.estimateCost('openai', 'gpt-4o', 1000, 500);
 * console.log(`Estimated cost: $${cost.totalCostUsd.toFixed(6)}`);
 *
 * // Record metrics
 * registry.recordRequest('openai', 'gpt-4o', {
 *   success: true,
 *   latencyMs: 1200,
 *   inputTokens: 1000,
 *   outputTokens: 500,
 * });
 *
 * // Get metrics
 * const metrics = registry.getMetrics('openai', 'gpt-4o');
 * ```
 */
export class ProviderRegistry {
  private providers: Map<LLMProvider, RegisteredProvider> = new Map();
  private metrics: Map<string, ProviderMetrics> = new Map();
  private latencyHistory: Map<string, number[]> = new Map();

  constructor(customProviders?: RegisteredProvider[]) {
    const providers = customProviders ?? DEFAULT_PROVIDERS;
    for (const provider of providers) {
      this.providers.set(provider.id, provider);
    }
  }

  // ─── Provider Lookup ─────────────────────────────────────────────

  /**
   * Get a registered provider by ID.
   */
  getProvider(id: LLMProvider): RegisteredProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * Get all registered providers.
   */
  getAllProviders(): RegisteredProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get a specific model from a provider.
   */
  getModel(provider: LLMProvider, modelId: string): RegisteredModel | undefined {
    const p = this.providers.get(provider);
    if (!p) return undefined;
    return p.models.find((m) => m.modelId === modelId);
  }

  /**
   * Check if a provider has an API key configured.
   */
  isProviderConfigured(provider: LLMProvider): boolean {
    const p = this.providers.get(provider);
    if (!p) return false;
    const value = typeof process !== 'undefined' ? process.env[p.apiKeyEnvVar] : undefined;
    return !!value;
  }

  /**
   * Get all configured (API key available) providers.
   */
  getConfiguredProviders(): RegisteredProvider[] {
    return this.getAllProviders().filter((p) => this.isProviderConfigured(p.id));
  }

  // ─── Cost Estimation ─────────────────────────────────────────────

  /**
   * Estimate the cost of a request.
   */
  estimateCost(
    provider: LLMProvider,
    modelId: string,
    inputTokens: number,
    outputTokens: number
  ): CostEstimate {
    const model = this.getModel(provider, modelId);
    const pricing = model?.pricing ?? { inputPerMillion: 1.0, outputPerMillion: 2.0 };

    const inputCostUsd = (inputTokens / 1_000_000) * pricing.inputPerMillion;
    const outputCostUsd = (outputTokens / 1_000_000) * pricing.outputPerMillion;

    return {
      provider,
      model: modelId,
      inputTokens,
      outputTokens,
      inputCostUsd,
      outputCostUsd,
      totalCostUsd: inputCostUsd + outputCostUsd,
    };
  }

  // ─── Runtime Metrics ─────────────────────────────────────────────

  /**
   * Record a request's metrics.
   */
  recordRequest(
    provider: LLMProvider,
    model: string,
    data: {
      success: boolean;
      latencyMs: number;
      inputTokens?: number;
      outputTokens?: number;
      error?: string;
    }
  ): void {
    const key = `${provider}/${model}`;
    const existing = this.metrics.get(key) ?? {
      provider,
      model,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      lastRequestAt: 0,
    };

    existing.totalRequests++;
    if (data.success) {
      existing.successfulRequests++;
    } else {
      existing.failedRequests++;
      existing.lastError = data.error;
    }

    // Update latency tracking
    const history = this.latencyHistory.get(key) ?? [];
    history.push(data.latencyMs);
    // Keep last 100 latency samples
    if (history.length > 100) {
      history.shift();
    }
    this.latencyHistory.set(key, history);

    // Calculate average latency
    existing.avgLatencyMs = Math.round(
      history.reduce((sum, v) => sum + v, 0) / history.length
    );

    // Calculate P95 latency
    const sorted = [...history].sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    existing.p95LatencyMs = sorted[Math.max(0, p95Index)];

    // Update token and cost tracking
    if (data.inputTokens != null && data.outputTokens != null) {
      existing.totalInputTokens += data.inputTokens;
      existing.totalOutputTokens += data.outputTokens;

      const cost = this.estimateCost(provider, model, data.inputTokens, data.outputTokens);
      existing.totalCostUsd += cost.totalCostUsd;
    }

    existing.lastRequestAt = Date.now();
    this.metrics.set(key, existing);
  }

  /**
   * Get metrics for a specific provider/model.
   */
  getMetrics(provider: LLMProvider, model: string): ProviderMetrics | undefined {
    return this.metrics.get(`${provider}/${model}`);
  }

  /**
   * Get all recorded metrics.
   */
  getAllMetrics(): ProviderMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get aggregated metrics by provider.
   */
  getMetricsByProvider(): Map<LLMProvider, {
    totalRequests: number;
    successRate: number;
    avgLatencyMs: number;
    totalCostUsd: number;
  }> {
    const result = new Map<LLMProvider, {
      totalRequests: number;
      successRate: number;
      avgLatencyMs: number;
      totalCostUsd: number;
    }>();

    for (const metrics of this.metrics.values()) {
      const existing = result.get(metrics.provider) ?? {
        totalRequests: 0,
        successRate: 0,
        avgLatencyMs: 0,
        totalCostUsd: 0,
      };

      existing.totalRequests += metrics.totalRequests;
      existing.totalCostUsd += metrics.totalCostUsd;
      existing.avgLatencyMs =
        (existing.avgLatencyMs * (existing.totalRequests - metrics.totalRequests) +
          metrics.avgLatencyMs * metrics.totalRequests) /
        existing.totalRequests;
      existing.successRate =
        existing.totalRequests > 0
          ? ((existing.totalRequests - metrics.failedRequests) / existing.totalRequests)
          : 0;

      result.set(metrics.provider, existing);
    }

    return result;
  }

  /**
   * Calculate a health score (0-1) for a provider/model based on recent metrics.
   * Higher is better. Used for intelligent routing decisions.
   */
  getHealthScore(provider: LLMProvider, model: string): number {
    const metrics = this.getMetrics(provider, model);
    if (!metrics || metrics.totalRequests === 0) {
      return 1.0; // No data = assume healthy
    }

    const successRate = metrics.successfulRequests / metrics.totalRequests;
    const latencyScore = Math.max(0, 1 - metrics.avgLatencyMs / 30_000); // 30s = 0 score
    const recencyPenalty =
      Date.now() - metrics.lastRequestAt > 300_000 ? 0.1 : 0; // Stale data penalty

    return Math.max(0, Math.min(1, successRate * 0.6 + latencyScore * 0.3 - recencyPenalty));
  }

  /**
   * Reset all metrics.
   */
  resetMetrics(): void {
    this.metrics.clear();
    this.latencyHistory.clear();
  }

  /**
   * Reset metrics for a specific provider/model.
   */
  resetModelMetrics(provider: LLMProvider, model: string): void {
    const key = `${provider}/${model}`;
    this.metrics.delete(key);
    this.latencyHistory.delete(key);
  }
}

// =====================================================
// Singleton Instance
// =====================================================

/** Global provider registry instance. */
let globalRegistry: ProviderRegistry | undefined;

/**
 * Get the global provider registry instance (singleton).
 */
export function getProviderRegistry(): ProviderRegistry {
  if (!globalRegistry) {
    globalRegistry = new ProviderRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global provider registry (for testing).
 */
export function resetProviderRegistry(): void {
  globalRegistry = undefined;
}

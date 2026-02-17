/**
 * Model Failover Chain — Automatic fallback across LLM providers.
 *
 * Implements configurable failover chains with:
 * - Ordered list of model providers (primary → fallback1 → fallback2)
 * - Automatic failover on: API errors (5xx), rate limits (429), timeout, provider downtime
 * - Configurable retry policy (max retries, exponential backoff)
 * - Circuit breaker pattern for unhealthy providers
 * - Usage tracking per failover event for observability
 *
 * @packageDocumentation
 */

import type { LanguageModelV1 } from 'ai';
import { getModel, parseModelString } from './model-resolver.js';
import type { LLMProvider, ModelResolverConfig } from './types.js';

// =====================================================
// Types
// =====================================================

/**
 * A single model in the failover chain.
 */
export interface FailoverModelConfig {
  /** The LLM provider (e.g., 'openai', 'anthropic', 'google') */
  provider: LLMProvider;
  /** The model ID (e.g., 'gpt-4o', 'claude-3-opus-20240229') */
  model: string;
  /** Optional API key override for this specific model */
  apiKey?: string;
  /** Optional base URL override */
  baseUrl?: string;
  /** Optional per-model timeout in ms (overrides chain-level) */
  timeoutMs?: number;
}

/**
 * Retry policy configuration for the failover chain.
 */
export interface RetryPolicy {
  /** Maximum number of retries per model before moving to next in chain. Default: 2 */
  maxRetries?: number;
  /** Initial backoff delay in ms. Default: 1000 */
  backoffMs?: number;
  /** Backoff multiplier for exponential backoff. Default: 2 */
  backoffMultiplier?: number;
  /** Maximum backoff delay in ms. Default: 30000 */
  maxBackoffMs?: number;
}

/**
 * Circuit breaker configuration.
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit. Default: 5 */
  failureThreshold?: number;
  /** Time in ms before attempting to close the circuit (half-open state). Default: 60000 */
  resetTimeoutMs?: number;
  /** Number of successes in half-open state before fully closing. Default: 2 */
  successThreshold?: number;
}

/**
 * Full failover chain configuration.
 */
export interface FailoverChainConfig {
  /** Ordered list of models to try (primary first, then fallbacks) */
  chain: FailoverModelConfig[];
  /** Retry policy for each model in the chain */
  retryPolicy?: RetryPolicy;
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
  /** Global timeout per request in ms. Default: 30000 */
  timeoutMs?: number;
  /** Callback for failover events (for observability) */
  onFailover?: (event: FailoverEvent) => void | Promise<void>;
  /** Callback for circuit breaker state changes */
  onCircuitStateChange?: (event: CircuitStateChangeEvent) => void | Promise<void>;
}

/**
 * Failover event emitted when switching to a fallback model.
 */
export interface FailoverEvent {
  /** Timestamp of the failover */
  timestamp: number;
  /** The model that failed */
  failedModel: string;
  /** The provider that failed */
  failedProvider: LLMProvider;
  /** The model being switched to */
  nextModel: string;
  /** The provider being switched to */
  nextProvider: LLMProvider;
  /** The error that triggered the failover */
  error: string;
  /** Error category */
  errorCategory: FailoverErrorCategory;
  /** Which attempt number on the failed model */
  attemptNumber: number;
  /** Position in the failover chain (0-indexed) */
  chainPosition: number;
}

/**
 * Circuit breaker state change event.
 */
export interface CircuitStateChangeEvent {
  /** The provider whose circuit changed */
  provider: LLMProvider;
  /** The model whose circuit changed */
  model: string;
  /** Previous state */
  previousState: CircuitState;
  /** New state */
  newState: CircuitState;
  /** Timestamp */
  timestamp: number;
}

/**
 * Categories of errors that trigger failover.
 */
export type FailoverErrorCategory =
  | 'rate_limit'      // 429 Too Many Requests
  | 'server_error'    // 5xx errors
  | 'timeout'         // Request timeout
  | 'network_error'   // Connection/DNS failures
  | 'auth_error'      // 401/403
  | 'unknown';        // Other errors

/**
 * Circuit breaker states.
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Result from a failover chain execution.
 */
export interface FailoverResult<T> {
  /** The result from the successful model */
  result: T;
  /** Which model succeeded */
  model: string;
  /** Which provider succeeded */
  provider: LLMProvider;
  /** Position in the chain (0 = primary) */
  chainPosition: number;
  /** Total attempts across all models */
  totalAttempts: number;
  /** Latency in ms */
  latencyMs: number;
  /** Whether a failover occurred */
  didFailover: boolean;
  /** List of failover events that occurred */
  failoverEvents: FailoverEvent[];
}

// =====================================================
// Circuit Breaker
// =====================================================

interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastStateChange: number;
}

/**
 * In-memory circuit breaker for provider health tracking.
 */
class CircuitBreaker {
  private circuits: Map<string, CircuitBreakerState> = new Map();
  private config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeoutMs: config.resetTimeoutMs ?? 60_000,
      successThreshold: config.successThreshold ?? 2,
    };
  }

  /**
   * Get the circuit key for a provider/model combination.
   */
  private getKey(provider: LLMProvider, model: string): string {
    return `${provider}/${model}`;
  }

  /**
   * Get or create circuit state for a provider/model.
   */
  private getCircuit(provider: LLMProvider, model: string): CircuitBreakerState {
    const key = this.getKey(provider, model);
    if (!this.circuits.has(key)) {
      this.circuits.set(key, {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0,
        lastStateChange: Date.now(),
      });
    }
    return this.circuits.get(key)!;
  }

  /**
   * Check if a provider/model is available (circuit is not open).
   */
  isAvailable(provider: LLMProvider, model: string): boolean {
    const circuit = this.getCircuit(provider, model);

    if (circuit.state === 'closed') {
      return true;
    }

    if (circuit.state === 'open') {
      // Check if reset timeout has elapsed
      if (Date.now() - circuit.lastFailureTime >= this.config.resetTimeoutMs) {
        circuit.state = 'half-open';
        circuit.successCount = 0;
        circuit.lastStateChange = Date.now();
        return true;
      }
      return false;
    }

    // half-open: allow requests through
    return true;
  }

  /**
   * Record a successful request.
   */
  recordSuccess(provider: LLMProvider, model: string): CircuitState {
    const circuit = this.getCircuit(provider, model);
    const previousState = circuit.state;

    if (circuit.state === 'half-open') {
      circuit.successCount++;
      if (circuit.successCount >= this.config.successThreshold) {
        circuit.state = 'closed';
        circuit.failureCount = 0;
        circuit.successCount = 0;
        circuit.lastStateChange = Date.now();
      }
    } else if (circuit.state === 'closed') {
      // Reset failure count on success
      circuit.failureCount = 0;
    }

    return previousState !== circuit.state ? circuit.state : previousState;
  }

  /**
   * Record a failed request.
   */
  recordFailure(provider: LLMProvider, model: string): CircuitState {
    const circuit = this.getCircuit(provider, model);
    const previousState = circuit.state;

    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();

    if (circuit.state === 'half-open') {
      // Any failure in half-open goes back to open
      circuit.state = 'open';
      circuit.lastStateChange = Date.now();
    } else if (
      circuit.state === 'closed' &&
      circuit.failureCount >= this.config.failureThreshold
    ) {
      circuit.state = 'open';
      circuit.lastStateChange = Date.now();
    }

    return previousState !== circuit.state ? circuit.state : previousState;
  }

  /**
   * Get the current state of a circuit.
   */
  getState(provider: LLMProvider, model: string): CircuitState {
    return this.getCircuit(provider, model).state;
  }

  /**
   * Get all circuit states (for dashboard/monitoring).
   */
  getAllStates(): Map<string, { state: CircuitState; failureCount: number }> {
    const result = new Map<string, { state: CircuitState; failureCount: number }>();
    for (const [key, circuit] of this.circuits) {
      result.set(key, {
        state: circuit.state,
        failureCount: circuit.failureCount,
      });
    }
    return result;
  }

  /**
   * Reset a specific circuit.
   */
  reset(provider: LLMProvider, model: string): void {
    const key = this.getKey(provider, model);
    this.circuits.delete(key);
  }

  /**
   * Reset all circuits.
   */
  resetAll(): void {
    this.circuits.clear();
  }
}

// =====================================================
// Error Classification
// =====================================================

/**
 * Classify an error into a failover category.
 */
function classifyError(error: unknown): FailoverErrorCategory {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Rate limiting
    if (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('quota exceeded')
    ) {
      return 'rate_limit';
    }

    // Server errors (5xx)
    if (
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504') ||
      message.includes('internal server error') ||
      message.includes('bad gateway') ||
      message.includes('service unavailable')
    ) {
      return 'server_error';
    }

    // Timeout
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('econnreset') ||
      name.includes('timeout') ||
      name === 'aborterror'
    ) {
      return 'timeout';
    }

    // Network errors
    if (
      message.includes('enotfound') ||
      message.includes('econnrefused') ||
      message.includes('network') ||
      message.includes('dns') ||
      message.includes('fetch failed')
    ) {
      return 'network_error';
    }

    // Auth errors
    if (
      message.includes('401') ||
      message.includes('403') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('invalid api key')
    ) {
      return 'auth_error';
    }
  }

  return 'unknown';
}

/**
 * Determine if an error category should trigger failover.
 */
function shouldFailover(category: FailoverErrorCategory): boolean {
  switch (category) {
    case 'rate_limit':
    case 'server_error':
    case 'timeout':
    case 'network_error':
      return true;
    case 'auth_error':
      // Auth errors should failover — the key might be invalid for this provider
      return true;
    case 'unknown':
      // Unknown errors: failover to be safe
      return true;
    default:
      return false;
  }
}

// =====================================================
// Failover Chain
// =====================================================

/**
 * Model Failover Chain — executes operations with automatic fallback.
 *
 * @example
 * ```typescript
 * const chain = new ModelFailoverChain({
 *   chain: [
 *     { provider: 'anthropic', model: 'claude-3-opus-20240229' },
 *     { provider: 'openai', model: 'gpt-4o' },
 *     { provider: 'google', model: 'gemini-1.5-pro' },
 *   ],
 *   retryPolicy: { maxRetries: 2, backoffMs: 1000 },
 *   onFailover: (event) => console.log('Failover:', event),
 * });
 *
 * const result = await chain.execute(async (model, provider) => {
 *   return agent.generate(prompt, { model });
 * });
 * ```
 */
export class ModelFailoverChain {
  private config: FailoverChainConfig;
  private retryPolicy: Required<RetryPolicy>;
  private circuitBreaker: CircuitBreaker;
  private resolvedModels: Map<string, LanguageModelV1> = new Map();

  constructor(config: FailoverChainConfig) {
    if (!config.chain || config.chain.length === 0) {
      throw new Error('Failover chain must contain at least one model.');
    }

    this.config = config;
    this.retryPolicy = {
      maxRetries: config.retryPolicy?.maxRetries ?? 2,
      backoffMs: config.retryPolicy?.backoffMs ?? 1000,
      backoffMultiplier: config.retryPolicy?.backoffMultiplier ?? 2,
      maxBackoffMs: config.retryPolicy?.maxBackoffMs ?? 30_000,
    };
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
  }

  /**
   * Execute an operation with automatic failover across the chain.
   *
   * The callback receives the resolved LanguageModelV1 instance and provider info.
   * If the primary model fails, it automatically tries the next model in the chain.
   *
   * @param fn - The operation to execute with the model
   * @returns A FailoverResult with the operation result and metadata
   * @throws Error if all models in the chain fail
   */
  async execute<T>(
    fn: (model: LanguageModelV1, provider: LLMProvider, modelId: string) => Promise<T>
  ): Promise<FailoverResult<T>> {
    const startTime = Date.now();
    const failoverEvents: FailoverEvent[] = [];
    let totalAttempts = 0;

    for (let chainPos = 0; chainPos < this.config.chain.length; chainPos++) {
      const modelConfig = this.config.chain[chainPos];
      const modelKey = `${modelConfig.provider}/${modelConfig.model}`;

      // Check circuit breaker
      if (!this.circuitBreaker.isAvailable(modelConfig.provider, modelConfig.model)) {
        // Circuit is open — skip this model
        if (chainPos < this.config.chain.length - 1) {
          const nextConfig = this.config.chain[chainPos + 1];
          const event: FailoverEvent = {
            timestamp: Date.now(),
            failedModel: modelConfig.model,
            failedProvider: modelConfig.provider,
            nextModel: nextConfig.model,
            nextProvider: nextConfig.provider,
            error: `Circuit breaker open for ${modelKey}`,
            errorCategory: 'server_error',
            attemptNumber: 0,
            chainPosition: chainPos,
          };
          failoverEvents.push(event);
          if (this.config.onFailover) {
            await this.config.onFailover(event);
          }
        }
        continue;
      }

      // Resolve the model
      const resolvedModel = this.resolveModel(modelConfig);

      // Retry loop for this model
      for (let attempt = 0; attempt <= this.retryPolicy.maxRetries; attempt++) {
        totalAttempts++;

        try {
          // Execute with timeout
          const timeoutMs = modelConfig.timeoutMs ?? this.config.timeoutMs ?? 30_000;
          const result = await this.withTimeout(
            fn(resolvedModel, modelConfig.provider, modelConfig.model),
            timeoutMs
          );

          // Success — record it and return
          const prevState = this.circuitBreaker.recordSuccess(
            modelConfig.provider,
            modelConfig.model
          );
          const newState = this.circuitBreaker.getState(
            modelConfig.provider,
            modelConfig.model
          );

          if (prevState !== newState && this.config.onCircuitStateChange) {
            await this.config.onCircuitStateChange({
              provider: modelConfig.provider,
              model: modelConfig.model,
              previousState: prevState,
              newState,
              timestamp: Date.now(),
            });
          }

          return {
            result,
            model: modelConfig.model,
            provider: modelConfig.provider,
            chainPosition: chainPos,
            totalAttempts,
            latencyMs: Date.now() - startTime,
            didFailover: chainPos > 0,
            failoverEvents,
          };
        } catch (error) {
          const errorCategory = classifyError(error);
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          // Record failure in circuit breaker
          const prevState = this.circuitBreaker.getState(
            modelConfig.provider,
            modelConfig.model
          );
          this.circuitBreaker.recordFailure(
            modelConfig.provider,
            modelConfig.model
          );
          const newState = this.circuitBreaker.getState(
            modelConfig.provider,
            modelConfig.model
          );

          if (prevState !== newState && this.config.onCircuitStateChange) {
            await this.config.onCircuitStateChange({
              provider: modelConfig.provider,
              model: modelConfig.model,
              previousState: prevState,
              newState,
              timestamp: Date.now(),
            });
          }

          // Should we failover?
          if (!shouldFailover(errorCategory)) {
            throw error; // Non-retriable error
          }

          // If this is the last retry for this model, move to next in chain
          if (attempt === this.retryPolicy.maxRetries) {
            if (chainPos < this.config.chain.length - 1) {
              const nextConfig = this.config.chain[chainPos + 1];
              const event: FailoverEvent = {
                timestamp: Date.now(),
                failedModel: modelConfig.model,
                failedProvider: modelConfig.provider,
                nextModel: nextConfig.model,
                nextProvider: nextConfig.provider,
                error: errorMessage,
                errorCategory,
                attemptNumber: attempt + 1,
                chainPosition: chainPos,
              };
              failoverEvents.push(event);
              if (this.config.onFailover) {
                await this.config.onFailover(event);
              }
            }
            break; // Move to next model in chain
          }

          // Exponential backoff before retry
          const backoffMs = Math.min(
            this.retryPolicy.backoffMs *
              Math.pow(this.retryPolicy.backoffMultiplier, attempt),
            this.retryPolicy.maxBackoffMs
          );
          await this.sleep(backoffMs);
        }
      }
    }

    // All models exhausted
    throw new Error(
      `All models in failover chain exhausted after ${totalAttempts} total attempts. ` +
        `Chain: ${this.config.chain.map((m) => `${m.provider}/${m.model}`).join(' → ')}. ` +
        `Failover events: ${failoverEvents.length}`
    );
  }

  /**
   * Resolve a model config to a LanguageModelV1 instance (cached).
   */
  private resolveModel(config: FailoverModelConfig): LanguageModelV1 {
    const key = `${config.provider}/${config.model}`;
    if (!this.resolvedModels.has(key)) {
      const resolverConfig: ModelResolverConfig = {
        provider: config.provider,
        modelId: config.model,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
      };
      this.resolvedModels.set(key, getModel(resolverConfig));
    }
    return this.resolvedModels.get(key)!;
  }

  /**
   * Wrap a promise with a timeout.
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the current circuit breaker states for all models in the chain.
   */
  getCircuitStates(): Array<{
    provider: LLMProvider;
    model: string;
    state: CircuitState;
    isAvailable: boolean;
  }> {
    return this.config.chain.map((m) => ({
      provider: m.provider,
      model: m.model,
      state: this.circuitBreaker.getState(m.provider, m.model),
      isAvailable: this.circuitBreaker.isAvailable(m.provider, m.model),
    }));
  }

  /**
   * Reset circuit breaker for a specific model.
   */
  resetCircuit(provider: LLMProvider, model: string): void {
    this.circuitBreaker.reset(provider, model);
  }

  /**
   * Reset all circuit breakers.
   */
  resetAllCircuits(): void {
    this.circuitBreaker.resetAll();
  }

  /**
   * Get the chain configuration.
   */
  getChainConfig(): FailoverModelConfig[] {
    return [...this.config.chain];
  }
}

// =====================================================
// Factory Functions
// =====================================================

/**
 * Create a ModelFailoverChain from a simple array of model strings.
 *
 * @example
 * ```typescript
 * const chain = createFailoverChain([
 *   'anthropic/claude-3-opus-20240229',
 *   'openai/gpt-4o',
 *   'google/gemini-1.5-pro',
 * ]);
 * ```
 */
export function createFailoverChain(
  models: string[],
  options?: Omit<FailoverChainConfig, 'chain'>
): ModelFailoverChain {
  const chain: FailoverModelConfig[] = models.map((modelString) => {
    const parsed = parseModelString(modelString);
    return {
      provider: parsed.provider,
      model: parsed.modelId,
      apiKey: parsed.apiKey,
      baseUrl: parsed.baseUrl,
    };
  });

  return new ModelFailoverChain({
    ...options,
    chain,
  });
}

/**
 * Create a ModelFailoverChain from a JSON config object.
 * Useful for loading from Convex database or environment.
 *
 * @example
 * ```typescript
 * const chain = createFailoverChainFromConfig({
 *   failoverChain: [
 *     { provider: 'anthropic', model: 'claude-3-opus-20240229' },
 *     { provider: 'openai', model: 'gpt-4o' },
 *   ],
 *   retryPolicy: { maxRetries: 2, backoffMs: 1000 },
 * });
 * ```
 */
export function createFailoverChainFromConfig(config: {
  failoverChain: Array<{
    provider: string;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    timeoutMs?: number;
  }>;
  retryPolicy?: RetryPolicy;
  circuitBreaker?: CircuitBreakerConfig;
  timeoutMs?: number;
  onFailover?: (event: FailoverEvent) => void | Promise<void>;
  onCircuitStateChange?: (event: CircuitStateChangeEvent) => void | Promise<void>;
}): ModelFailoverChain {
  return new ModelFailoverChain({
    chain: config.failoverChain.map((m) => ({
      provider: m.provider as LLMProvider,
      model: m.model,
      apiKey: m.apiKey,
      baseUrl: m.baseUrl,
      timeoutMs: m.timeoutMs,
    })),
    retryPolicy: config.retryPolicy,
    circuitBreaker: config.circuitBreaker,
    timeoutMs: config.timeoutMs,
    onFailover: config.onFailover,
    onCircuitStateChange: config.onCircuitStateChange,
  });
}

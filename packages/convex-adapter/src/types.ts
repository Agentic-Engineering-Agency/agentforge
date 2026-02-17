/**
 * Shared types for the @agentforge-ai/convex-adapter package.
 *
 * @packageDocumentation
 */

import type { AgentConfig as CoreAgentConfig, AgentModel, AgentResponse, StreamChunk } from '@agentforge-ai/core';

/**
 * Minimal interface for a Convex ActionCtx.
 * Accepts any Convex action context without requiring schema-specific generated types.
 */
export interface ConvexActionCtx {
  /** Execute a Convex query from within an action. */
  runQuery: (query: any, args?: any) => Promise<any>;
  /** Execute a Convex mutation from within an action. */
  runMutation: (mutation: any, args?: any) => Promise<any>;
  /** Execute a Convex action from within an action. */
  runAction: (action: any, args?: any) => Promise<any>;
}

/**
 * Minimal interface for a Convex MutationCtx.
 * Used by ConvexVault when operating within mutations.
 */
export interface ConvexMutationCtx {
  /** The database interface for queries and writes. */
  db: {
    insert: (table: string, doc: any) => Promise<any>;
    get: (id: any) => Promise<any>;
    patch: (id: any, fields: any) => Promise<void>;
    delete: (id: any) => Promise<void>;
    query: (table: string) => any;
  };
}

/**
 * Configuration for creating a ConvexAgent.
 * Extends the core AgentConfig with Convex-specific options.
 */
export interface ConvexAgentConfig {
  /** A unique identifier for the agent. */
  id: string;
  /** A human-readable name for the agent. */
  name: string;
  /** The system prompt or instructions for the agent. */
  instructions: string;
  /**
   * The language model to use.
   * Accepts a LanguageModelV1 instance or a string model ID.
   */
  model: AgentModel;
  /** LLM provider name (e.g., "openai", "anthropic"). */
  provider?: string;
  /** Provider-specific configuration (apiKey, baseUrl, temperature, etc.). */
  providerConfig?: Record<string, unknown>;
  /** Optional: whether to track usage metrics automatically. */
  trackUsage?: boolean;
}

/**
 * Usage metrics captured from an agent generation.
 */
export interface UsageMetrics {
  /** Number of prompt tokens consumed. */
  promptTokens?: number;
  /** Number of completion tokens generated. */
  completionTokens?: number;
  /** Total tokens used. */
  totalTokens?: number;
  /** Model identifier used for the generation. */
  model?: string;
  /** Latency of the generation in milliseconds. */
  latencyMs?: number;
}

/**
 * Response from ConvexAgent.generate() including optional usage data.
 */
export interface ConvexAgentResponse extends AgentResponse {
  /** Usage metrics from the generation, if available. */
  usage?: UsageMetrics;
}

/**
 * Configuration for a persisted tool in ConvexMCPServer.
 */
export interface PersistedToolRecord {
  /** The tool name. */
  name: string;
  /** Human-readable description. */
  description?: string;
  /** Serialized JSON Schema for the input. */
  inputSchema: Record<string, unknown>;
  /** Serialized JSON Schema for the output. */
  outputSchema: Record<string, unknown>;
  /** Source/origin of the tool (e.g., "mcp-server", "user-defined"). */
  source?: string;
  /** When the tool was persisted. */
  createdAt: number;
}

/**
 * Configuration for ConvexVault encryption.
 */
export interface VaultConfig {
  /** The encryption key. If not provided, reads from VAULT_ENCRYPTION_KEY env var. */
  encryptionKey?: string;
}

/**
 * Result of an encryption operation.
 */
export interface EncryptionResult {
  /** The encrypted ciphertext in hex. */
  ciphertext: string;
  /** The initialization vector in hex. */
  iv: string;
  /** The GCM authentication tag in hex. */
  authTag: string;
}

export type { AgentModel, AgentResponse, StreamChunk, CoreAgentConfig };

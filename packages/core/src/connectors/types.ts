/**
 * @module connectors/types
 *
 * Abstract interfaces for external data source connectors.
 * Provides a unified API for querying databases, APIs, files, and vector stores.
 */

/**
 * ConnectorType - The type of external data source
 */
export enum ConnectorType {
  DATABASE = 'database',
  API = 'api',
  FILE = 'file',
  VECTOR_STORE = 'vector-store',
}

/**
 * ConnectorStatus - Current connection state
 */
export type ConnectorStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

/**
 * ConnectorResult - Return type for query operations
 */
export interface ConnectorResult {
  data: unknown[];
  metadata?: Record<string, unknown>;
  totalCount?: number;
}

/**
 * ConnectorQueryOptions - Options for querying connectors
 */
export interface ConnectorQueryOptions {
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
  timeoutMs?: number;
}

/**
 * DataConnector - Abstract interface for external data sources
 */
export interface DataConnector {
  readonly id: string;
  readonly name: string;
  readonly type: ConnectorType;
  readonly status: ConnectorStatus;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query(input: string, options?: ConnectorQueryOptions): Promise<ConnectorResult>;
  test(): Promise<{ ok: boolean; error?: string; latencyMs?: number }>;
}

/**
 * BaseDataConnector - Abstract base class for connectors
 */
export abstract class BaseDataConnector implements DataConnector {
  protected _status: ConnectorStatus = 'disconnected';

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: ConnectorType,
  ) {}

  get status(): ConnectorStatus {
    return this._status;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract query(input: string, options?: ConnectorQueryOptions): Promise<ConnectorResult>;

  /**
   * Test the connection health and measure latency.
   * Default implementation calls connect() and measures time.
   * Subclasses may override for custom health check logic.
   */
  async test(): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
    const start = Date.now();
    try {
      await this.connect();
      const latencyMs = Date.now() - start;
      return { ok: true, latencyMs };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

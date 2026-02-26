import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConnectorType,
  ConnectorStatus,
  ConnectorResult,
  ConnectorQueryOptions,
  DataConnector,
  BaseDataConnector,
} from './types';

/**
 * Mock connector implementation for testing
 */
class MockConnector extends BaseDataConnector {
  private _data: unknown[] = [];
  private _shouldFail = false;

  constructor(id: string, name: string, type: ConnectorType) {
    super(id, name, type);
  }

  async connect(): Promise<void> {
    if (this._shouldFail) {
      this._status = 'error';
      throw new Error('Connection failed');
    }
    this._status = 'connected';
  }

  async disconnect(): Promise<void> {
    this._status = 'disconnected';
    this._data = [];
  }

  async query(
    input: string,
    options?: ConnectorQueryOptions,
  ): Promise<ConnectorResult> {
    if (this._status !== 'connected') {
      throw new Error('Not connected');
    }

    let results = [...this._data];

    if (options?.filters) {
      results = results.filter((item) =>
        Object.entries(options.filters!).every(
          ([key, value]) => (item as Record<string, unknown>)[key] === value,
        ),
      );
    }

    if (options?.offset) {
      results = results.slice(options.offset);
    }

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return {
      data: results,
      totalCount: this._data.length,
      metadata: { query: input },
    };
  }

  async test(): Promise<{ ok: boolean; error?: string; latencyMs?: number }> {
    const start = Date.now();

    if (this._shouldFail) {
      return {
        ok: false,
        error: 'Connection test failed',
      };
    }

    // Simulate connection latency
    await new Promise((resolve) => setTimeout(resolve, 5));

    this._status = 'connected';

    return {
      ok: true,
      latencyMs: Date.now() - start,
    };
  }

  // Helper methods for testing
  setTestData(data: unknown[]): void {
    this._data = data;
  }

  setShouldFail(shouldFail: boolean): void {
    this._shouldFail = shouldFail;
  }
}

describe('ConnectorType', () => {
  it('should have DATABASE value', () => {
    expect(ConnectorType.DATABASE).toBe('database');
  });

  it('should have API value', () => {
    expect(ConnectorType.API).toBe('api');
  });

  it('should have FILE value', () => {
    expect(ConnectorType.FILE).toBe('file');
  });

  it('should have VECTOR_STORE value', () => {
    expect(ConnectorType.VECTOR_STORE).toBe('vector-store');
  });
});

describe('BaseDataConnector - initialization', () => {
  it('should create connector with id, name, and type', () => {
    const connector = new MockConnector(
      'test-1',
      'Test Connector',
      ConnectorType.DATABASE,
    );

    expect(connector.id).toBe('test-1');
    expect(connector.name).toBe('Test Connector');
    expect(connector.type).toBe(ConnectorType.DATABASE);
  });

  it('should start with disconnected status', () => {
    const connector = new MockConnector(
      'test-2',
      'Test Connector',
      ConnectorType.API,
    );

    expect(connector.status).toBe('disconnected');
  });
});

describe('BaseDataConnector - status transitions', () => {
  let connector: MockConnector;

  beforeEach(() => {
    connector = new MockConnector(
      'test-3',
      'Test Connector',
      ConnectorType.DATABASE,
    );
  });

  it('should transition to connected after connect()', async () => {
    await connector.connect();
    expect(connector.status).toBe('connected');
  });

  it('should transition to disconnected after disconnect()', async () => {
    await connector.connect();
    await connector.disconnect();
    expect(connector.status).toBe('disconnected');
  });

  it('should transition to error on connection failure', async () => {
    connector.setShouldFail(true);

    try {
      await connector.connect();
    } catch (e) {
      // Expected error
    }

    expect(connector.status).toBe('error');
  });
});

describe('BaseDataConnector - test() method', () => {
  let connector: MockConnector;

  beforeEach(() => {
    connector = new MockConnector(
      'test-4',
      'Test Connector',
      ConnectorType.API,
    );
  });

  it('should return ok: true and latencyMs on success', async () => {
    const result = await connector.test();

    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeDefined();
    expect(typeof result.latencyMs).toBe('number');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('should return ok: false and error message on failure', async () => {
    connector.setShouldFail(true);
    const result = await connector.test();

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toBe('Connection test failed');
  });

  it('should set status to connected after successful test', async () => {
    expect(connector.status).toBe('disconnected');
    await connector.test();
    expect(connector.status).toBe('connected');
  });
});

describe('BaseDataConnector - query() method', () => {
  let connector: MockConnector;

  beforeEach(async () => {
    connector = new MockConnector(
      'test-5',
      'Test Connector',
      ConnectorType.DATABASE,
    );
    await connector.connect();
    connector.setTestData([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ]);
  });

  it('should return data array', async () => {
    const result = await connector.query('SELECT *');

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(3);
  });

  it('should return totalCount metadata', async () => {
    const result = await connector.query('SELECT *');

    expect(result.totalCount).toBe(3);
  });

  it('should return query metadata', async () => {
    const result = await connector.query('SELECT *');

    expect(result.metadata).toBeDefined();
    expect(result.metadata?.query).toBe('SELECT *');
  });

  it('should respect limit option', async () => {
    const result = await connector.query('SELECT *', { limit: 2 });

    expect(result.data).toHaveLength(2);
  });

  it('should respect offset option', async () => {
    const result = await connector.query('SELECT *', { offset: 1 });

    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({ id: 2, name: 'Bob' });
  });

  it('should respect filters option', async () => {
    const result = await connector.query('SELECT *', {
      filters: { name: 'Bob' },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({ id: 2, name: 'Bob' });
  });

  it('should throw error when not connected', async () => {
    const disconnectedConnector = new MockConnector(
      'test-6',
      'Disconnected',
      ConnectorType.API,
    );

    await expect(
      disconnectedConnector.query('SELECT *'),
    ).rejects.toThrow('Not connected');
  });
});

describe('DataConnector interface', () => {
  it('should be implemented by BaseDataConnector', () => {
    const connector: DataConnector = new MockConnector(
      'test-7',
      'Test',
      ConnectorType.FILE,
    );

    expect(connector).toBeDefined();
    expect(connector.id).toBe('test-7');
    expect(connector.name).toBe('Test');
    expect(connector.type).toBe(ConnectorType.FILE);
  });
});

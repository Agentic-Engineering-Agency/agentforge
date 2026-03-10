# DataConnector Interface Spec

**Spec ID:** AGE-??? (pending assignment)
**Status:** SPEC
**Track:** B (Luci/Seshat)
**Owner:** luci-efe
**Created:** 2026-02-26

## Overview
Abstract interface for external data sources (databases, APIs, vector stores, files) to enable pre-cloud data integration in AgentForge. This interface provides a unified API for connecting to, querying, and testing external data sources.

## Sections

### Section A: DataConnector interface completeness
The `DataConnector` interface MUST define the following contract:

- **readonly id: string** - Unique identifier for the connector instance
- **readonly name: string** - Human-readable display name
- **readonly type: ConnectorType** - The category of data source
- **readonly status: ConnectorStatus** - Current connection state
- **connect(): Promise<void>** - Establish connection to the data source
- **disconnect(): Promise<void>** - Close connection and cleanup resources
- **query(input: string, options?: ConnectorQueryOptions): Promise<ConnectorResult>** - Execute a query against the data source
- **test(): Promise<{ ok: boolean; error?: string; latencyMs?: number }>` - Validate connectivity and measure performance

### Section B: ConnectorType enum coverage
The `ConnectorType` enum MUST include:

- **'database'** - SQL and NoSQL databases (PostgreSQL, MySQL, MongoDB, etc.)
- **'api'** - REST and GraphQL APIs (external services)
- **'file'** - File system sources (local, S3, R2, etc.)
- **'vector-store'** - Vector databases (Pinecone, Weaviate, pgvector, etc.)

### Section C: ConnectorResult shape
The `ConnectorResult` interface MUST provide:

- **data: unknown[]** - Array of result records (required)
- **metadata?: Record<string, unknown>** - Optional metadata about the query results
- **totalCount?: number** - Optional total count of available records (for pagination)

### Section D: BaseDataConnector abstract class
The `BaseDataConnector` abstract class MUST:

- Implement the `DataConnector` interface
- Provide a `protected _status: ConnectorStatus` field initialized to `'disconnected'`
- Expose the status via a public getter: `get status(): ConnectorStatus`
- Accept `id`, `name`, and `type` as constructor parameters
- Require subclass implementations of:
  - `connect()`
  - `disconnect()`
  - `query()`
  - `test()`

### Section E: test() method behavior
The `test()` method MUST:

- Return an object with:
  - **ok: boolean** - `true` if connection test succeeded, `false` otherwise
  - **error?: string** - Error message if `ok` is `false`
  - **latencyMs?: number** - Connection latency in milliseconds when successful

## Assertions (17 total)

### Section A Assertions (5)
1. `DataConnector` interface has a readonly `id` property of type string
2. `DataConnector` interface has a readonly `name` property of type string
3. `DataConnector` interface has a readonly `type` property of type ConnectorType
4. `DataConnector` interface has a readonly `status` property of type ConnectorStatus
5. `DataConnector` interface has methods: connect, disconnect, query, test

### Section B Assertions (4)
6. `ConnectorType.DATABASE` equals 'database'
7. `ConnectorType.API` equals 'api'
8. `ConnectorType.FILE` equals 'file'
9. `ConnectorType.VECTOR_STORE` equals 'vector-store'

### Section C Assertions (3)
10. `ConnectorResult` has required `data` property of type unknown[]
11. `ConnectorResult` has optional `metadata` property
12. `ConnectorResult` has optional `totalCount` property

### Section D Assertions (3)
13. `BaseDataConnector` has protected `_status` field initialized to 'disconnected'
14. `BaseDataConnector` exposes status via getter
15. `BaseDataConnector` constructor accepts id, name, type parameters

### Section E Assertions (2)
16. `test()` method returns object with `ok` boolean
17. `test()` method returns `latencyMs` number when successful

## Implementation Files
- `packages/core/src/connectors/types.ts` - Interface definitions
- `packages/core/src/connectors/index.ts` - Barrel export
- `packages/core/src/index.ts` - Public API export

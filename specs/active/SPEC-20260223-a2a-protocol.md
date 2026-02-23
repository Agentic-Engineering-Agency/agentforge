# SPEC-20260223: Agent-to-Agent (A2A) Protocol

**Status:** CODE
**Issue:** AGE-8
**Branch:** feat/AGE-8-a2a-protocol
**Created:** 2026-02-23

## Summary
Implement the Agent-to-Agent (A2A) protocol enabling agents to delegate tasks to other agents with structured context handoff, result streaming, and hierarchical orchestration.

## Requirements

### Core Module (packages/core/src/a2a/)
1. **a2a-types.ts** — Shared type definitions for A2A protocol
   - A2ATask: task delegation request with id, from, to, instruction, context, constraints
   - A2AContext: conversation context with messages, memory, metadata
   - A2AConstraints: execution limits (maxTokens, timeoutMs, maxCost)
   - A2AResult: task execution result with status, output, artifacts, usage
   - A2AArtifact: structured output (text, code, file, data)
   - A2AStreamChunk: streaming response chunks
   - A2AServerConfig: server configuration (auth, whitelist, limits)

2. **a2a-registry.ts** — Agent discovery and routing
   - Register agents with ID, endpoint URL, and capabilities
   - Resolve agent ID to endpoint URL
   - List all registered agents
   - Find agents by capability
   - Input validation on agent IDs and endpoints

3. **a2a-client.ts** — Delegating agent client
   - Send delegation tasks to other agents via HTTP
   - Support synchronous (await result) and streaming modes
   - Auto-generate task IDs via crypto.randomUUID()
   - Enforce timeout constraints
   - Input validation on task fields

4. **a2a-server.ts** — Receiving agent server
   - Handle incoming A2A tasks via fetch-compatible handler
   - Execute tasks using AgentForge Agent.generate()
   - Authentication verification (Authorization header)
   - Agent whitelist enforcement
   - Input sanitization (instruction length limits)
   - Duration tracking

5. **index.ts** — Barrel re-exports

### Agent Integration
6. Add `.delegate()` method to Agent class (packages/core/src/agent.ts)
7. Add optional `a2aRegistry` to AgentConfig

### Convex Integration
8. `a2aTasks` table in convex/schema.ts for task persistence
9. POST /a2a/task HTTP endpoint in convex/http.ts
10. GET /a2a/task status endpoint in convex/http.ts
11. convex/a2aTasks.ts mutations and queries
12. A2A config in convex/lib/configCascade.ts

### Security Requirements
- Validate agent IDs: alphanumeric + hyphens + underscores, 1-128 chars
- Limit instruction length to 10000 characters
- Require Authorization header on server endpoints
- Support agent whitelist for access control
- No task injection via instruction field

## Test Plan
- Unit tests for A2AAgentRegistry (register, resolve, list, findByCapability)
- Unit tests for A2AClient (delegate success, error, timeout, streaming)
- Unit tests for A2AServer (handleTask, createHandler, auth, whitelist)
- Integration tests for context passing and constraint enforcement
- ≥20 total test cases

## Non-Goals
- Persistent agent discovery (service mesh) — future work
- Multi-hop delegation chains — future work
- Billing/cost tracking integration — future work

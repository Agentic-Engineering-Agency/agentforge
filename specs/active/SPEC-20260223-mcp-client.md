# SPEC-20260223: MCP Client SDK

**Status:** CODE
**Issue:** AGE-9
**Branch:** feat/AGE-9-mcp-native
**Created:** 2026-02-23

## Summary
Implement a full MCP (Model Context Protocol) client SDK with stdio, HTTP, and SSE transports, enabling AgentForge agents to connect to any MCP-compliant server and invoke tools, read resources, and use prompts.

## Requirements

### Core Module (packages/core/src/mcp/)
1. **mcp-client.ts** — MCP Client with transport abstraction
   - MCPTransportConfig: Zod-validated discriminated union (stdio/http/sse)
   - MCPTransport interface: connect(), disconnect(), send(), onNotification(), isConnected()
   - StdioTransport: spawns child process, communicates via JSON-RPC over stdin/stdout
   - HttpTransport: stateless HTTP POST with timeout and abort support
   - SSETransport: Server-Sent Events with auto-reconnect, configurable intervals/max attempts
   - MCPClient class: lifecycle (connect/disconnect), protocol methods, event system
   - Protocol methods: listTools(), callTool(), listResources(), readResource(), listPrompts(), getPrompt()
   - JSON-RPC 2.0 message format with request IDs via crypto.randomUUID()
   - MCP initialize handshake with protocol version negotiation
   - Event emission: connected, disconnected, error, toolsChanged, resourcesChanged

2. **index.ts** — Barrel re-exports for MCPClient, transports, types, schemas

### Protocol Compliance
- MCP protocol version: 2024-11-05
- JSON-RPC 2.0 request/response format
- Notification handling for tools/list_changed and resources/list_changed
- Client capabilities negotiation (tools, resources, prompts)

### Security Requirements
- Validate all transport configs via Zod schemas
- Enforce request timeouts (default 30s)
- SSE reconnect limits to prevent infinite loops

## Test Plan
- Zod schema validation for all three transport configs (valid + invalid)
- MCPClient.connect() / disconnect() lifecycle
- listTools() returns MCPToolDefinition array
- callTool() sends correct JSON-RPC method and params
- listResources(), readResource(), listPrompts(), getPrompt()
- Error handling: connection refused, protocol error, timeout
- Event system: subscribe, unsubscribe, error swallowing
- ≥40 total test cases

## Non-Goals
- MCP server implementation (already exists in mcp-server.ts)
- Resource subscriptions — future work
- Sampling/completion protocol extensions — future work

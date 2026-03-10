# SPEC-20260223: MCP Dynamic Tool Loading

**Status:** CODE
**Issue:** AGE-80
**Branch:** feat/AGE-9-mcp-native
**Created:** 2026-02-23

## Summary
Implement MCPDynamicToolLoader that wraps MCP server tools as Mastra-compatible tools, enabling hot-reload of tools from any MCP server into AgentForge agents at runtime.

## Requirements

### Core Module (packages/core/src/mcp/)
1. **mcp-dynamic-tools.ts** — Dynamic tool loading and wrapping
   - MCPDynamicToolLoader class
   - loadTools(client: MCPClient): loads all tools from MCP server, wraps as Mastra tools
   - watchTools(client, onUpdate, intervalMs): polls for tool list changes, invokes callback on change
   - unloadTools(): stops watching and clears all loaded tools
   - getTools(): returns copy of currently loaded tools
   - jsonSchemaToZod(): converts JSON Schema to Zod schema for input validation
   - Tool wrapping: each MCP tool gets id (mcp_{name}), description, inputSchema, execute function
   - execute delegates to MCPClient.callTool() with the tool name and validated input

2. **index.ts** — Add MCPDynamicToolLoader export

### Mastra Integration
- Import createTool from "@mastra/core/tools"
- Each wrapped tool is a valid Mastra Tool compatible with Agent.tools
- Input validation via Zod schemas derived from MCP tool inputSchema

### Hot-Reload
- watchTools polls at configurable interval (default 5s)
- Detects added, removed, and changed tools by comparing sorted name lists
- Non-fatal polling errors (silently retries on next interval)

## Test Plan
- jsonSchemaToZod conversion for all JSON Schema types
- loadTools() wraps each MCP tool correctly
- Tool execute delegates to callTool with correct args
- watchTools() detects added/removed tools
- watchTools() does not fire when tools unchanged
- unloadTools() clears state and stops polling
- Error propagation from callTool
- ≥25 total test cases

## Non-Goals
- Tool caching/persistence — future work
- Per-tool authentication — future work
- Tool versioning — future work

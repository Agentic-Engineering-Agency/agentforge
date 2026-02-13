/**
 * @agentforge/core
 *
 * The core package for the AgentForge framework.
 * Provides agent primitives, secure sandbox execution, and MCP server capabilities.
 *
 * @packageDocumentation
 */

export { Agent } from './agent.js';
export type { AgentConfig, AgentResponse, StreamChunk } from './agent.js';

export { SandboxManager, TimeoutError, SandboxExecutionError } from './sandbox.js';
export type { SandboxConfig, SandboxRunOptions, SandboxResult } from './sandbox.js';

export { MCPServer } from './mcp-server.js';
export type { Tool, ToolSchema } from './mcp-server.js';

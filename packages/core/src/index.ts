/**
 * @agentforge-ai/core
 *
 * The core package for the AgentForge framework.
 * Provides agent primitives, secure sandbox execution, and MCP server capabilities.
 *
 * @packageDocumentation
 */

export { Agent } from './agent.js';
export type { AgentConfig, AgentModel, AgentResponse, StreamChunk } from './agent.js';

export { SandboxManager, TimeoutError, SandboxExecutionError } from './sandbox.js';
export type { SandboxConfig, SandboxRunOptions, SandboxResult } from './sandbox.js';

export { MCPServer } from './mcp-server.js';
export type { MCPServerConfig, Tool, ToolSchema } from './mcp-server.js';

export {
  BrowserSessionManager,
  BrowserActionExecutor,
  createBrowserTool,
  registerBrowserTool,
  browserActionSchema,
  browserActionResultSchema,
} from './browser-tool.js';

export type {
  BrowserAction,
  BrowserActionKind,
  BrowserActionResult,
  BrowserToolConfig,
  SnapshotNode,
} from './browser-tool.js';

export { AgentForgeWorkspace } from './workspace.js';
export type {
  LocalWorkspaceConfig,
  CloudWorkspaceConfig,
  WorkspaceToolConfig,
} from './workspace.js';

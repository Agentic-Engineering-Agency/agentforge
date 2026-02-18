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

export {
  ChannelAdapter,
  ChannelRegistry,
  MessageNormalizer,
  channelConfigSchema,
  outboundMessageSchema,
} from './channel-adapter.js';

export type {
  MediaType,
  HealthStatus,
  ConnectionState,
  ChatType,
  MediaAttachment,
  InboundMessage,
  OutboundMessage,
  MessageAction,
  SendResult,
  CallbackAction,
  ChannelCapabilities,
  ChannelConfig,
  ChannelEvent,
  ChannelEventHandler,
} from './channel-adapter.js';

export {
  SwarmOrchestrator,
  InMemorySwarmStore,
  SubTaskRunner,
  ResultAggregator,
  swarmDispatchSchema,
  subTaskInputSchema,
  DEFAULT_RESOURCE_LIMITS,
  PRO_RESOURCE_LIMITS,
  ENTERPRISE_RESOURCE_LIMITS,
} from './swarm.js';

export type {
  SwarmJobStatus,
  SubTaskStatus,
  TokenUsage,
  SwarmJob,
  SubTask,
  SubTaskResult,
  SwarmResourceLimits,
  SubAgentExecutor,
  SwarmStateStore,
  SwarmEvent,
  SwarmEventHandler,
  SwarmDispatchInput,
  SubTaskInput,
} from './swarm.js';

export { GitTool, GitToolError } from './git-tool.js';
export type {
  GitToolConfig,
  GitRepository,
  GitFileStatus,
  GitWorktreeStatus,
  GitLogEntry,
  GitBranch,
  GitDiff,
  GitStashEntry,
} from './git-tool.js';

export { AgentForgeWorkspace } from './workspace.js';
export type {
  LocalWorkspaceConfig,
  CloudWorkspaceConfig,
  WorkspaceToolConfig,
} from './workspace.js';

export { TelegramChannel, startTelegramChannel } from './channels/telegram.js';
export type { TelegramChannelConfig } from './channels/telegram.js';

export { WhatsAppChannel, startWhatsAppChannel } from './channels/whatsapp.js';
export type { WhatsAppChannelConfig } from './channels/whatsapp.js';

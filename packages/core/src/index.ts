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

export * from './sandbox/index.js';

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

export type { WorkspaceProvider, WorkspaceConfig } from './workspace.js';
export { LocalWorkspaceProvider } from './workspace.js';
export { createWorkspaceProvider } from './workspace-factory.js';

export { R2WorkspaceProvider } from './providers/r2-provider.js';
export type { R2ProviderConfig, LifecycleRule } from './providers/r2-provider.js';

export { createWorkspace } from './workspace/index.js';
export type { WorkspaceConfig as WorkspaceStorageConfig, Workspace } from './workspace/index.js';

export * from './connectors/index.js';

export { TelegramChannel, startTelegramChannel } from './channels/telegram.js';
export type { TelegramChannelConfig } from './channels/telegram.js';

export { WhatsAppChannel, startWhatsAppChannel } from './channels/whatsapp.js';
export type { WhatsAppChannelConfig } from './channels/whatsapp.js';

export * from './channels/discord/index.js';

export * from './channels/slack/index.js';

export * from './mcp/index.js';

export { MCPExecutor } from './mcp-executor.js';
export type { MCPExecutorConfig, ToolInfo } from './mcp-executor.js';

export { FailoverChain, FailoverExhaustedError } from './failover.js';
export type { ProviderConfig, FailoverChainConfig } from './failover.js';

export { A2AAgentRegistry, A2AClient, A2AServer } from './a2a/index.js';
export type {
  A2ATask,
  A2AContext,
  A2AConstraints,
  A2AResult,
  A2AArtifact,
  A2AStreamChunk,
  A2AServerConfig,
} from './a2a/index.js';

export { parseSkillManifest } from './skills/skill-parser.js';
export { discoverSkills, fetchSkillFromGitHub } from './skills/skill-discovery.js';
export type { SkillFileSystem } from './skills/skill-discovery.js';
export { skillDefinitionSchema, SkillParseError } from './skills/types.js';
export type { SkillDefinition, SkillToolDefinition } from './skills/types.js';

// ─── Bundled Skills ────────────────────────────────────────────────────────────
export {
  BundledSkillRegistry,
  bundledSkillRegistry,
  BUNDLED_SKILLS,
  WebSearchSkill,
  CalculatorSkill,
  DateTimeSkill,
  UrlFetchSkill,
  FileReaderSkill,
} from './skills/bundled-index.js';
export type { BundledSkill } from './skills/types.js';

export {
  fetchFeaturedSkills,
  searchSkills,
  getSkill,
  publishSkill,
  installFromMarketplace,
  MarketplaceError,
  marketplaceSkillSchema,
  publishSkillInputSchema,
} from './skills/marketplace-client.js';
export type { MarketplaceSkill, PublishSkillInput } from './skills/marketplace-client.js';

// ─── Voice Tools (TTS + STT) ─────────────────────────────────────────────────
export { textToSpeech, speechToText, createVoiceTool, sanitizeTtsText, DEFAULT_VOICE_CONFIG, MAX_TTS_TEXT_LENGTH, MAX_STT_FILE_SIZE } from './voice/index.js';
export type { TtsRequest, TtsResponse, SttRequest, SttResponse, VoiceConfig } from './voice/index.js';
export { ElevenLabsTTS, WebSpeechTTS, createTTSEngine } from './voice/index.js';
export type { TTSEngine, TTSEngineConfig } from './voice/index.js';

// ─── Deep Research Mode ────────────────────────────────────────────────────────
export { ResearchOrchestrator } from './research/index.js';
export type {
  ResearchConfig,
  ResearchAgentConfig,
  ResearchDepth,
  ResearchQuestion,
  ResearchFinding,
  ResearchReport,
} from './research/index.js';

// ─── Multi-Agent Workflows ───────────────────────────────────────────────────────
export { AgentPipeline } from './workflows/index.js';
export type {
  PipelineStep,
  PipelineHistoryEntry,
  AgentPipelineConfig,
} from './workflows/index.js';

// ─── SSE Streaming ─────────────────────────────────────────────────────────────
export { SSEStreamParser, streamToAsyncIterator, consumeStream } from './streaming.js';
export type { SSEChunk } from './streaming.js';

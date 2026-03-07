// Agent factory
export { createStandardAgent, type StandardAgentConfig } from './agent/create-standard-agent.js';
export {
  initStorage,
  getStorage,
  getVector,
  createStandardMemory,
  isStorageInitialized,
  DAEMON_MODEL,
  OBSERVER_MODEL,
  EMBEDDING_MODEL,
  DEFAULT_TOKEN_LIMIT,
  type StandardMemoryOptions,
} from './agent/shared.js';

// Model registry
export {
  getModel,
  getModelsByProvider,
  getActiveModels,
  getContextLimit,
  normalizeModelId,
  resolveModel,
  type ModelEntry,
} from './models/registry.js';
export {
  getProviderCatalog,
  type ProviderCatalogEntry,
} from './models/catalog.js';

// Tools
export { datetimeTool } from './tools/datetime.js';
export { webSearchTool } from './tools/web-search.js';
export { readUrlTool } from './tools/read-url.js';
export { manageNotesTool } from './tools/manage-notes.js';

// Daemon
export { AgentForgeDaemon } from './daemon/daemon.js';
export type {
  ChannelAdapter,
  AgentDefinition,
  DaemonConfig,
  WorkflowExecutionResult,
  WorkflowRunExecutor,
} from './daemon/types.js';
export { validateEnv, EnvValidationError } from './daemon/validate-env.js';
export type { ChannelConfig } from './daemon/validate-env.js';

// Channel adapters
export { HttpChannel, type HttpChannelConfig } from './channels/http.js';
export { DiscordChannel, type DiscordChannelConfig } from './channels/discord.js';
export { TelegramChannel, type TelegramChannelConfig } from './channels/telegram.js';
export {
  progressiveStream,
  splitMessage,
  formatSSEChunk,
  generateThreadId,
} from './channels/shared.js';

// Workflows
export {
  executeAgentWorkflow,
  type AgentWorkflowStepDefinition,
  type AgentWorkflowPersistence,
  type ExecuteAgentWorkflowInput,
  type ExecuteAgentWorkflowResult,
} from './workflows/agent-workflow.js';

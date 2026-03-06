// Agent factory
export { createStandardAgent, type StandardAgentConfig } from './agent/create-standard-agent.js';
export {
  initStorage,
  getStorage,
  getVector,
  createStandardMemory,
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
  type ModelEntry,
} from './models/registry.js';

// Tools
export { datetimeTool } from './tools/datetime.js';
export { webSearchTool } from './tools/web-search.js';
export { readUrlTool } from './tools/read-url.js';
export { manageNotesTool } from './tools/manage-notes.js';

// Daemon
export { AgentForgeDaemon } from './daemon/daemon.js';
export type { ChannelAdapter, AgentDefinition, DaemonConfig } from './daemon/types.js';

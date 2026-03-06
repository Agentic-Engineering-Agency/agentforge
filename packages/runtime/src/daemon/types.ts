/**
 * AgentForge Runtime Daemon Types
 *
 * Defines the configuration and interfaces for the daemon that manages
 * agent execution and channel adapters.
 */

/**
 * Definition of an agent loaded from config
 */
export interface AgentDefinition {
  /** Unique agent ID */
  id: string;
  /** Display name */
  name: string;
  /** Agent instructions */
  instructions: string;
  /** Model to use (defaults to daemon default) */
  model?: string;
  /** Description (optional) */
  description?: string;
}

/**
 * Channel adapter configuration
 */
export interface ChannelConfig {
  /** Channel type */
  type: 'http' | 'discord' | 'telegram';
  /** Whether channel is enabled */
  enabled: boolean;
  /** Default agent ID for this channel */
  defaultAgentId?: string;
  /** Port (for HTTP channel) */
  port?: number;
}

/**
 * Channels configuration
 */
export interface ChannelsConfig {
  /** HTTP/SSE channel */
  http?: { port: number };
  /** Discord bot channel */
  discord?: { enabled: boolean; defaultAgentId?: string };
  /** Telegram bot channel */
  telegram?: { enabled: boolean; defaultAgentId?: string };
}

/**
 * Daemon configuration
 */
export interface DaemonConfig {
  /** Default model for agents */
  defaultModel?: string;
  /** Database URL for Convex */
  dbUrl?: string;
  /** Convex deployment URL */
  convexUrl?: string;
  /** Convex admin key */
  convexAdminKey?: string;
  /** Channel configurations */
  channels?: ChannelsConfig;
  /** Agent definitions */
  agents?: AgentDefinition[];
  /** Development mode (verbose logging) */
  dev?: boolean;
}

/**
 * Channel adapter interface
 *
 * Channels connect the daemon to external platforms like Discord,
 * Telegram, or HTTP endpoints.
 */
export interface ChannelAdapter {
  /** Channel name for logging */
  name: string;
  /** Start the channel with access to loaded agents */
  start(agents: Map<string, any>, daemon: AgentForgeDaemon): Promise<void>;
  /** Stop the channel and cleanup resources */
  stop(): Promise<void>;
  /** Check if channel is currently running */
  isRunning(): boolean;
}

/**
 * Runtime daemon class
 *
 * Manages agent lifecycle and channel adapters.
 */
export interface AgentForgeDaemon {
  /** Load agents from configuration */
  loadAgents(agents: AgentDefinition[]): Promise<void>;
  /** Add a channel adapter */
  addChannel(adapter: ChannelAdapter): Promise<void>;
  /** Start all channels and begin serving requests */
  start(): Promise<void>;
  /** Stop all channels and cleanup */
  stop(): Promise<void>;
  /** Get a loaded agent by ID */
  getAgent(id: string): any | undefined;
  /** Get all loaded agents */
  getAgents(): Map<string, any>;
  /** Check if daemon is running */
  isRunning(): boolean;
}

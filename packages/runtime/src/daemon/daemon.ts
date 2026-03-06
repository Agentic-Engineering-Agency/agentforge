/**
 * AgentForge Daemon Implementation
 *
 * Central daemon that manages agents and coordinates channel adapters.
 * This is a persistent Node.js process (not a Convex action).
 */

import type {
  AgentDefinition,
  AgentForgeDaemon,
  ChannelAdapter,
  DaemonConfig,
} from './types.js';

/**
 * AgentForge Daemon
 *
 * Manages the lifecycle of agents and channel adapters.
 * Acts as the central coordinator for the AgentForge runtime.
 */
export class AgentForgeDaemonImpl implements AgentForgeDaemon {
  private agents: Map<string, any> = new Map();
  private channels: ChannelAdapter[] = [];
  private config: DaemonConfig;
  private running = false;
  private cleanupHandlers: (() => Promise<void>)[] = [];

  constructor(config: DaemonConfig = {}) {
    this.config = config;
  }

  /**
   * Load agents from configuration
   */
  async loadAgents(agents: AgentDefinition[]): Promise<void> {
    for (const agentDef of agents) {
      // Store agent definition - actual agent creation happens in HTTP channel
      this.agents.set(agentDef.id, agentDef);
    }
  }

  /**
   * Add a channel adapter
   */
  async addChannel(adapter: ChannelAdapter): Promise<void> {
    this.channels.push(adapter);
  }

  /**
   * Start all channels and begin serving requests
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Daemon is already running');
    }

    this.running = true;

    if (this.config.dev) {
      console.log(`[AgentForgeDaemon] Starting with ${this.agents.size} agent(s)`);
    }

    // Start all channels
    for (const channel of this.channels) {
      if (this.config.dev) {
        console.log(`[AgentForgeDaemon] Starting channel: ${channel.name}`);
      }
      await channel.start(this.agents, this);
    }

    // Register signal handlers for graceful shutdown
    this.setupSignalHandlers();
  }

  /**
   * Stop all channels and cleanup
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (this.config.dev) {
      console.log('[AgentForgeDaemon] Stopping...');
    }

    // Stop all channels in reverse order
    for (const channel of [...this.channels].reverse()) {
      if (channel.isRunning()) {
        await channel.stop();
      }
    }

    // Run cleanup handlers
    for (const handler of this.cleanupHandlers) {
      await handler();
    }

    this.running = false;
  }

  /**
   * Get a loaded agent by ID
   */
  getAgent(id: string): any | undefined {
    return this.agents.get(id);
  }

  /**
   * Get all loaded agents
   */
  getAgents(): Map<string, any> {
    return new Map(this.agents);
  }

  /**
   * Check if daemon is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Add cleanup handler
   */
  addCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n[AgentForgeDaemon] Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

/**
 * Factory function to create a daemon instance
 */
export function createDaemon(config?: DaemonConfig): AgentForgeDaemon {
  return new AgentForgeDaemonImpl(config);
}

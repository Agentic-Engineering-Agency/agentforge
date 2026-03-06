/**
 * AgentForge Configuration File
 *
 * This file defines your agents, daemon settings, and channel configuration.
 * The CLI uses this to manage your AgentForge project and runtime daemon.
 */

export default {
  name: 'my-agent-project',
  version: '1.0.0',

  /**
   * Daemon Configuration
   *
   * Settings for the AgentForge runtime daemon.
   * The daemon is started with `agentforge start` and runs as a persistent process.
   */
  daemon: {
    /** Default model for agents (format: provider/model-id) */
    defaultModel: 'moonshotai/kimi-k2.5',

    /** Database URL (for Convex connection) */
    dbUrl: process.env.CONVEX_URL || '',

    /** Development mode (verbose logging) */
    dev: false,
  },

  /**
   * Channel Configuration
   *
   * Define how the daemon connects to external platforms.
   * Channels are started when you run `agentforge start`.
   */
  channels: {
    /** HTTP/SSE channel (OpenAI-compatible /v1/chat/completions) */
    http: {
      port: 3001,
    },

    /** Discord bot channel (optional) */
    discord: {
      enabled: false,
      defaultAgentId: 'main',
      // Requires: DISCORD_BOT_TOKEN in .env.local
    },

    /** Telegram bot channel (optional) */
    telegram: {
      enabled: false,
      defaultAgentId: 'main',
      // Requires: TELEGRAM_BOT_TOKEN in .env.local
    },
  },

  /**
   * Workspace configuration — Mastra Workspace integration.
   *
   * Skills are auto-discovered from the directories listed in `skills`.
   * Each skill directory should contain a SKILL.md file following the
   * Agent Skills Specification.
   *
   * @see https://mastra.ai/docs/workspace/skills
   */
  workspace: {
    /** Base path for the workspace filesystem. */
    basePath: './workspace',
    /** Directories containing agent skills (relative to basePath). */
    skills: ['/skills'],
    /** Enable BM25 keyword search for skill discovery. */
    search: true,
    /** Paths to auto-index for search. */
    autoIndexPaths: ['/skills'],
  },

  /**
   * Model Failover Configuration
   *
   * Defines the global default failover chain and retry policy.
   * Individual agents can override these settings.
   *
   * Environment variables required:
   *   OPENROUTER_API_KEY  — OpenRouter API key (routes to all providers)
   *   OPENAI_API_KEY      — OpenAI direct API key
   *   ANTHROPIC_API_KEY   — Anthropic direct API key
   *   GEMINI_API_KEY      — Google Gemini API key
   *   VENICE_API_KEY      — Venice AI API key (optional)
   */
  failover: {
    /**
     * Global default failover chain.
     * Used when an agent does not specify its own `failoverModels`.
     * Models are tried in order: primary → fallback1 → fallback2 → ...
     */
    defaultChain: [
      { provider: 'openrouter', model: 'openai/gpt-4o-mini' },
      { provider: 'openai', model: 'gpt-4o-mini' },
      { provider: 'anthropic', model: 'claude-3-5-haiku-20241022' },
      { provider: 'google', model: 'gemini-2.0-flash' },
    ],

    /**
     * Retry policy for each model in the chain.
     */
    retryPolicy: {
      /** Max retries per model before failing over to next. */
      maxRetries: 2,
      /** Initial backoff delay in ms. */
      backoffMs: 1000,
      /** Backoff multiplier for exponential backoff. */
      backoffMultiplier: 2,
      /** Maximum backoff delay in ms. */
      maxBackoffMs: 30000,
    },

    /**
     * Circuit breaker configuration.
     * Opens the circuit (skips the provider) after repeated failures.
     */
    circuitBreaker: {
      /** Consecutive failures before opening the circuit. */
      failureThreshold: 5,
      /** Time in ms before attempting to close the circuit. */
      resetTimeoutMs: 60000,
      /** Successes in half-open state before fully closing. */
      successThreshold: 2,
    },

    /** Global timeout per LLM request in ms. */
    timeoutMs: 30000,

    /** Enable cost tracking per request. */
    trackCost: true,

    /** Enable latency monitoring. */
    trackLatency: true,
  },

  agents: [
    {
      id: 'main',
      name: 'Main Agent',
      model: 'gpt-4o-mini',
      provider: 'openai',
      instructions: `You are a helpful AI assistant.

Be polite, professional, and try to help users with their questions.
If you don't know the answer, be honest about it.`,
    },
  ],

  // Sandbox configuration for agent tool execution isolation
  sandbox: {
    // Provider: 'local' (default), 'docker', 'e2b', or 'none'
    provider: 'local',
    // Docker-specific options (only used when provider is 'docker')
    docker: {
      image: 'node:22-slim',
      resourceLimits: {
        memoryMb: 512,
        cpuShares: 512,
        networkDisabled: false,
        pidsLimit: 256,
      },
      // Timeout in seconds before auto-killing the container
      timeout: 300,
    },
  },

  // Optional: Environment variables available to all agents
  env: {
    SUPPORT_EMAIL: 'support@example.com',
    COMPANY_NAME: 'Acme Inc',
  },
};

/**
 * Discord-specific types for the AgentForge Discord channel adapter.
 *
 * @packageDocumentation
 */

// =====================================================
// Discord Adapter Configuration
// =====================================================

/**
 * Configuration for the DiscordAdapter.
 * Passed via ChannelConfig.credentials and ChannelConfig.settings.
 */
export interface DiscordAdapterConfig {
  /** Discord bot token */
  botToken: string;
  /** Application/client ID (required for slash command registration) */
  clientId?: string;
  /** Guild (server) ID for guild-scoped slash command registration. If omitted, registers globally. */
  guildId?: string;
  /** Whether to register slash commands on connect. Default: true */
  registerCommands?: boolean;
  /** Whether to respond only to @mentions in guild channels. Default: false */
  mentionOnly?: boolean;
  /** Whether to respond to DMs. Default: true */
  respondToDMs?: boolean;
  /** Rate limit: max messages per second. Default: 5 */
  rateLimitPerSecond?: number;
}

/**
 * Configuration for the DiscordChannel runner (Convex integration).
 */
export interface DiscordChannelConfig {
  /** Discord bot token from Developer Portal */
  botToken: string;
  /** Application/client ID */
  clientId?: string;
  /** Guild ID for guild-scoped commands */
  guildId?: string;
  /** Agent ID to route messages to */
  agentId: string;
  /** Convex deployment URL */
  convexUrl: string;
  /** Whether to respond only to @mentions in guild channels. Default: false */
  mentionOnly?: boolean;
  /** Whether to respond to DMs. Default: true */
  respondToDMs?: boolean;
  /** User ID for Convex operations (default: 'discord') */
  userId?: string;
  /** Log level. Default: 'info' */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// =====================================================
// Discord Slash Command Definition
// =====================================================

/**
 * Simplified slash command definition for registration.
 */
export interface DiscordSlashCommand {
  name: string;
  description: string;
}

/**
 * Discord's built-in slash commands registered by the adapter.
 */
export const DISCORD_BOT_COMMANDS: DiscordSlashCommand[] = [
  { name: 'start', description: 'Start a new conversation with the AI agent' },
  { name: 'new', description: 'Reset the current conversation thread' },
  { name: 'help', description: 'Show available commands and usage information' },
];

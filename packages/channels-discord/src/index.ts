/**
 * @agentforge-ai/channels-discord
 *
 * Discord channel adapter for AgentForge.
 * Provides a DiscordAdapter (ChannelAdapter implementation) and
 * a DiscordChannel runner for Convex integration.
 *
 * @packageDocumentation
 */

export { DiscordAdapter } from './discord-adapter.js';
export { DiscordChannel, startDiscordChannel } from './discord-channel.js';
export type { DiscordAdapterConfig, DiscordChannelConfig } from './types.js';

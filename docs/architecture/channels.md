---
title: "Channel Adapters"
description: "Configuration and usage of HTTP, Telegram, WhatsApp, Slack, and Discord channel adapters for agent messaging."
---

# Channel Adapters

AgentForge supports multiple messaging channels out of the box. All channels use a unified adapter architecture — your agent logic stays the same regardless of which channel delivers the message.

## Overview

| Channel | Package | Protocol | Features |
|---------|---------|----------|----------|
| HTTP | `@agentforge-ai/runtime` | REST + SSE | OpenAI-compatible API, Bearer auth, rate limiting |
| Telegram | `@agentforge-ai/core` | Bot API (webhook/polling) | Voice messages, media, groups |
| WhatsApp | `@agentforge-ai/core` | Cloud API (webhook) | Media, templates, voice notes |
| Slack | `@agentforge-ai/channels-slack` | Bolt.js (Socket Mode/HTTP) | Block Kit, slash commands, threads |
| Discord | `@agentforge-ai/channels-discord` | Discord.js v14 (gateway) | Embeds, slash commands, threads, DMs |

## HTTP

The HTTP channel is the primary interface for the AgentForge daemon. It exposes an OpenAI-compatible REST API for agent interaction.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (always public, no auth required) |
| GET | `/v1/agents` | List configured agents |
| POST | `/v1/chat/completions` | OpenAI-compatible chat completions (streaming + non-streaming) |
| POST | `/v1/threads` | Create a new thread |
| GET | `/v1/threads/:id/messages` | List messages in a thread |
| POST | `/api/chat` | Dashboard chat endpoint |
| GET | `/api/models` | List available models |

### Authentication

The HTTP channel uses **Bearer token authentication** when `AGENTFORGE_API_KEY` is set:

```env
AGENTFORGE_API_KEY=your-secret-api-key
```

All requests to `/v1/*` and `/api/*` routes must include the token:

```bash
curl -H "Authorization: Bearer your-secret-api-key" http://localhost:3001/v1/agents
```

The token is validated using constant-time comparison (SHA-256 + `crypto.timingSafeEqual`) to prevent timing attacks.

### Unauthenticated mode (local development)

When `AGENTFORGE_API_KEY` is **not set**, the HTTP channel runs in unauthenticated mode:

- All requests to `/v1/*` and `/api/*` are accepted without Bearer token verification
- A prominent warning is logged at startup
- The `/health` endpoint is always public regardless of auth configuration

This mode is designed for **local development only**. For any deployment accessible over a network, always set `AGENTFORGE_API_KEY`.

### Security features

- **Rate limiting**: Per-client rate limiting (by Bearer token hash or IP address)
- **CORS**: Configurable allowed origins (defaults to localhost development ports)
- **Input sanitization**: Control characters and null bytes are stripped from user messages
- **Body size limit**: 1MB maximum request body

### Configuration

```typescript
const http = new HttpChannel({
  port: 3001,                    // Default: 3001
  apiKey: 'your-secret-key',     // Default: process.env.AGENTFORGE_API_KEY
  allowedOrigins: [              // Default: localhost dev ports
    'http://localhost:3000',
    'http://localhost:5173',
  ],
});
```

---

## Telegram

The Telegram adapter is built into `@agentforge-ai/core`.

### Setup

1. Create a bot with [@BotFather](https://t.me/BotFather)
2. Add the bot token to your environment:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

3. Configure via CLI:

```bash
agentforge channel:telegram configure
```

### Webhook vs Polling

- **Polling** (default in dev): The adapter polls Telegram for updates. No public URL needed.
- **Webhook** (recommended for production): Telegram pushes updates to your server. Requires a public HTTPS URL.

```env
# For webhook mode:
TELEGRAM_WEBHOOK_URL=https://your-domain.com/api/telegram
```

### Voice message support

Telegram voice messages are automatically transcribed using the configured STT provider (Whisper) and passed to the agent as text. Requires `OPENAI_API_KEY` for Whisper.

### Media types

The adapter handles images, audio, video, documents, and voice notes. Media is downloaded, stored in the workspace, and passed to the agent as attachments.

---

## WhatsApp Cloud API

The WhatsApp adapter is built into `@agentforge-ai/core`.

### Prerequisites

1. A [Meta Business account](https://business.facebook.com)
2. A WhatsApp Business app in the [Meta Developer Portal](https://developers.facebook.com)
3. A phone number registered with WhatsApp Business API

### Setup

```env
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxx...
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_VERIFY_TOKEN=your-random-verify-string
```

Configure via CLI:

```bash
agentforge channel:whatsapp configure
```

### Webhook setup

WhatsApp requires a webhook endpoint for incoming messages:

1. In the Meta Developer Portal, go to your app → WhatsApp → Configuration
2. Set the webhook URL: `https://your-domain.com/api/whatsapp`
3. Set the verify token to match `WHATSAPP_VERIFY_TOKEN`
4. Subscribe to the `messages` webhook field

### Voice notes

WhatsApp voice notes follow the same STT pipeline as Telegram — automatically transcribed and passed to the agent.

---

## Slack

Install the Slack adapter:

```bash
pnpm add @agentforge-ai/channels-slack
```

### Prerequisites

1. A [Slack app](https://api.slack.com/apps) with Bot Token Scopes:
   - `chat:write` — Send messages
   - `app_mentions:read` — Detect @mentions
   - `channels:history` — Read channel messages
   - `im:history` — Read DMs
   - `commands` — Slash commands (optional)

2. Enable **Socket Mode** for local development (no public URL needed)

### Setup

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret
```

### Socket Mode vs HTTP Events

- **Socket Mode** (recommended for dev): Uses WebSocket connection. Requires `SLACK_APP_TOKEN`.
- **HTTP Events API** (production): Slack sends events to your public endpoint. Uses HMAC-SHA256 signature verification with `SLACK_SIGNING_SECRET`.

### Slash commands

Register slash commands in your Slack app settings, then the adapter handles them automatically. The command text is passed to the agent as the message content.

### @mentions

The adapter detects when your bot is @mentioned in a channel and routes the message to the agent. Only messages that @mention the bot or are sent in DMs trigger the agent.

### Rate limiting

The Slack adapter enforces Slack's rate limits (approximately 50 messages/second) with built-in backoff.

### Block Kit

Responses can include Block Kit rich messages for formatted output, buttons, and interactive elements.

---

## Discord

Install the Discord adapter:

```bash
pnpm add @agentforge-ai/channels-discord
```

### Prerequisites

1. A [Discord application](https://discord.com/developers/applications) with a Bot user
2. Bot permissions:
   - Send Messages
   - Read Message History
   - Use Slash Commands
   - Embed Links
   - Attach Files

3. Gateway intents:
   - `GUILDS`
   - `GUILD_MESSAGES`
   - `DIRECT_MESSAGES`
   - `MESSAGE_CONTENT` (privileged — enable in Developer Portal)

### Setup

```env
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=your-client-id
```

### Invite the bot

Generate an invite URL with the required permissions:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=274877975552&scope=bot%20applications.commands
```

### Slash commands

The adapter registers slash commands automatically. Define them in your agent configuration and they appear in Discord's command menu.

### Supported channel types

- Text channels
- DMs (direct messages)
- Threads
- Voice channels (text chat)

### Embeds

Responses can include Discord embeds for rich formatting with titles, descriptions, fields, images, and colors.

### Limits

- Max message length: 2000 characters (longer messages are split)
- Max file upload: 25 MB

---

## Unified Message Format

All channels normalize messages to a common format:

```typescript
interface InboundMessage {
  id: string;
  channel: 'telegram' | 'whatsapp' | 'slack' | 'discord';
  chatId: string;
  chatType: 'private' | 'group' | 'channel';
  userId: string;
  text: string;
  media?: {
    type: 'image' | 'audio' | 'video' | 'file' | 'voice_note';
    url: string;
    mimeType?: string;
  }[];
  threadId?: string;
  replyTo?: string;
  timestamp: Date;
}

interface OutboundMessage {
  chatId: string;
  text: string;
  media?: { type: string; url: string }[];
  replyTo?: string;
  threadId?: string;
}
```

This means your agent code doesn't need to know which channel is being used — it just processes `InboundMessage` and returns `OutboundMessage`.

## Channel Registry

Register multiple channels for a single agent:

```typescript
import { ChannelRegistry } from '@agentforge-ai/core';

const registry = new ChannelRegistry();
registry.register('telegram', telegramAdapter);
registry.register('slack', slackAdapter);
registry.register('discord', discordAdapter);
```

All registered channels receive messages and route them to the same agent pipeline.

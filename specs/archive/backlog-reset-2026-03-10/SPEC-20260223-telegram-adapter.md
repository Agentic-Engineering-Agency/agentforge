# SPEC-20260223-002: Telegram Adapter

## Status: Active
## Linear: AGE-118
## Objective: Validate Telegram Bot API adapter and high-level channel for production readiness

---

## Module Overview

This spec covers two cooperating modules:

### `packages/core/src/adapters/telegram-adapter.ts`
A low-level `ChannelAdapter` implementation for the Telegram Bot API. Handles:
- **Connection lifecycle**: `connect()` calls `getMe` to verify the bot token, then either sets a webhook (production) or starts long-polling (development).
- **Inbound message processing**: `handleWebhookUpdate()` for webhook mode; internal `poll()` loop for polling mode. Both normalize `TelegramUpdate` objects into `InboundMessage` events.
- **Outbound message sending**: `sendMessage()` routes to `sendPhoto`, `sendAudio`, `sendVoice`, `sendVideo`, `sendDocument`, or `sendMessage` depending on media type. Supports inline keyboard markup.
- **Rate limiting**: Sliding-window counter enforces Telegram's ~30 msg/s limit.
- **Media extraction**: Converts Telegram photo/audio/video/document/voice/sticker fields into `MediaAttachment[]`.
- **Group chat filtering**: `shouldIgnoreGroupMessage()` suppresses messages in group chats unless the bot is @mentioned, receives a bot command, or the message is a reply to the bot.

### `packages/core/src/channels/telegram.ts`
A high-level channel runner (`TelegramChannel`) that bridges `TelegramAdapter` with the AgentForge Convex backend:
- **Thread management**: Maps Telegram `chatId` → Convex `threadId` in memory. Creates threads lazily on first message.
- **Agent routing**: Calls `chat:sendMessage` Convex action, splits responses at 4096-char Telegram limit.
- **Voice transcription**: Downloads voice note audio, submits to OpenAI Whisper STT, routes transcribed text through the normal agent pipeline.
- **Commands**: `/start`, `/new`, `/help` are handled before routing to the agent.
- **Deduplication**: Tracks in-flight message IDs to prevent double-processing.
- **Factory function**: `startTelegramChannel()` reads env vars and wires graceful SIGINT/SIGTERM shutdown.

---

## Key Interfaces

### Exported from `telegram-adapter.ts`
| Type | Description |
|------|-------------|
| `TelegramAdapter` | Main adapter class (`extends ChannelAdapter`) |
| `TelegramAdapterConfig` | Config shape: `botToken`, `useWebhook`, `webhookUrl`, `pollingIntervalMs`, etc. |
| `TelegramUpdate` | Telegram Bot API Update object |
| `TelegramMessage` | Telegram Message object with optional media fields |
| `TelegramCallbackQuery` | Inline button callback data |
| `TelegramInlineKeyboardButton` | Single button in an inline keyboard row |

### Exported from `channels/telegram.ts`
| Type | Description |
|------|-------------|
| `TelegramChannel` | High-level channel runner class |
| `TelegramChannelConfig` | Config: `botToken`, `agentId`, `convexUrl`, optional webhook/polling settings |
| `startTelegramChannel()` | Convenience factory — reads env vars, registers shutdown hooks |

---

## Success Criteria

- [ ] Webhook mode setup and message receiving
- [ ] Polling mode setup and message receiving
- [ ] Voice message handling with STT integration
- [ ] Inline button/keyboard support
- [ ] Reaction handling (callback_query events)
- [ ] Thread/reply handling (reply_to_message)
- [ ] Rate limit handling (sliding-window, ~30 msg/s)
- [ ] Message sending (text, photo, voice, document)
- [ ] Error recovery (API errors return `SendResult.success = false`, polling emits recoverable error events)
- [ ] Group @mention filtering
- [ ] Channel connect/disconnect lifecycle
- [ ] Health check reporting
- [ ] Message deduplication in TelegramChannel
- [ ] Long message splitting at natural break points

---

## Test Plan

### Test Files
| File | Tests | Coverage |
|------|-------|----------|
| `packages/core/src/adapters/telegram-adapter.test.ts` | 24 (existing) + 6 (new) | Adapter unit tests |
| `packages/core/src/channels/telegram.test.ts` | 11 (existing) + 4 (new) | Channel integration tests |

### Test Categories

#### Adapter Tests (`telegram-adapter.test.ts`)
1. **platform identity** — `adapter.platform === 'telegram'`
2. **connect / lifecycle** — polling mode, missing token, failed `getMe`, webhook mode setup
3. **capabilities** — media types, text limit, platform-specific flags
4. **healthCheck** — healthy vs unhealthy responses
5. **sendMessage** — text, inline keyboard, photo, error cases, empty message
6. **editMessage / deleteMessage** — success and error paths
7. **webhook handling** — text, photo, edited message, callback query, group mention filtering
8. **voice message normalization** — voice note → `MediaAttachment` with `voice_note` type
9. **inline keyboard structure** — button rows, URL buttons, callback_data
10. **thread reply handling** — `reply_to_message` → `replyToId` in normalized message
11. **rate limit enforcement** — rapid sends trigger window-based delay
12. **polling/webhook mode switching** — webhook mode calls `setWebhook`, polling calls `deleteWebhook`

#### Channel Tests (`telegram.test.ts`)
1. **constructor** — instance creation, empty thread map, adapter exposure
2. **stop lifecycle** — safe to stop when not running
3. **message splitting** — short, long, paragraph breaks, no break points
4. **channel start/stop** — verify `isRunning` transitions
5. **message type routing** — text vs voice vs empty messages
6. **error handling during send** — adapter errors are caught, user notified
7. **health check** — delegates to underlying adapter

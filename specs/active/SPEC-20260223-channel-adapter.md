# SPEC-20260223-001: Channel Adapter Base Framework

## Status: Active
## Linear: AGE-118
## Objective: Validate ChannelAdapter base class, ChannelRegistry, and MessageNormalizer for production readiness

---

## Module Overview

`packages/core/src/channel-adapter.ts` (891 lines) provides the plugin interface for connecting
agents to external messaging platforms (Telegram, Discord, WhatsApp, Slack, etc.).

The module is composed of three primary components:

1. **`ChannelAdapter`** — Abstract base class that all platform adapters must extend. Manages
   connection lifecycle (connect/disconnect/reconnect with exponential-backoff), event emission,
   and optional platform capabilities (typing indicators, reactions, editing, etc.).

2. **`ChannelRegistry`** — Manages a pool of adapter instances. Supports factory registration,
   hot-reload, global event routing (fan-out to all registered handlers), and aggregate health
   checks across all live adapters.

3. **`MessageNormalizer`** — Static utility class that converts raw platform-specific data into
   the normalized `InboundMessage` format understood by all agents. Also provides text truncation
   and markdown-to-plain-text conversion helpers.

The architecture is entirely event-driven (no polling). Adapters emit typed `ChannelEvent` objects
to registered handlers.

---

## Key Interfaces

| Export | Kind | Purpose |
|--------|------|---------|
| `ChannelAdapter` | Abstract class | Base for all platform adapters |
| `ChannelRegistry` | Class | Lifecycle management + routing for multiple adapters |
| `MessageNormalizer` | Class (static) | Normalize raw platform data → `InboundMessage` |
| `ChannelConfig` | Interface | Per-adapter configuration (credentials, reconnect policy) |
| `InboundMessage` | Interface | Normalized message arriving from a platform |
| `OutboundMessage` | Interface | Message to send to a platform |
| `SendResult` | Interface | Result of a send operation |
| `ChannelCapabilities` | Interface | Feature flags for a given platform |
| `ChannelEvent` | Union type | All events emitted by adapters (message, callback, health, …) |
| `MediaAttachment` | Interface | Rich media payload (image, audio, video, file, …) |
| `CallbackAction` | Interface | Interactive button/menu callback payload |
| `MediaType` | Union type | `'image' \| 'audio' \| 'video' \| 'file' \| 'voice_note' \| 'sticker' \| 'location' \| 'contact'` |
| `HealthStatus` | Union type | `'healthy' \| 'degraded' \| 'unhealthy' \| 'disconnected'` |
| `ConnectionState` | Union type | `'disconnected' \| 'connecting' \| 'connected' \| 'reconnecting' \| 'error'` |
| `ChatType` | Union type | `'dm' \| 'group' \| 'channel' \| 'thread'` |
| `channelConfigSchema` | Zod schema | Runtime validation for `ChannelConfig` |
| `outboundMessageSchema` | Zod schema | Runtime validation for `OutboundMessage` |

---

## Success Criteria

- [ ] ChannelAdapter base class lifecycle (connect/disconnect/reconnect)
- [ ] ChannelRegistry CRUD operations (register/get/list/unregister)
- [ ] MessageNormalizer handles all media types (text/image/voice/reaction)
- [ ] Inbound message routing works correctly
- [ ] Outbound message sending works correctly
- [ ] Health check reporting
- [ ] Event emission for connection state changes
- [ ] Error recovery and reconnection logic
- [ ] Multi-channel concurrent routing
- [ ] Registry unregister non-existent adapter (no-op, no throw)
- [ ] Registry duplicate adapter ID rejected
- [ ] MessageNormalizer handles missing/optional fields gracefully
- [ ] Adapter configuration validated by Zod schemas
- [ ] Concurrent message processing (multiple simultaneous sends)
- [ ] Media type normalization (image, voice, reaction events)

---

## Test Plan

**Test file:** `packages/core/src/channel-adapter.test.ts`

### Existing coverage (45 tests)

| Suite | Count | Notes |
|-------|-------|-------|
| `ChannelAdapter > lifecycle` | 6 | start/stop/connect failure |
| `ChannelAdapter > events` | 4 | emit, unregister, error handling |
| `ChannelAdapter > sendMessage` | 1 | basic send |
| `ChannelAdapter > capabilities` | 1 | getCapabilities |
| `ChannelAdapter > health check` | 2 | healthy/unhealthy |
| `ChannelAdapter > default optional methods` | 4 | editMessage/deleteMessage/typing/reaction |
| `ChannelRegistry > factory management` | 3 | register/duplicate/unregister |
| `ChannelRegistry > adapter lifecycle` | 8 | create/unknown-platform/duplicate-id/get/list/remove/disabled |
| `ChannelRegistry > hot reload` | 1 | reloadAdapter |
| `ChannelRegistry > global events` | 2 | forward/unregister |
| `ChannelRegistry > health check` | 2 | all healthy / one unhealthy |
| `ChannelRegistry > shutdown` | 1 | stops all |
| `MessageNormalizer` | 6 | normalize/reply/truncate/markdown |
| `Zod Schemas` | 4 | config/outbound validation |

### New test categories (≥15 tests added)

1. **Multi-channel routing** — Register 2+ adapters; verify messages from each route to the
   correct handler without cross-contamination.
2. **Media type normalization** — Normalize messages carrying image, voice_note, and reaction
   payloads; verify `media` array and fields are preserved.
3. **Connection lifecycle sequence** — Full `connect → stop → restart` flow verifying state
   transitions at each step.
4. **Health checks via registry** — `degraded` and `disconnected` statuses, `platform` field
   present in aggregate results.
5. **Connection state event emission** — Verify `connection_state` events carry the correct
   `state` string for each transition.
6. **Error recovery** — Adapter `sendMessage` throws; verify `SendResult.success === false` and
   error string propagated (adapter-level) and registry-level health reflects failure.
7. **Registry edge cases** — `removeAdapter` on non-existent ID (no-op); `getAllAdapters` returns
   defensive copy (mutations don't affect registry).
8. **MessageNormalizer missing/malformed fields** — `text` undefined, `media` undefined,
   `senderName` undefined; default timestamp injected when not supplied.
9. **Concurrent message processing** — Multiple `sendMessage` calls in parallel; all resolve
   independently.
10. **Adapter configuration validation** — Zod rejects missing `credentials`, invalid
    `webhookUrl`, non-positive `reconnectIntervalMs`.

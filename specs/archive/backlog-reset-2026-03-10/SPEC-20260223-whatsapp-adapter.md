# SPEC-20260223-003: WhatsApp Adapter

## Status: Active
## Linear: AGE-118
## Objective: Validate WhatsApp (Cloud API) adapter and high-level channel for production readiness

---

## Module Overview

### `packages/core/src/adapters/whatsapp-adapter.ts`

Implements the `ChannelAdapter` interface for the **WhatsApp Cloud API** (Meta Business Platform).
Uses webhook-based message reception — Meta pushes events to a registered HTTP endpoint.

Key responsibilities:
- **Lifecycle**: `connect()` validates credentials via the Graph API; `disconnect()` clears state.
- **Inbound**: `handleWebhookPayload()` processes raw Meta webhook POSTs, normalizes messages, and emits typed `ChannelEvent` objects (`message`, `callback`, `error`).
- **Outbound**: `sendMessage()` dispatches text, image, audio, video, document, sticker, location, and interactive button messages via the Graph API.
- **Webhook verification**: `verifyWebhook()` handles the Meta `hub.verify_token` GET handshake.
- **Media**: `getMediaUrl()` resolves a WhatsApp media ID to a download URL; `downloadMedia()` fetches the binary with auth.
- **Reactions**: `addReaction()` sends emoji reactions via the reaction message type.
- **Rate limiting**: `enforceRateLimit()` slides a window over the last second, enforcing `rateLimitPerSecond` (default 80 msg/s).
- **Built-in HTTP server**: Optionally starts a Node.js `http.Server` for the webhook endpoint.

### `packages/core/src/channels/whatsapp.ts`

High-level runner that bridges the adapter to the AgentForge Convex chat pipeline.

Key responsibilities:
- **`WhatsAppChannel`**: Wraps `WhatsAppAdapter`, connects it to Convex via `ConvexHttpApi`.
- **Thread management**: Creates/caches Convex threads per WhatsApp phone number in `threadMap`.
- **Routing**: `routeToAgent()` converts inbound messages to text content, calls `chat:sendMessage` Convex action, and sends back the LLM response.
- **Message splitting**: `splitMessage()` breaks long responses across WhatsApp's 4096-char limit.
- **Deduplication**: `processingMessages` set prevents double-processing of webhook retries.
- **`startWhatsAppChannel()`**: Convenience factory that reads env vars and starts the channel.

---

## Key Interfaces

### Exported from `whatsapp-adapter.ts`
| Type | Description |
|------|-------------|
| `WhatsAppAdapter` | Main adapter class |
| `WhatsAppAdapterConfig` | Adapter configuration (tokens, ports, rate limits) |
| `WhatsAppWebhookPayload` | Raw Meta webhook body |
| `WhatsAppMessage` | Individual message within a payload |
| `WhatsAppMessageType` | Union of all supported message type strings |
| `WhatsAppMediaObject` | Image/audio/video/sticker media reference |
| `WhatsAppDocumentObject` | Document media (extends `WhatsAppMediaObject` with `filename`) |
| `WhatsAppLocationObject` | Latitude/longitude location |
| `WhatsAppInteractiveResponse` | Button/list reply interactive payload |
| `WhatsAppStatus` | Delivery/read receipt status update |
| `WhatsAppContact` | Sender profile (name + `wa_id`) |

### Exported from `channels/whatsapp.ts`
| Type | Description |
|------|-------------|
| `WhatsAppChannel` | High-level channel runner |
| `WhatsAppChannelConfig` | Channel configuration (adds `agentId`, `convexUrl`, `logLevel`) |
| `startWhatsAppChannel()` | Factory: reads env vars, starts the channel |

---

## Success Criteria

- [x] Webhook GET verification (subscribe mode, token matching, challenge echo)
- [x] Text message inbound normalization (sender, chatId, text, timestamp)
- [x] Image message inbound normalization (media URL, mimeType, caption)
- [x] Document message inbound normalization (file type, filename, mimeType)
- [x] Location message inbound normalization (geo URL, text coordinates)
- [x] Interactive button reply emitted as `callback` event
- [x] Interactive list reply emitted as `callback` event
- [x] Failed delivery status emits `error` event
- [x] Text message sending (messaging_product, to, type, text.body)
- [x] Image/audio/video/document/sticker/location outbound sending
- [x] Interactive button message sending (up to 3 buttons)
- [x] Reply context threading (`context.message_id`)
- [x] API error propagation (OAuth error → `result.error`)
- [x] Health check: healthy / unhealthy states
- [x] Reaction sending (`type: reaction`, emoji, message_id)
- [x] Disconnect clears credentials and config
- [ ] Video message inbound normalization (media URL, mimeType, caption)
- [ ] Audio/voice note inbound normalization (media URL, mimeType)
- [ ] Sticker message inbound normalization (media URL)
- [ ] Button message type (template button) emitted as callback
- [ ] Multiple media types in payload (sticker + location coexistence)
- [ ] Rate limiter: messages beyond limit wait before sending
- [ ] `getMediaUrl()` / `downloadMedia()` round-trip
- [ ] Channel `start()` / `stop()` lifecycle
- [ ] Deduplication: same message ID not processed twice
- [ ] Media content description in `routeToAgent()` content string
- [ ] Health check returns degraded on unexpected API response

---

## Test Plan

### Test Files
| File | Tests | Coverage |
|------|-------|---------|
| `packages/core/src/adapters/whatsapp-adapter.test.ts` | 34 existing + 8 new | Adapter unit tests |
| `packages/core/src/channels/whatsapp.test.ts` | 16 existing + 6 new | Channel integration tests |

### Test Categories

#### Adapter Tests (whatsapp-adapter.test.ts)
1. **platform** — `platform` property equals `"whatsapp"`
2. **connect** — credential validation, API verification, missing-field errors
3. **getCapabilities** — all supported media types, limits, feature flags
4. **sendMessage** — text, reply, image, document, interactive buttons, empty, API error
5. **healthCheck** — healthy, unhealthy
6. **verifyWebhook** — valid token, wrong token, wrong mode, missing params
7. **handleWebhookPayload** — text, image, document, location, reply context, interactive button/list callbacks, failed status, non-WA payloads, multiple messages
8. **addReaction** — success, error fallback
9. **disconnect** — clean teardown
10. **NEW: video/audio/sticker inbound** — media normalization for remaining types
11. **NEW: button message callback** — template button reply as callback event
12. **NEW: getMediaUrl / downloadMedia** — fetch round-trip with auth header
13. **NEW: rate limiting** — timestamps accumulate, wait enforced at limit

#### Channel Tests (whatsapp.test.ts)
1. **constructor** — instance creation, empty thread map, adapter exposure
2. **stop** — safe no-op when not running
3. **message splitting** — short, long, paragraph, line, space, hard-split
4. **startWhatsAppChannel** — env var validation (5 required vars), override acceptance
5. **NEW: start / stop lifecycle** — running state transitions with mocked adapter
6. **NEW: handleInboundMessage** — empty message skip, dedup key insertion
7. **NEW: routeToAgent media content** — media descriptions appended to content
8. **NEW: error recovery** — sends fallback error message when agent call throws
9. **NEW: getOrCreateThread** — caches thread, creates once, reuses on repeat
10. **NEW: health check via adapter** — adapter.healthCheck() result surfaced

---

## Dependencies

- `ChannelAdapter` (packages/core/src/channel-adapter.ts) — base class with `emit`, `emitMessage`, `emitCallback`, lifecycle hooks
- `MessageNormalizer` — static `normalize()` method for inbound message normalization
- Node.js `fetch` (global) — WhatsApp Graph API calls, media download
- Node.js `http` module — built-in webhook server
- Convex HTTP API — `query`, `mutation`, `action` endpoints

## Notes

- `webhookPort: 0` in test config disables the built-in HTTP server (port 0 would bind to a random port, but the adapter guards on falsy port before calling `startWebhookServer`).
- WhatsApp chatType is always `'dm'` even for group messages in the current implementation (group JID detection is not yet wired).
- Rate limiting uses a sliding 1-second window; tests must be careful not to trigger real waits.
- `downloadMedia` test needs to mock `fetch` differently from `callApi` (different URL pattern, binary response).

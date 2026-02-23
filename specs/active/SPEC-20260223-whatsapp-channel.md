# SPEC-20260223-whatsapp-channel

## Title
WhatsApp Cloud API Channel Adapter (AGE-97)

## Status
CODE

## Summary
Expanded WhatsApp Cloud API adapter for AgentForge implementing the ChannelAdapter
interface. Supports webhook-based message reception/verification, all message types
(text, image, audio, video, document, sticker, location), interactive buttons and
list messages, template messages, typing indicators (mark as read), rate limiting,
and media download.

## Requirements

### Functional
- WhatsAppAdapter class extending ChannelAdapter base class
- Webhook verification (GET) with constant-time comparison via crypto.subtle
- Webhook POST message reception and normalization
- Text messages with preview URLs
- Image, audio, video, document, sticker, location sending
- Interactive button messages (up to 3 quick replies)
- List messages with sections and rows
- Template messages with variable substitutions
- Mark as read (typing indicator equivalent)
- Emoji reactions
- Media URL retrieval and download
- Rate limiting (80 msg/sec default)
- Built-in HTTP webhook server

### Non-Functional
- No node:crypto dependency — uses Web Crypto API (crypto.subtle)
- Constant-time string comparison to prevent timing attacks
- Platform-specific types for WhatsApp Cloud API payloads
- Status update processing (sent, delivered, read, failed)

## Architecture
- `packages/core/src/adapters/whatsapp-adapter.ts` — WhatsAppAdapter (1270 lines)
- Extends ChannelAdapter from `packages/core/src/channel-adapter.ts`
- Built-in HTTP server for webhook (configurable port/path)
- Message normalization via MessageNormalizer

## Test Plan
- Integration with existing channel-adapter test suite
- Webhook verification: valid token, invalid token, missing params
- Message normalization: all message types
- Media extraction: image, audio, video, document, sticker, location
- Interactive message construction
- Rate limiting enforcement
- Status update processing

## Dependencies
- No external dependencies (uses native fetch + Web Crypto)
- @agentforge-ai/core channel-adapter base class

## Linear Issue
AGE-97

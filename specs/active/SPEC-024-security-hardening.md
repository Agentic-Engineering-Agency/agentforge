# [SPEC-024] Security Hardening

**Status:** Draft | **Priority:** P1 | **Assigned:** Agent B (after SPEC-022)
**Created:** 2026-03-05 | **Updated:** 2026-03-05
**Depends on:** SPEC-022

## Overview
Address all security vulnerabilities found in the March 5, 2026 audit. After SPEC-022 fixes the encryption and data leak, this spec adds auth, rate limiting, and input safety.

## Goals
- Auth on Convex functions (token-based)
- Rate limiting on HTTP channel
- Input sanitization in all channels
- Env var validation at startup (fail fast on missing secrets)
- `pnpm audit` stays clean (0 high/critical)

## Non-Goals
- OAuth / SSO (future)
- RBAC / multi-tenant (future)
- Penetration testing (out of scope for this sprint)

## Proposed Solution

### 1. Convex Function Auth
Add token validation to Convex mutations (agents create/update/delete, apiKeys add/delete, tokens generate).

```typescript
// convex/lib/auth.ts
export async function requireAuth(ctx: MutationCtx): Promise<void> {
  const identity = ctx.auth.getUserIdentity()
  if (!identity) throw new ConvexError("Unauthorized")
}
```

For local/API access, use the existing `tokens` table:
```typescript
// convex/lib/auth.ts — for API token auth
export async function requireToken(
  ctx: QueryCtx | MutationCtx,
  token: string
): Promise<void> {
  const doc = await ctx.db.query("tokens")
    .withIndex("by_value", q => q.eq("value", token))
    .first()
  if (!doc || !doc.active) throw new ConvexError("Invalid token")
}
```

### 2. HTTP Channel Rate Limiting
```typescript
// packages/runtime/src/channels/http-rate-limit.ts
interface RateLimitConfig {
  requestsPerMinute: number    // default: 60
  requestsPerHour: number      // default: 1000
  burstSize: number            // default: 10
}
```

Implementation: in-memory sliding window per token. Use `Map<token, timestamps[]>`.

### 3. Env Var Validation
```typescript
// packages/runtime/src/daemon/validate-env.ts
const REQUIRED_VARS = {
  AGENTFORGE_KEY_SALT: "Required for API key encryption (min 32 chars)",
}
const OPTIONAL_VARS = {
  DISCORD_BOT_TOKEN: "Required if --discord flag used",
  TELEGRAM_BOT_TOKEN: "Required if --telegram flag used",
  AGENTFORGE_API_KEY: "Required for HTTP channel auth",
}

export function validateEnv(channels: string[]): void
// Throws with clear error message if required vars are missing
// Warns (not throws) if optional vars missing for enabled channels
```

### 4. Input Sanitization
Already have `UnicodeNormalizer` in agent processors (from Chico/SPEC-020).
Add channel-level sanitization:
- Max message length: 16,000 chars (Discord: 2000, Telegram: 4096, HTTP: 16000)
- Strip null bytes, non-printable control characters before passing to agent
- Log and reject messages that exceed max length

### 5. Secret Rotation Guidance
Document in CHANGELOG/README:
- `AGENTFORGE_KEY_SALT` rotation process (re-encrypt all keys)
- `AGENTFORGE_API_KEY` rotation (generate new token, update clients)

## Implementation Plan
1. Add `convex/lib/auth.ts` with `requireAuth()` and `requireToken()`
2. Apply auth to sensitive mutations (agents, apiKeys, tokens)
3. Add `validate-env.ts` to runtime, call at daemon startup
4. Add rate limiter middleware to HTTP channel
5. Add channel-level input sanitization
6. Document secret management in CONTRIBUTING.md
7. Run `pnpm audit` — fix any new findings

## Testing Plan
- Unit: rate limiter rejects after limit reached
- Unit: `validateEnv()` throws on missing `AGENTFORGE_KEY_SALT`
- Unit: input sanitizer strips control chars
- Integration: HTTP endpoint returns 401 without valid token
- Integration: HTTP endpoint returns 429 after rate limit
- Security: Convex mutation without token returns ConvexError("Unauthorized")

## References
- OWASP API Security Top 10: https://owasp.org/API-Security/
- Convex auth docs: https://docs.convex.dev/auth
- node:crypto AES-GCM: https://nodejs.org/api/crypto.html

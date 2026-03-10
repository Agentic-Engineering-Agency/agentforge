# [SPEC-022] Convex Data Layer Refactor

**Status:** Draft | **Priority:** P1 | **Assigned:** Agent B
**Created:** 2026-03-05 | **Updated:** 2026-03-05
**Can run parallel to:** SPEC-021

## Overview
Strip all LLM logic out of Convex. Convex becomes a pure data + config layer. Fix the security vulnerabilities found in the audit. Move API key encryption to Node.js crypto (fast, secure AES-256-GCM).

## Problem Statement
Current Convex functions do too much:
- `chat.ts` — runs Mastra (wrong: use runtime instead)
- `lib/agent.ts` — AI SDK model creation in Convex action (wrong)
- `modelFetcher.ts` — HTTP calls to provider APIs from Convex (fragile)
- `mastraIntegration.ts` — Mastra workflows in Convex (wrong)
- `apiKeys.ts` — XOR cipher (not real encryption)
- `getActiveForProvider` — public query returning decrypted API keys (security vulnerability)

## Goals
- Delete all LLM logic from Convex
- Fix `apiKeys.ts`: AES-256-GCM using `node:crypto` in a `"use node"` action
- Fix `getActiveForProvider`: strip sensitive fields from public query
- Add `runtime/sync.ts`: runtime reads agent configs from Convex, writes logs/messages back
- Convex tables stay the same (schema is good) — only functions change
- All 4 template locations stay in sync (automate with `scripts/sync-templates.sh`)

## Non-Goals
- Changing the dashboard UI (that follows after this spec)
- Auth/authorization (that's SPEC-024)
- Rate limiting (that's SPEC-024)

## Proposed Changes

### Files to DELETE from `convex/`
```
convex/chat.ts                    → moved to runtime HTTP channel
convex/lib/agent.ts               → moved to packages/runtime/src/agent/
convex/lib/modelFetcher.ts        → moved to packages/runtime/src/models/registry.ts
convex/mastraIntegration.ts       → not needed (runtime handles Mastra)
```

### Files to MODIFY

#### `convex/apiKeys.ts` — Fix encryption
Replace XOR cipher with AES-256-GCM using `node:crypto`.

**Critical constraint:** must be in a `"use node"` file since `node:crypto` is Node.js only.  
**Pattern:** Split into two files:
- `convex/apiKeys.ts` — queries and mutations (pure data, no crypto)
- `convex/apiKeysCrypto.ts` — `"use node"` actions for encrypt/decrypt

```typescript
// convex/apiKeysCrypto.ts — "use node"
"use node"
import { v } from "convex/values"
import { internalAction } from "./_generated/server"
import * as crypto from "node:crypto"

// HKDF-derived key from salt
function deriveKey(salt: string): Buffer {
  const ikm = Buffer.from(salt, "utf8")
  return crypto.hkdfSync("sha256", ikm, "", "agentforge-api-key", 32)
}

export const encryptApiKey = internalAction({
  args: { plaintext: v.string(), salt: v.string() },
  returns: v.object({ ciphertext: v.string(), iv: v.string(), tag: v.string() }),
  handler: async (_, { plaintext, salt }) => {
    const key = deriveKey(salt)
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    return {
      ciphertext: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
    }
  },
})

export const decryptApiKey = internalAction({
  args: { ciphertext: v.string(), iv: v.string(), tag: v.string(), salt: v.string() },
  returns: v.string(),
  handler: async (_, { ciphertext, iv, tag, salt }) => {
    const key = deriveKey(salt)
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(iv, "base64")
    )
    decipher.setAuthTag(Buffer.from(tag, "base64"))
    return decipher.update(Buffer.from(ciphertext, "base64")) + decipher.final("utf8")
  },
})
```

**Default salt:** read from `process.env.AGENTFORGE_KEY_SALT` (required, no insecure default).

#### `convex/apiKeys.ts` — Fix public data leak
```typescript
// getActiveForProvider: return doc WITHOUT encryptedKey, iv, tag
// Only internalAction (via apiKeysCrypto.decryptApiKey) can decrypt
export const getActiveForProvider = query({
  args: { provider: v.string() },
  handler: async (ctx, { provider }) => {
    const doc = await ctx.db.query("apiKeys")
      .withIndex("by_provider", q => q.eq("provider", provider))
      .filter(q => q.eq(q.field("active"), true))
      .first()
    if (!doc) return null
    // Return config metadata ONLY — never return encrypted key data
    return {
      _id: doc._id,
      provider: doc.provider,
      label: doc.label,
      active: doc.active,
      createdAt: doc._creationTime,
    }
  },
})
```

### New File: `packages/runtime/src/sync/convex.ts`
```typescript
// Runtime reads agent configs from Convex
export class ConvexSync {
  constructor(convexUrl: string, authToken: string) {}

  // Called at daemon startup — loads all active agents
  async loadAgentConfigs(): Promise<AgentDefinition[]>

  // Called by channels after each message — write to messages table
  async appendMessage(threadId: string, message: ConvexMessage): Promise<void>

  // Write structured log entry
  async writeLog(entry: LogEntry): Promise<void>

  // Write usage event
  async writeUsage(event: UsageEvent): Promise<void>
}
```

### Template Sync Script
```bash
#!/bin/bash
# scripts/sync-templates.sh
# Single source of truth: packages/cli/templates/default/
SRC="packages/cli/templates/default"
for dest in "packages/cli/dist/default" "templates/default" "convex"; do
  rsync -av --delete "$SRC/convex/" "$dest/convex/"
done
echo "✅ Templates synced"
```

Add to `package.json` scripts: `"sync-templates": "bash scripts/sync-templates.sh"`

## Implementation Plan
1. Write `scripts/sync-templates.sh` — automate 4-way sync immediately
2. Delete `convex/chat.ts`, `convex/lib/agent.ts`, `convex/lib/modelFetcher.ts`, `convex/mastraIntegration.ts`
3. Write `convex/apiKeysCrypto.ts` — AES-256-GCM encrypt/decrypt actions
4. Update `convex/apiKeys.ts` — use new crypto actions, fix public data leak
5. Update callers: any Convex function calling old `getDecryptedForProvider` pattern
6. Write `packages/runtime/src/sync/convex.ts`
7. Run `pnpm sync-templates` to propagate all changes to all 4 locations
8. Run `npx convex dev --once` to verify schema + functions compile
9. Write tests

## Testing Plan
- Unit: AES-256-GCM round trip (encrypt then decrypt = original)
- Unit: `getActiveForProvider` does NOT return encrypted fields
- Unit: `ConvexSync.loadAgentConfigs()` maps Convex docs to `AgentDefinition[]`
- Integration: set key via CLI, verify it can be decrypted correctly
- Security: `getActiveForProvider` response has no `encryptedKey`, `iv`, `tag`, `ciphertext` fields

## Migration Notes
- Existing keys stored with XOR encoding will need to be re-entered after this change
- Add migration note to CHANGELOG.md
- `AGENTFORGE_KEY_SALT` env var is now **required** (previously optional with insecure default)

## References
- Node.js crypto AES-256-GCM: https://nodejs.org/api/crypto.html#cryptocreatecipheriivalgorithm-key-iv-options
- Convex "use node" actions: https://docs.convex.dev/functions/actions#using-node
- Convex internal actions: https://docs.convex.dev/functions/internal-functions

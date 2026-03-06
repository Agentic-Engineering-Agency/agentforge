# TASK: SPEC-022 — Convex Data Layer Refactor

You are Agent B. Your job is to implement SPEC-022: strip all LLM logic out of Convex, add Mastra memory tables, fix the XOR encryption vulnerability, and fix the API key data leak. Convex becomes a pure data layer.

## CRITICAL: Read These First
Before writing any code, read:
- `CLAUDE.md` — project rules (mandatory)
- `docs/TECH-REFERENCE.md` — Convex + Mastra constraints (especially sections 1, 3, 6)
- `specs/active/SPEC-022-convex-data-layer.md` — your spec

## Context
AgentForge has been running Mastra inside Convex actions. This is architecturally broken (10-15s cold starts, no streaming, crypto.subtle too slow). We're migrating to a persistent daemon. Your job is to clean up Convex so it's a pure data layer that the daemon reads from / writes to.

## Your Branch
You are on branch `feat/spec-022-convex-cleanup`. All work goes here.
**NEVER push to main. Never push to plan/architecture-redesign.**

## SpecSafe Workflow (MANDATORY)
1. Write tests FIRST (watch them fail)
2. Implement
3. `pnpm test` — GREEN
4. `npx convex dev --once` — 0 deployment errors
5. Commit and push

## What To Do

### Step 1: Delete LLM Files From Convex

Delete these files (they belong in packages/runtime/ not Convex):
```
convex/chat.ts                 ← LLM calls in Convex action
convex/mastraIntegration.ts    ← Mastra workflows in Convex
convex/lib/agent.ts            ← AI SDK model creation in Convex
convex/modelFetcher.ts         ← HTTP calls to LLM provider APIs
```

Before deleting: check what imports them and update those imports to either:
- Remove the import (if the feature is being moved to runtime)
- Leave a TODO comment in CHANGELOG noting the deletion

Also check `convex/index.ts` or any barrel file that re-exports from these.

### Step 2: Add Mastra Memory Tables to schema.ts

In `convex/schema.ts`, add these tables from `@mastra/convex/schema`:

First install the package:
```bash
cd /tmp/af-spec-022
pnpm add @mastra/convex@latest --filter "{packages/cli/templates/default}"
# Also add to root if needed for convex/
```

Then in `convex/schema.ts`:
```typescript
import {
  mastraThreadsTable,
  mastraMessagesTable,
  mastraResourcesTable,
  mastraWorkflowSnapshotsTable,
  mastraScoresTable,
  mastraVectorIndexesTable,
  mastraVectorsTable,
  mastraDocumentsTable,
} from '@mastra/convex/schema'

export default defineSchema({
  // --- Mastra memory tables (managed by @mastra/convex from the daemon) ---
  mastra_threads: mastraThreadsTable,
  mastra_messages: mastraMessagesTable,
  mastra_resources: mastraResourcesTable,
  mastra_workflow_snapshots: mastraWorkflowSnapshotsTable,
  mastra_scorers: mastraScoresTable,
  mastra_vector_indexes: mastraVectorIndexesTable,
  mastra_vectors: mastraVectorsTable,
  mastra_documents: mastraDocumentsTable,

  // --- Existing AgentForge tables (keep as-is) ---
  agents: agentsTable,
  apiKeys: apiKeysTable,
  // ... all other existing tables unchanged
})
```

### Step 3: Create Mastra Storage Handler

Create `convex/mastra/storage.ts`:
```typescript
import { mastraStorage } from '@mastra/convex/server'
export const handle = mastraStorage
```

This is required for `@mastra/convex` to work with Convex as the memory backend.

### Step 4: Fix API Key Encryption (XOR → AES-256-GCM)

**Current state:** `convex/apiKeys.ts` uses XOR cipher. Trivially breakable.
**Target:** AES-256-GCM via `node:crypto` in a `"use node"` action.

**Critical Convex constraint:** `"use node"` files can ONLY contain `action` and `internalAction` functions. NEVER queries or mutations.

Create `convex/apiKeysCrypto.ts`:
```typescript
"use node"
import { v } from 'convex/values'
import { internalAction } from './_generated/server'
import * as crypto from 'node:crypto'

const DEFAULT_SALT = (() => {
  const salt = process.env.AGENTFORGE_KEY_SALT
  if (!salt) throw new Error('AGENTFORGE_KEY_SALT env var is required')
  return salt
})()

function deriveKey(salt: string): Buffer {
  return crypto.hkdfSync('sha256', Buffer.from(salt, 'utf8'), '', 'agentforge-api-key-v1', 32)
}

export const encryptApiKey = internalAction({
  args: { plaintext: v.string() },
  returns: v.object({ ciphertext: v.string(), iv: v.string(), tag: v.string(), version: v.literal('aes-gcm-v1') }),
  handler: async (_, { plaintext }) => {
    const key = deriveKey(DEFAULT_SALT)
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return {
      ciphertext: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      version: 'aes-gcm-v1' as const,
    }
  },
})

export const decryptApiKey = internalAction({
  args: { ciphertext: v.string(), iv: v.string(), tag: v.string() },
  returns: v.string(),
  handler: async (_, { ciphertext, iv, tag }) => {
    const key = deriveKey(DEFAULT_SALT)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    const decrypted = decipher.update(Buffer.from(ciphertext, 'base64'))
    return Buffer.concat([decrypted, decipher.final()]).toString('utf8')
  },
})
```

**Update `convex/apiKeys.ts`:**
- Remove the XOR encryption/decryption logic
- Change `add` mutation to call `internal.apiKeysCrypto.encryptApiKey` via `ctx.runAction()`
- Change `getDecryptedForProvider` internal query to call `internal.apiKeysCrypto.decryptApiKey` via `ctx.runAction()` — NOTE: this makes it an `internalAction` not `internalQuery`
- **CRITICAL FIX:** `getActiveForProvider` (public query) must NOT return encrypted fields (`encryptedKey`, `iv`, `tag`, `ciphertext`). Strip these before returning.

```typescript
// BEFORE (vulnerable):
return doc  // includes encryptedKey!

// AFTER (safe):
const { encryptedKey, iv, tag, ciphertext, ...safeFields } = doc
return safeFields
```

Add migration note to CHANGELOG.md:
```
## Breaking Change — API Key Re-entry Required
v0.12.0 upgrades API key encryption from XOR (insecure) to AES-256-GCM.
Existing stored keys cannot be decrypted with the new cipher.
Users must re-enter their API keys after upgrading.
AGENTFORGE_KEY_SALT environment variable is now required.
```

### Step 5: Create scripts/sync-templates.sh (already exists from pre-cleanup)

Verify it exists and works:
```bash
ls scripts/sync-templates.sh  # should exist
bash scripts/sync-templates.sh  # should sync without errors
```

### Step 6: Remove Broken Convex Functions That Depended on Deleted Files

After deleting chat.ts, lib/agent.ts, etc., scan for any remaining references:
```bash
grep -r "from.*chat" convex/ --include="*.ts" | grep -v "_generated"
grep -r "from.*mastraIntegration" convex/ --include="*.ts"
grep -r "from.*modelFetcher" convex/ --include="*.ts"
grep -r "executeAgent\|sendMessage\|runMastra" convex/ --include="*.ts"
```

Fix or remove any broken references.

### Step 7: Verify Convex Deploys Cleanly
```bash
cd /tmp/af-spec-022
npx convex dev --once 2>&1
```
Must complete with 0 errors. Fix any issues before committing.

### Step 8: Update Template Files (4-way sync)
```bash
bash scripts/sync-templates.sh
```
This syncs all changes to `packages/cli/dist/default/convex/`, `templates/default/convex/`, and `convex/`.

## Tests to Write

### Tests in `packages/core/tests/convex-schema.test.ts`
- Schema exports contain mastra_* tables
- `getActiveForProvider` response type does NOT include `encryptedKey`, `iv`, `tag` fields
- AES-256-GCM round-trip: encrypt then decrypt returns original plaintext

### Tests for apiKeys behavior
- `getActiveForProvider` returns null when no key configured
- `getActiveForProvider` returns provider metadata but NO encrypted fields
- Key creation stores ciphertext format (not XOR format)

## Quality Gates (MANDATORY before PR)
- `pnpm test` — ALL passing
- `tsc --noEmit` in `convex/` — 0 TypeScript errors  
- `npx convex dev --once` — deploys with 0 errors
- `pnpm audit` — 0 high/critical vulnerabilities
- `grep -r "xor\|charCode\|charCodeAt" convex/apiKeys.ts` — returns nothing (XOR removed)
- `getActiveForProvider` response must not contain sensitive fields

## When Done
1. Run sync-templates: `bash scripts/sync-templates.sh`
2. Commit: `git add -A && git commit -m "feat(convex): SPEC-022 — data layer refactor: remove LLM logic, add mastra_* tables, AES-256-GCM encryption, fix API key data leak"`
3. Push: `git push -u origin feat/spec-022-convex-cleanup`
4. Notify: `openclaw system event --text "SPEC-022 complete: Convex data layer refactored — LLM logic removed, mastra_* tables added, AES-256-GCM encryption, data leak fixed. Ready for PR review." --mode now`

## Key Constraints
- `"use node"` files: ONLY action/internalAction — NEVER query/mutation
- Internal functions: `ctx.runQuery(internal.x.y)` not `ctx.runQuery(api.x.y)`
- Do NOT delete the `convex/lib/` directory entirely — there may be non-LLM files there
- Do NOT touch the dashboard/ code or CLI commands
- AGENTFORGE_KEY_SALT must be set in Convex env for production: `npx convex env set AGENTFORGE_KEY_SALT "$(openssl rand -hex 32)"`

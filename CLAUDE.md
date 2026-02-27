# CLAUDE.md — AgentForge Development Context

> Read this file completely before starting any work. All rules are mandatory.

---

## 🎯 What is AgentForge?

AgentForge is an AI agent platform similar to OpenClaw, but:
- **Smaller** — focused, not trying to cover every use case
- **Safer** — encrypted key storage, RBAC, audit logs from the start
- **Mastra-native** — the entire agent runtime is built on Mastra + Convex
- **CLI-primary** — every feature works from the terminal first

**NOT allowed:**
- Raw AI SDK calls bypassing Mastra
- Hardcoded model lists
- Fake/stub implementations shipped as real features
- `createTool` pattern for skills (use SKILL.md standard)

---

## 🛡️ MANDATORY RULES — READ BEFORE WRITING ANY CODE

### 1. Codebase Audit First
Before implementing: search the codebase. Does it exist? Is it broken? Is it a placeholder?
Test against the live deployment: `watchful-chipmunk-946.convex.cloud`

### 2. SpecSafe-First
```bash
specsafe new <feature>   # Step 1: Write spec + tests
# Step 2: Watch tests fail (proves tests work)
# Step 3: Implement
pnpm test                # Step 4: Must be GREEN
# Step 5: If failing — fix NOW, before anything else
```
**Never write code before tests. Never ship with failing tests.**

### 3. Research Official Docs (Every Sprint)
APIs change constantly. Read before implementing:
- Mastra Workspace: https://mastra.ai/docs/workspace/overview
- Mastra Skills (SKILL.md): https://mastra.ai/docs/workspace/skills
- Mastra Filesystem: https://mastra.ai/docs/workspace/filesystem
- Mastra S3/R2: https://mastra.ai/reference/workspace/s3-filesystem
- Convex: https://docs.convex.dev
- Convex File Storage: https://docs.convex.dev/file-storage
- Convex HTTP Actions (SSE): https://docs.convex.dev/functions/http-actions

### 4. CLI First → Dashboard Second
Every new feature:
1. `agentforge <command>` — implement + test in CLI
2. Dashboard route — replicate same logic in UI
Never implement dashboard-only features.

### 5. Mastra-Native APIs (Mandatory Patterns)

**BYOK Model Config — ALWAYS use OpenAICompatibleConfig:**
```typescript
// ✅ Correct (v0.10.0+)
new Agent({
  model: {
    providerId: provider,                      // 'openai' | 'anthropic' | 'openrouter'
    modelId: getBaseModelId(provider, modelId), // strip provider prefix!
    apiKey,
    url: getProviderBaseUrl(provider),          // for OpenRouter/Mistral/etc
  }
})

// ❌ Wrong — Mastra 1.8.0 does NOT strip prefix → API gets 'openai/gpt-4.1' → 404
new Agent({ model: 'openai/gpt-4.1' })
```

**Workspace + Skills (SKILL.md standard):**
```typescript
import { Workspace, LocalFilesystem } from '@mastra/core/workspace'
import { S3Filesystem } from '@mastra/s3'

const workspace = new Workspace({
  filesystem: process.env.AGENTFORGE_FILESYSTEM === 'r2'
    ? new S3Filesystem({ bucket, region: 'auto', endpoint, accessKeyId, secretAccessKey })
    : new LocalFilesystem({ basePath: './workspace' }),
  skills: ['/skills'],  // SKILL.md folders, NOT createTool
})
```

**Skills must be SKILL.md folders (agentskills.io spec), NOT createTool:**
```
/skills/my-skill/
  SKILL.md          ← metadata + instructions
  references/       ← supporting docs
  scripts/          ← executable scripts
  assets/           ← images/files
```

**Streaming (use Agent.stream(), not Agent.generate()):**
```typescript
const stream = await agent.stream(messages)
// Use Convex HTTP action for SSE delivery to client
```

### 6. Convex Runtime Rules
```typescript
// "use node" files: ONLY actions and internalActions
// Default runtime: queries + mutations + standard actions

// ✅ Correct internal call
await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, { provider })

// ❌ Wrong — internal functions not accessible via api.*
await ctx.runQuery(api.apiKeys.getDecryptedForProvider, { provider })
```

### 7. File Storage (No Fake Implementations)
```typescript
// ✅ Dev: Convex built-in storage
const uploadUrl = await ctx.storage.generateUploadUrl()
const storageId = await ctx.storage.store(file)

// ✅ Prod: Mastra S3Filesystem → Cloudflare R2
// ❌ Never: store file content as base64 in DB / metadata-only "upload"
```

### 8. Quality & Security After Every Sprint
After every PR:
1. Run full test suite: `pnpm test` — ALL must pass
2. Security review: all mutations have server-side validation
3. Live test: test feature against `watchful-chipmunk-946.convex.cloud`
4. No `as any` on Convex mutation payloads
5. No `window.confirm` / `alert` — use toast or two-step confirm pattern

---

## 📋 Current Status (2026-02-27)

### ✅ Working
- `agentforge agents list/create/edit/delete` — Convex connected
- `agentforge chat <agent-id>` — API-level works (interactive TTY may have issues)
- `agentforge cron list/create` — connected
- `agentforge mcp list/add` — connected
- `agentforge files list` — lists metadata
- BYOK: `OpenAICompatibleConfig` — confirmed working end-to-end

### 🐛 Broken (must fix before new features)
- **AGE-170:** File upload is metadata-only — content never stored
- **AGE-171:** Chat CLI interactive stdin broken
- **AGE-172:** Skills dashboard uses `createTool` not SKILL.md
- **AGE-173:** Streaming is placeholder — falls back to full generation

### 🔨 Missing Core Features
- **AGE-174:** Dynamic model list from provider API
- **AGE-175:** Mastra Workspace wired to agents
- **AGE-159:** Streaming SSE via Convex HTTP actions
- **AGE-157:** Complete project scoping (8 tables still unscoped)
- **AGE-152:** File management in dashboard UI (upload button missing)

---

## 🏗️ Sprint Execution Order

### Phase 0 — Fix What's Broken (Start Here)
1. AGE-170: Real file storage (Convex storage API)
2. AGE-171: Chat CLI interactive mode
3. AGE-173: Streaming (Convex HTTP + SSE)
4. AGE-172: Skills → SKILL.md standard

### Phase 1 — Core Completeness
5. AGE-174: Dynamic model loading
6. AGE-157: Complete project scoping
7. AGE-152: File management UI
8. AGE-175: Mastra Workspace integration

### Phase 2 — Intelligence
9. AGE-158: Context window management
10. AGE-160: Model failover chains
11. AGE-161: Browser automation (Playwright, native Mastra tool)
12. AGE-143: Real MCP tool execution

### Phase 3 — Platform
13. AGE-162: Real-time dashboard (Convex reactive)
14. AGE-145: Better Auth (multi-tenant)
15. AGE-163: Usage metering + billing

---

## 📦 Live Test Deployment

```
Deployment:  watchful-chipmunk-946.convex.cloud
Project dir: /tmp/agentforge-test/agentforge-test
Dashboard:   http://localhost:3000
```

**Every feature must be tested against this deployment before PR.**

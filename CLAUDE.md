# CLAUDE.md — AgentForge Development Context

> Read this file completely before starting any work. All rules are mandatory.

---

## What is AgentForge?

An AI agent framework: CLI + local dashboard, built on Mastra + Convex. Self-hosted, developer-focused, secure by default.

This repo is the complete product. CLI, local dashboard, Convex functions — all here. Auth, billing, and hosting are future concerns. Do not implement them now.

---

## 🚨 RULES — Read Before Writing Any Code

### 1 · Audit first
Before implementing: search the codebase, test against `watchful-chipmunk-946.convex.cloud`. Does it exist? Is it broken? Is it a stub? Document what you find.

### 2 · SpecSafe-first
```bash
# Step 1: write tests
# Step 2: watch them fail (proves tests are real)
# Step 3: implement
pnpm test   # Step 4: must be GREEN
# Step 5: if failing — fix NOW, before anything else
```

### 3 · Research official docs before every sprint
```
Mastra:                 https://mastra.ai/docs
Mastra Skills:          https://mastra.ai/docs/workspace/skills
Mastra Workspace:       https://mastra.ai/docs/workspace/overview
Mastra S3/R2:           https://mastra.ai/reference/workspace/s3-filesystem
Convex:                 https://docs.convex.dev
Convex file storage:    https://docs.convex.dev/file-storage
Convex HTTP actions:    https://docs.convex.dev/functions/http-actions
```

### 4 · CLI first → local dashboard second
1. `agentforge <command>` — implemented and tested
2. `packages/cli/dist/default/` dashboard — same logic as UI

### 5 · Mastra-native patterns

**BYOK — always OpenAICompatibleConfig:**
```typescript
// ✅ Correct
new Agent({
  model: {
    providerId: provider,
    modelId: getBaseModelId(provider, modelId),
    apiKey,
    url: getProviderBaseUrl(provider),
  }
})
// ❌ Wrong — Mastra 1.8+ does not strip provider prefix
new Agent({ model: 'openai/gpt-4.1' })
```

**Skills — SKILL.md folders, never createTool:**
```
skills/my-skill/
  SKILL.md        ← metadata + instructions
  references/     ← supporting docs
  scripts/        ← executables
  assets/         ← images / files
```

**Streaming — Agent.stream(), not Agent.generate():**
```typescript
const stream = await agent.stream(messages)
// deliver via Convex HTTP action SSE endpoint
```

### 6 · Convex runtime boundaries
```typescript
// "use node" files → only action / internalAction
// default runtime  → queries + mutations

// ✅ internal call
await ctx.runQuery(internal.apiKeys.getDecryptedForProvider, { provider })
// ❌ wrong — internal functions not accessible via api.*
await ctx.runQuery(api.apiKeys.getDecryptedForProvider, { provider })
```

### 7 · File storage — no fake implementations
```typescript
// ✅ real storage
const uploadUrl = await ctx.storage.generateUploadUrl()
// ❌ never: url: 'pending-upload'
```

### 8 · dist/default ≡ templates/default
Every change in `dist/default/` must be made identically in `templates/default/`.

### 9 · QA + Security after every sprint
- `pnpm test` — all green
- all mutations have server-side input validation
- live test on `watchful-chipmunk-946.convex.cloud`
- document what was tested

---

## Current Status (2026-02-27)

### ✅ Confirmed working (real Convex)
- `executeAgent` → real LLM response
- `chat.sendMessage` → real LLM response
- `apiKeys.create` + BYOK chain
- `agents.list`

### 🔨 Phase 0 PRs open (pending review)
- PR #122: chat CLI interactive mode + --message flag (AGE-171)
- PR #123: real Convex file storage (AGE-170)
- PR #124: streaming SSE via Convex HTTP action (AGE-173)
- PR #125: SKILL.md folder scaffolding (AGE-172)

### ⚠️ Not yet confirmed end-to-end
- cron CRUD beyond list
- mcp add / connection test
- skills install / create
- agents create / edit / delete interactive paths
- dashboard pages in browser

---

## Live Test Deployment

```
Deployment: watchful-chipmunk-946.convex.cloud
Dir:        /tmp/agentforge-test/agentforge-test
Run:        agentforge dashboard --dir /tmp/agentforge-test/agentforge-test
```

Convex must be initialized before testing: `npx convex dev --once`

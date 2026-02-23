# AgentForge Codebase Audit Report

**Date:** 2026-02-22
**Scope:** Phase 0 (Synchronization) + Phase 1 (Foundation) — Full codebase audit
**Overall Health Score: 6.5 / 10**

---

## Table of Contents

1. [Build & Test Verification](#1-build--test-verification)
2. [Mastra Documentation Comparison](#2-mastra-documentation-comparison)
3. [Convex Documentation Comparison](#3-convex-documentation-comparison)
4. [Code Quality Audit](#4-code-quality-audit)
5. [Cross-Reference Validation](#5-cross-reference-validation)
6. [CI/CD Pipeline Review](#6-cicd-pipeline-review)
7. [Summary: Issues by Priority](#7-summary-issues-by-priority)

---

## 1. Build & Test Verification

### Build: PASS

All packages build successfully:
- `packages/core` — ESM + DTS build OK
- `packages/cli` — ESM build OK
- `packages/web` — Vite build OK (warning: 557KB chunk exceeds 500KB limit)
- `packages/channels-discord` — tsup build OK
- `packages/sandbox` — tsup build OK
- `examples/finforge` — tsc --noEmit OK

### Tests: 28/31 suites pass, 728/763 tests pass

| Status | Count |
|--------|-------|
| Passed suites | 28 |
| Failed suites | 3 |
| Skipped suites | 2 |
| Passed tests | 728 |
| Skipped tests | 32 |
| Todo tests | 3 |

### Failed Test Suites (3)

All 3 failures are **module resolution errors**, not logic failures:

1. **`convex/schema.test.ts`** — Cannot resolve `convex-test-utils` module. The file has 0 tests (likely a placeholder).
2. **`tests/e2e/convex-adapter.test.ts`** — Cannot resolve `@agentforge-ai/core` from test context. The workspace link is not resolved by Vite during test collection.
3. **`tests/e2e/deploy.test.ts`** — Cannot resolve `@agentforge-ai/cli/src/commands/deploy.js`. Path import format mismatch.

**Root cause:** These tests import workspace packages by name but Vitest's module resolution doesn't resolve pnpm workspace links for these specific test files. They need `vitest.config.ts` alias configuration or should import via relative paths.

### Skipped Suites (2)

- `tests/e2e/threads.test.ts` — 16 tests skipped (requires cloud infra)
- `tests/e2e/cloud-execution.test.ts` — 14 tests skipped (requires cloud infra)

These are correctly gated behind environment variables.

---

## 2. Mastra Documentation Comparison

Compared against official docs at mastra.ai/docs (via Context7 documentation retrieval).

### 2.1 Model String Format — CORRECT

Our `"provider/model-name"` format (e.g., `"openai/gpt-4o"`, `"anthropic/claude-opus-4-6"`) matches Mastra's documented convention exactly. The docs use `"openai/gpt-5.1"` as the canonical example.

### 2.2 Agent.generate() — PARTIALLY CORRECT

**What works:**
- `agent.generate(messages)` call signature is correct
- Model string passed to Agent constructor is correct

**Issues found:**

| Issue | Severity | Location |
|-------|----------|----------|
| **Agent created per-request (anti-pattern)** | CRITICAL | `convex/mastraIntegration.ts:125` |
| Missing `id` field in Agent constructor | WARNING | `convex/mastraIntegration.ts:125` |
| `temperature`/`maxTokens` accepted but never passed to Agent or generate() | WARNING | `convex/mastraIntegration.ts:103-131` |
| Tools not passed during failover execution | WARNING | `convex/mastraIntegration.ts:125` |

**Detail — Agent per-request anti-pattern:**
```typescript
// Current: creates throwaway Agent on EVERY LLM call (inside retry loop!)
const mastraAgent = new Agent({
  name: "agentforge-executor",
  instructions: systemPrompt,
  model: modelKey,
});
const result = await mastraAgent.generate(messages);
```

Mastra docs recommend defining agents once and registering them with a Mastra instance. Creating per-request means no memory persistence, no tool reuse, no observability context.

### 2.3 Mastra Instance Configuration — LARGELY UNUSED

| Issue | Severity | Location |
|-------|----------|----------|
| No agents registered with Mastra instance | WARNING | `packages/core/src/mastra.ts:101-112` |
| No workflows registered with Mastra instance | WARNING | `packages/core/src/mastra.ts:101-112` |
| No storage provider configured | WARNING | `packages/core/src/mastra.ts:101-112` |
| `apiKeys` passed to Mastra constructor (not a documented config option) | LOW | `packages/core/src/mastra.ts:106-107` |
| Mastra instance appears to be dead code (never imported by runtime) | WARNING | `packages/core/src/mastra.ts` |

### 2.4 Workflow Engine — SIGNIFICANT GAPS

| Issue | Severity | Location |
|-------|----------|----------|
| **No `suspend()` function used in step execute** | CRITICAL | `convex/lib/workflowEngine.ts:131,156` |
| No `resumeSchema` or `suspendSchema` on steps | CRITICAL | `convex/lib/workflowEngine.ts:126-145` |
| No `run.resume()` implementation | CRITICAL | `convex/lib/workflowEngine.ts:253-323` |
| All schemas are `z.object({}).passthrough()` (untyped) | WARNING | `convex/lib/workflowEngine.ts:129-130,154-155,190-191` |
| Suspend/resume detection code is dead (can never trigger) | WARNING | `convex/lib/workflowEngine.ts:272-298` |
| 7 `as any` casts to work around untyped Mastra return values | LOW | `convex/lib/workflowEngine.ts:194,263,269,274,283,285,302` |

**Detail — Suspend/Resume is non-functional:**

Mastra's suspend pattern requires:
```typescript
execute: async ({ inputData, resumeData, suspend }) => {
  if (!approved) return await suspend({ reason: "Human approval required." });
  return { output: "done" };
}
```

Our steps only destructure `{ inputData }` — they never receive or call `suspend`. The status-checking code for "suspended" runs in `executeWorkflow()` can never be reached.

### 2.5 Stale Provider List in packages/core/src/mastra.ts

The `SUPPORTED_PROVIDERS` array (line 34-74) lists outdated model names (`gpt-4`, `claude-3-opus`, `gemini-pro`) that don't match the up-to-date registry in `convex/llmProviders.ts`. These two lists are not synchronized.

---

## 3. Convex Documentation Comparison

Compared against official docs at docs.convex.dev (via Context7 documentation retrieval).

### 3.1 Schema Issues

| Issue | Severity | Detail |
|-------|----------|--------|
| **17 uses of `v.any()` in schema** | MEDIUM | Bypasses Convex type safety. Fields like `messages.tool_calls`, `agents.tools`, `projects.settings` have known shapes that should be typed. |
| **Redundant custom ID pattern** | MEDIUM | `agents` table has custom `id: v.string()` + `byAgentId` index when Convex provides `_id` natively. Same for `sessions.sessionId`, `instances.instanceId`. Doubles lookup cost. |
| **Missing compound indexes** | MEDIUM | See section 3.2 below |
| **Boolean-only indexes (low cardinality)** | LOW | 7 standalone boolean indexes (`byIsActive`, `byIsEnabled`, `byIsInstalled`) are inefficient. Should be compound indexes or removed. |

### 3.2 Missing Compound Indexes

These queries filter in-memory after an index lookup, causing unnecessary data fetching:

| Query | Current Index | Suggested Compound Index |
|-------|--------------|-------------------------|
| `agents.listActive` with userId | `byIsActive` then JS filter | `["isActive", "userId"]` |
| `skills.listInstalled` with projectId | `byProjectId` then JS filter | `["projectId", "isInstalled"]` |
| `projects.getOrCreateDefault` | `byUserId` then `.filter(isDefault)` | `["userId", "isDefault"]` |
| `usage` time-range queries | `byUserId` or `byAgentId` | `["userId", "timestamp"]`, `["agentId", "timestamp"]` |

### 3.3 HTTP Actions Issues

| Issue | Severity | Location |
|-------|----------|----------|
| **No CORS headers** | CRITICAL | `convex/http.ts` — Frontend cannot call this endpoint from browser |
| **No authentication on file download** | CRITICAL | `convex/http.ts:11-29` — Anyone with a file ID can download |
| No error handling for getDownloadUrl failure | MEDIUM | `convex/http.ts:18` — 500 instead of 404 on missing file |
| Content-Disposition header on 302 redirect (ignored by browsers) | LOW | `convex/http.ts:25` |

### 3.4 Query/Mutation Anti-Patterns

| Issue | Severity | Detail |
|-------|----------|--------|
| **Zero pagination anywhere** | CRITICAL | 94 uses of `.collect()`, 0 uses of `.paginate()`. Tables like `messages`, `usage`, `logs` will cause memory issues at scale. |
| **Unbounded cascade deletes** | MEDIUM | `convex/projects.ts:90-137` collects ALL threads, messages, files, folders in one mutation. Will timeout with large projects. |
| Duplicate mutations (`messages.add` vs `messages.create`) | LOW | Nearly identical; `add` updates thread timestamp, `create` doesn't. Confusing API. |

### 3.5 File Storage

The implementation uses a hybrid approach: Convex's built-in `ctx.storage` for upload/URL generation (`files.generateUploadUrl`, `files.confirmUpload`) plus metadata stored in the `files` table with external R2 URLs.

| Issue | Severity | Detail |
|-------|----------|--------|
| **`storageId` not persisted after upload** | MEDIUM | `confirmUpload` accepts `storageId`, resolves it to a URL via `ctx.storage.getUrl()`, but never saves the `storageId` to the database. The stored file becomes an orphan that cannot be deleted or re-resolved if the URL expires. Convex docs recommend storing `v.id("_storage")`. |
| Hybrid R2 + Convex storage is confusing | MEDIUM | `files.create` accepts any URL directly (R2), while `files.confirmUpload` uses Convex native storage. Two different storage paths, same table. Should pick one. |
| MIME type allowlist defined but not enforced | LOW | `convex/lib/fileUpload.ts` defines `ALLOWED_MIME_TYPES` but `validateFileUpload` only checks file size, not MIME type. |

---

## 4. Code Quality Audit

### 4.1 `as any` Usage

| Location | Count | Justified? |
|----------|-------|------------|
| `convex/_generated/api.ts` | 2 | Yes — auto-generated |
| `convex/lib/workflowEngine.ts` | 7 | Partially — Mastra return types are untyped |
| `convex/sessions.ts` | 1 | No — enum cast avoidable |
| `convex/cronJobs.ts` | 1 | No — lazy type assertion |
| `convex/migrations/addProjectScoping.ts` | 5 | Partially — migration needs dynamic table access |
| `packages/core/src/mastra.ts` | 2 | No — `mastraConfig: any` avoidable |
| `packages/cli/src/commands/*.ts` | ~110 | Mixed — CLI commands have heavy JSON parsing |
| **Total production code** | ~128 | |
| **Total test code** | ~30 | Acceptable in tests |

### 4.2 TODO/FIXME Comments

| Location | Comment |
|----------|---------|
| `convex/cronJobs.ts:98` | `TODO: Parse cron expression to calculate nextRun` |
| `convex/cronJobs.ts:130` | `TODO: Parse cron` — hardcoded 1-hour interval instead of actual cron parsing |
| `convex/heartbeat.ts:326` | `TODO: Integrate with Mastra to execute pending tasks` |

The cron job `nextRun` calculation is hardcoded to 1 hour regardless of actual schedule expression. This means all cron jobs run every hour.

### 4.3 Console.log in Production Code

- `convex/`: 8 occurrences (error/warn logging — acceptable for serverless)
- `packages/core/src/`: ~20 occurrences (channel adapters use console for logging — acceptable with log levels)
- `packages/cli/src/`: ~200 occurrences (CLI tool — expected, uses console for user output)

No inappropriate debug logging found in production paths.

### 4.4 Security Issues

| Issue | Severity | Location |
|-------|----------|----------|
| **Dynamic code execution in template** | HIGH | `packages/cli/templates/default/dashboard/app/routes/skills.tsx:57` — Executes arbitrary user-provided JavaScript via dynamic function construction. This is a code injection risk. |
| **No auth on file download HTTP action** | HIGH | `convex/http.ts:11-29` — Unauthenticated file access |
| **No CORS configuration** | HIGH | `convex/http.ts` — Missing CORS headers |
| Vault encryption key management unclear | MEDIUM | `convex/schema.ts:335` — Schema stores `encryptedValue` and `iv` but encryption key source not visible in code |

The dynamic code execution in the template is in a dashboard skill executor. While it's in a template (not production runtime), users who scaffold from this template will have a code injection vulnerability in their dashboard.

### 4.5 Test Quality

Most test files contain meaningful behavioral tests:
- `tests/workflow-engine.test.ts` — 98 tests covering step building, workflow execution, branching, error handling
- `tests/project-scoping.test.ts` — 53 tests covering project isolation, config cascade
- `tests/llm-models.test.ts` — 39 tests covering model registry, failover chains
- `packages/channels-discord/src/discord-adapter.test.ts` — 36 tests covering adapter lifecycle, events

**Test gaps:**
- `convex/schema.test.ts` — 0 tests (broken module resolution)
- `tests/e2e/convex-adapter.test.ts` — 0 tests (broken module resolution)
- `tests/e2e/deploy.test.ts` — 0 tests (broken module resolution)
- No integration tests for `convex/http.ts` file download endpoint
- No tests for `convex/workflows.ts` CRUD operations (only the engine is tested)
- No tests for the `convex/chat.ts` sendMessage action (the core LLM execution path)

---

## 5. Cross-Reference Validation

### 5.1 Schema Tables vs. Query/Mutation Files — PASS

All 22 tables in `convex/schema.ts` have corresponding query/mutation files. No orphaned table references found. All `withIndex()` calls reference indexes that exist in the schema.

### 5.2 Discord Adapter vs. Core ChannelAdapter — PASS

`packages/channels-discord/src/discord-adapter.ts` correctly:
- Imports and extends `ChannelAdapter` from `@agentforge-ai/core`
- Implements all required interface methods (`start`, `stop`, `sendMessage`, etc.)
- Uses `MessageNormalizer` from core
- Exports proper types matching core's `ChannelConfig`, `InboundMessage`, `OutboundMessage`

### 5.3 LLM Provider Model IDs vs. Mastra Naming Conventions — PASS

All 33 model IDs in `convex/llmProviders.ts` follow the `"provider/model-name"` format:
- OpenAI: `openai/gpt-4o`, `openai/gpt-4.1`, `openai/o3`, etc.
- Anthropic: `anthropic/claude-opus-4-6`, `anthropic/claude-sonnet-4-6`, etc.
- OpenRouter: `openrouter/meta-llama/llama-4-maverick` (3-part format for upstream providers)

These align with Mastra's documented model string conventions.

### 5.4 Stale Model List in packages/core/src/mastra.ts — FAIL

`SUPPORTED_PROVIDERS` (line 34-74) lists outdated models:
- `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo` (deprecated/old names)
- `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku` (old generation)
- `gemini-pro`, `gemini-ultra` (old names)
- Missing: `gpt-4.1`, `o3`, `o4-mini`, `claude-opus-4-6`, `gemini-2.5-*`, all DeepSeek/Mistral/Cohere/xAI models

This list is out of sync with the authoritative `convex/llmProviders.ts` registry.

### 5.5 Cost Estimation Function — STALE

`packages/core/src/mastra.ts:estimateCost()` (line 220-245) has hardcoded pricing for old models (`gpt-4`, `claude-3-opus`, etc.) while `convex/llmProviders.ts` has accurate pricing data for current models. These are not synchronized.

---

## 6. CI/CD Pipeline Review

### 6.1 ci.yml — GOOD

Standard CI pipeline: checkout, pnpm install, build, test, typecheck. Uses `--frozen-lockfile`. Triggers on push to main and PRs.

### 6.2 cli-build.yml — GOOD

Auto-rebuilds CLI dist when template/source changes. Uses bot commit for auto-push. Path-filtered trigger is appropriate.

### 6.3 e2e.yml — GOOD with minor issue

Well-structured 3-stage pipeline (local, cloud, coverage). Cloud tests properly gated behind secrets and manual trigger.

**Minor issue:** Triggers include `branches: [main, develop]` but the project uses no `develop` branch (per CLAUDE.md: "always push branch directly to main"). The `develop` reference is harmless but misleading.

---

## 7. Summary: Issues by Priority

### CRITICAL (Must fix before release) — 6 issues

1. **No CORS headers on HTTP actions** (`convex/http.ts`) — Frontend cannot call file download endpoint from browser
2. **No authentication on file download** (`convex/http.ts`) — Unauthenticated file access to any file by ID
3. **Zero pagination in queries** — 94 `.collect()` calls, 0 `.paginate()`. Will cause memory issues and timeouts at scale on `messages`, `usage`, `logs` tables
4. **Workflow suspend/resume is non-functional** (`convex/lib/workflowEngine.ts`) — Steps don't use `suspend()` function, no `resumeSchema`, no `run.resume()` path. Entire HITL workflow feature is dead code.
5. **Agent created per-request in LLM execution** (`convex/mastraIntegration.ts:125`) — Throwaway Agent instance on every single LLM call (inside retry loop). No memory, no tool reuse, no observability.
6. **3 test suites broken** (module resolution) — `convex/schema.test.ts`, `tests/e2e/convex-adapter.test.ts`, `tests/e2e/deploy.test.ts`

### HIGH (Should fix soon) — 4 issues

7. **Dynamic code execution in template** (`packages/cli/templates/default/.../skills.tsx:57`) — Users who scaffold from this template get a code injection vulnerability
8. **Cron job scheduling hardcoded to 1 hour** (`convex/cronJobs.ts:130`) — `nextRun` ignores actual cron expression, always adds 1 hour
9. **17 uses of `v.any()` in schema** — Bypasses Convex type safety on 17 fields
10. **Unbounded cascade deletes** (`convex/projects.ts`) — Deleting a project collects all related data in one mutation; will timeout with large projects

### MEDIUM (Should address) — 7 issues

11. Missing compound indexes (4+ queries do in-memory filtering after index lookup)
12. Redundant custom ID pattern on `agents`, `sessions`, `instances` tables
13. `temperature`/`maxTokens` options accepted but never passed to Agent constructor or generate()
14. Stale model list in `packages/core/src/mastra.ts` vs `convex/llmProviders.ts`
15. Stale cost estimation function with hardcoded old model pricing
16. `Content-Disposition` header on 302 redirect (ignored by browsers)
17. Mastra instance configuration is dead code (never used by runtime)

### LOW (Nice to have) — 5 issues

18. 7 standalone boolean-only indexes (low cardinality, inefficient)
19. Duplicate mutations (`messages.add` vs `messages.create`)
20. ~128 `as any` casts in production code (most in CLI, some avoidable)
21. `develop` branch referenced in e2e.yml but doesn't exist
22. Workflow engine schemas are all `z.object({}).passthrough()` (untyped)

---

## Recommendations

### Immediate (Sprint 2.0 blockers)

1. Add CORS headers + OPTIONS handler to `convex/http.ts`
2. Add `ctx.auth.getUserIdentity()` check to file download endpoint
3. Add pagination to `messages.list`, `usage` queries, and `logs` queries
4. Fix 3 broken test suites (add Vitest alias config for workspace packages)

### Short-term (Next 2 sprints)

5. Implement actual Mastra suspend/resume in workflow engine steps
6. Refactor `mastraIntegration.ts` to cache Agent instances (at minimum per-model, ideally per agent config)
7. Replace `v.any()` with typed validators where shapes are known
8. Add compound indexes for common query patterns
9. Implement actual cron expression parsing (replace hardcoded 1-hour interval)
10. Synchronize model lists between `packages/core/src/mastra.ts` and `convex/llmProviders.ts`

### Medium-term (Quality improvements)

11. Remove dead Mastra instance code or wire it into the runtime properly
12. Add integration tests for `convex/chat.ts` sendMessage and `convex/workflows.ts` CRUD
13. Implement batched cascade deletes for project removal
14. Replace dynamic code execution in CLI template with a sandboxed approach
15. Reduce `as any` usage in CLI commands with proper type definitions

---

*Report generated by full codebase audit. No changes were committed.*

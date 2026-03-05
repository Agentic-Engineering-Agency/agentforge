# AgentForge — Project State Document

**Version:** v0.11.21  
**Date:** March 4, 2026  
**Author:** Seshat (automated audit)  
**Purpose:** Comprehensive codebase state for Lalo to continue development

---

## 1. Architecture Overview

### Published Packages (npm)
| Package | Version | Description |
|---------|---------|-------------|
| `@agentforge-ai/core` | 0.11.21 | Core library — Convex schema, functions, LLM integration |
| `@agentforge-ai/cli` | 0.11.21 | CLI tool — project scaffolding, agent management, dashboard |

### Legacy Packages (NOT published, can be removed)
| Directory | Status |
|-----------|--------|
| `packages/cloud-client/` | Empty — no package.json |
| `packages/convex-adapter/` | Empty — no package.json |
| `packages/sandbox/` | Empty — no package.json |
| `packages/web/` | v0.8.0 — old web UI, superseded by per-project `dashboard/` |

### Monorepo Structure
```
agentforge/
├── packages/
│   ├── core/           # Published — template files, core lib, tests (757 tests)
│   ├── cli/            # Published — CLI commands, project scaffolding
│   │   └── templates/default/  # ⭐ Canonical template source
│   ├── web/            # ❌ Legacy — remove or archive
│   ├── cloud-client/   # ❌ Empty — remove
│   ├── convex-adapter/ # ❌ Empty — remove
│   └── sandbox/        # ❌ Empty — remove
├── convex/             # Template copy #2 (for local dev/testing)
├── templates/default/  # Template copy #3
├── docs/               # User-facing documentation
├── examples/finforge/  # Example project (builds, typechecks)
├── specs/              # SpecSafe specifications
├── research/           # Research notes
└── tests/              # Integration tests
```

### Template Sync Problem ⚠️
There are **4 locations** where Convex template files must stay in sync:
1. `packages/cli/templates/default/convex/` ← **CANONICAL SOURCE**
2. `packages/cli/dist/default/convex/` ← built copy for npm
3. `templates/default/convex/` ← root copy
4. `convex/` ← local dev copy

**Any edit to template files MUST be synced to all 4 locations** or bugs will appear in new vs existing projects. This is the #1 source of regressions.

**Recommendation:** Automate this with a `sync-templates` script or eliminate redundant copies.

---

## 2. What Works (Verified with Live Convex Deployment)

### Tested against: `hallowed-stork-858` (Convex cloud, AgenticEngineering team)

### CLI Commands ✅
| Command | Status | Notes |
|---------|--------|-------|
| `agentforge create <name>` | ✅ | Scaffolds project, installs deps (pnpm/npm fallback) |
| `agentforge status` | ✅ | Shows project health, Convex connection, provider config |
| `agentforge agents list` | ✅ | Lists agents with ID, model, provider, active status |
| `agentforge agents create` | ✅ | Interactive agent creation |
| `agentforge models list --provider openai` | ✅ | Shows 12 live models from OpenAI API (v0.11.20 fix) |
| `agentforge keys add <provider> <key>` | ✅ | Stores encrypted API key |
| `agentforge keys list` | ✅ | Lists stored keys (values hidden) |
| `agentforge vault set/get/list/delete` | ✅ | Requires `VAULT_ENCRYPTION_KEY` env var (AES-256-GCM) |
| `agentforge tokens generate` | ✅ | Creates API access tokens for `/v1/chat/completions` |
| `agentforge threads list` | ✅ | Lists conversation threads |
| `agentforge logs` | ✅ | Shows recent activity logs |
| `agentforge skills list` | ✅ | Shows installed skills |
| `agentforge cron list` | ✅ | Lists cron jobs |
| `agentforge config show` | ✅ | Shows env config |
| `agentforge heartbeat` | ✅ | Checks pending tasks |
| `agentforge dashboard` | ✅ | Launches Vite dev server on port 3000 |
| `agentforge upgrade` | ✅ | Syncs convex/ from latest template |

### CLI Commands That Need Work
| Command | Status | Issue |
|---------|--------|-------|
| `agentforge chat <agent-id>` | ⚠️ | Works but stdin pipe hangs; interactive mode requires manual exit |
| `agentforge projects create` | ⚠️ | Interactive only — no `--name` flag for non-interactive use |
| `agentforge cron create` | ⚠️ | Interactive only — no non-interactive flags |
| `agentforge research <topic>` | ⚠️ | Runs but `--format` flag documented but doesn't exist |
| `agentforge voice` | ❌ | No subcommands registered (empty) |
| `agentforge browser` | ❌ | No subcommands registered (empty) |

### Chat Pipeline ✅
| Test | Result | Latency |
|------|--------|---------|
| OpenAI gpt-4o-mini chat | ✅ | ~1-13s (cold start varies) |
| Agent creation + thread + message | ✅ | End-to-end verified |
| Multi-provider failover chain | ✅ | Falls to next provider on auth errors |
| Error classification (rate_limit, auth, timeout) | ✅ | Breaks retry on auth errors |

### Dashboard (Web UI) ✅
| Feature | Status |
|---------|--------|
| Vite dev server startup | ✅ (port 3000) |
| Convex real-time connection | ✅ |
| All query endpoints (agents, threads, sessions, etc.) | ✅ (10/10 verified via HTTP) |

### Convex Deployment ✅
| Metric | Value |
|--------|-------|
| Schema tables | 25+ |
| Indexes created | 108 |
| TypeScript errors | 0 |
| Deploy time | ~5s |

---

## 3. Provider Support Matrix

### Model Fetching (modelFetcher.ts)
| Provider | Live API Fetch | Static Fallback |
|----------|---------------|-----------------|
| OpenAI | ✅ (12 models via allowlist) | ✅ |
| Anthropic | ✅ | ✅ |
| Google | ✅ | ✅ |
| Mistral | ✅ | ✅ |
| DeepSeek | ✅ | ✅ |
| xAI / Grok | ✅ | ✅ |
| OpenRouter | ✅ | ✅ |
| Cohere | ✅ | ✅ |

### Chat (lib/agent.ts)
| Provider | SDK Used | Status |
|----------|----------|--------|
| OpenAI | `@ai-sdk/openai-compatible` | ✅ Verified |
| Anthropic | `@ai-sdk/anthropic` (native) | ✅ Added v0.11.19 |
| Google | `@ai-sdk/google` (native) | ✅ Added v0.11.19 |
| Mistral | `@ai-sdk/openai-compatible` | ✅ Compatible |
| DeepSeek | `@ai-sdk/openai-compatible` | ✅ Compatible |
| xAI / Grok | `@ai-sdk/openai-compatible` | ✅ Compatible |
| OpenRouter | `@ai-sdk/openai-compatible` | ✅ Compatible |
| Cohere | `@ai-sdk/openai-compatible` | ⚠️ Uses `/compatibility/v1` |

---

## 4. Security Audit

### Dependency Vulnerabilities
| Package | Severity | Status |
|---------|----------|--------|
| `hono` < 4.12.4 | HIGH — arbitrary file access | ✅ Fixed via pnpm overrides |
| `@hono/node-server` < 1.19.10 | HIGH — auth bypass | ✅ Fixed via pnpm overrides |
| `hono` < 4.12.4 | MODERATE — cookie injection, SSE injection | ✅ Fixed via pnpm overrides |

**Current: 0 known vulnerabilities** (`pnpm audit` clean)

### Secret Scanning
| Check | Result |
|-------|--------|
| Hardcoded API keys in source | ✅ None found |
| Credentials in test files | ✅ None found |
| Leaked keys in git history | ⚠️ Not checked (recommend `git-secrets` or `trufflehog`) |

### API Key Encryption (CRITICAL ⚠️)
**Current implementation in `apiKeys.ts`:** XOR cipher with repeating key

```typescript
// Current (WEAK):
const key = salt + iv;
charCode ^ key.charCodeAt(i % key.length)
```

**Issues:**
1. **XOR with repeating key is trivially breakable** — known-plaintext attacks work since API keys have known prefixes (`sk-`, `sk-ant-`, etc.)
2. **Default salt is hardcoded:** `"agentforge-default-salt"` — if `AGENTFORGE_KEY_SALT` env var not set, all keys are trivially decryptable
3. **No authentication (no HMAC/tag)** — ciphertext can be modified without detection
4. **IV is `Date.now().toString(36)`** — predictable, not cryptographically random

**Why not already fixed:** Attempted AES-256-GCM upgrade. Convex V8 runtime's `crypto.subtle` PBKDF2/HKDF adds 10-19s latency per decryption. This makes chat unusable. Proper fix requires:
- Move `getDecryptedForProvider` to a `"use node"` action file (native Node.js crypto is fast)
- Change callers from `ctx.runQuery()` to `ctx.runAction()`
- Update `chat.ts` and `modelFetcher.ts` accordingly

**Contrast:** `vault.ts` uses proper AES-256-GCM with `crypto.subtle` and 100k PBKDF2 iterations — this works because vault operations are infrequent. API key decryption happens on every chat message.

**Recommendation:** HIGH priority fix. Move encryption to `"use node"` action file.

### Convex Function Security
| Check | Result |
|-------|--------|
| `getActiveForProvider` returns decrypted key? | ⚠️ YES — public query returns `decryptedKey` field. **Should strip sensitive fields.** |
| Auth/ownership checks on queries | ⚠️ `userId` is optional — no enforcement. Any caller can read all agents/keys/files |
| Decrypted keys logged to console | ✅ No console.log/error on decrypted keys |
| Input validation on mutations | ✅ Convex validators enforce types |
| Rate limiting on LLM calls | ❌ None — any client can spam `chat:sendMessage` |

### Recommendations (Priority Order)
1. **HIGH:** Move API key decryption to `"use node"` action with real AES-256-GCM
2. **HIGH:** Remove `decryptedKey` from `getActiveForProvider` response (public query leaks decrypted keys)
3. **HIGH:** Add authentication/authorization to Convex functions (currently no user verification)
4. **MEDIUM:** Add rate limiting to `chat:sendMessage` action
5. **MEDIUM:** Run `trufflehog` or `git-secrets` on git history
6. **LOW:** Replace `Date.now().toString(36)` IV with `crypto.getRandomValues()`

---

## 5. Quality Check

### TypeScript
| Package | `tsc --noEmit` | Notes |
|---------|----------------|-------|
| `packages/core` | ✅ 0 errors | |
| `packages/cli` | ✅ 0 errors | |
| Template `convex/` | ✅ 0 errors | Verified via `npx convex dev --once` |
| `examples/finforge` | ✅ 0 errors | |

### Tests
| Suite | Count | Status |
|-------|-------|--------|
| `packages/core` (vitest) | 757 | ✅ All passing |
| Duration | 10.4s | |

### Code Quality Issues
1. **Template duplication:** 4 copies of every Convex file. Any bug fix requires 4-way sync.
2. **Empty CLI commands:** `voice` and `browser` have no subcommands — show empty help.
3. **Interactive-only commands:** `projects create`, `cron create` can't be scripted.
4. **`usage` command doesn't exist** — shown in some docs but not implemented.

### Documentation Status (after cleanup)
| File | Status | Notes |
|------|--------|-------|
| `README.md` | ⚠️ Needs update | References old package structure |
| `docs/getting-started.md` | ✅ Updated | Reflects v0.11.x flow |
| `docs/CLI.md` | ⚠️ Review needed | May reference removed commands |
| `docs/architecture.md` | ⚠️ Review needed | Should reflect 2-package structure |
| `docs/DESIGN-PROJECT-CONFIG.md` | ✅ Keep | Useful internal design doc (1367 lines) |
| `docs/skills.md` | ✅ Current | |
| `docs/mcp.md` | ✅ Current | |
| `docs/channels.md` | ⚠️ Review | May reference removed auth system |
| `docs/deployment-guide.md` | ⚠️ Review | Only remaining deployment doc |
| `CHANGELOG.md` | ⚠️ Needs update | Missing v0.10.18 through v0.11.21 entries |
| `CONTRIBUTING.md` | ✅ Keep | |
| `CODE_OF_CONDUCT.md` | ✅ Keep | |
| `PROJECT_STATE.md` | ✅ This document | |

### Files Removed (14 stale docs)
```
AUDIT-AGENT-PROMPT.md, AUDIT-FEATURE-REPORT-2026-03-02.md,
AUDIT-REPORT-2026-03-02-SUPERSEDED.md, AUDIT-REPORT-2026-03-02.md,
AUDIT-REPORT.md, AUDIT.md, CLOUD_DEPLOY_SUMMARY.md, 
COMPLETION_SUMMARY.md, CONCURRENT_PLAN.md, CONVEX-FIXES.md,
HEARTBEAT.md, INTEGRATION_SYNC.md, NPM_PUBLISH_INSTRUCTIONS.md,
RELEASE_v0.3.0.md, docs/deployment.md (stale), docs/cli-reference.md (empty)
```

---

## 6. Version History (v0.10.18 → v0.11.21)

| Version | Key Changes |
|---------|-------------|
| v0.10.18 | Auth/login system removed |
| v0.10.19 | Voice module exports fixed |
| v0.10.20 | Template `usage.list`/`logs.list` bare calls fixed |
| v0.10.21 | Provider card descriptions wired to live `modelFetcher` |
| v0.10.22 | Agent modals use dynamic `useProviderModels()` hook |
| v0.11.0 | SPEC-017 (Workspace), SPEC-018 (Skills), SPEC-019 (Deprecated models) |
| v0.11.1-4 | Functional test fixes: skills refs, chat crash, schema, model prefix |
| v0.11.5 | fileIds validator, model prefix strip, cronJobs.updateRun |
| v0.11.6 | `agentforge upgrade` command, Convex login detection |
| v0.11.7 | Missing `llmProviders.ts` in template |
| v0.11.8-9 | TypeScript error fixes (110+58 errors fixed) |
| v0.11.10 | Real tsc fixes: ctx.db in action, generateResponse→executeAgent |
| v0.11.11-12 | Moved `insertToken` to correct file, fixed stray braces |
| v0.11.13 | Removed openrouter from default failover, fixed deprecated claude model |
| v0.11.14 | **CRITICAL:** `keyData?.apiKey` always undefined — API keys never worked before this |
| v0.11.15 | `agentforge create` falls back to npm install if pnpm unavailable |
| v0.11.16 | `getModelsForProvider` is action not query; `refreshAllModels` made public |
| v0.11.17 | CLI models display: `cached` is array not `{models:[]}` |
| v0.11.18 | **modelFetcher:** same `keyData?.apiKey` bug — live fetch was dead code |
| v0.11.19 | **Native Anthropic + Google SDK** — proper auth for all providers |
| v0.11.20 | CLI models display: show `m.displayName` not `[object Object]`; agent.ts type fix |
| v0.11.21 | Docs cleanup (14 files), hono CVE fixes, template sync |

---

## 7. Known Issues & Technical Debt

### Critical
1. **API key encryption is XOR** — trivially breakable with known-plaintext attacks
2. **`getActiveForProvider` leaks decrypted keys** — public query returns raw API keys
3. **No authentication on Convex functions** — any caller can access all data

### High
4. **Template 4-way sync** — every file change requires manual sync to 4 locations
5. **Chat cold start latency** — first call to `"use node"` action takes 10-15s
6. **`packages/web/`** — stale v0.8.0 package, not used, confuses contributors
7. **CHANGELOG.md** — not updated since early versions
8. **README.md** — references old architecture

### Medium
9. **Empty CLI commands** — `voice`, `browser` have no implementations
10. **Interactive-only commands** — `projects create`, `cron create` need `--name` flags
11. **Usage tracking** — `completionTokens`/`promptTokens` always 0 (AI SDK v5 streaming usage not awaited correctly)
12. **`research --format` flag** — documented but doesn't exist
13. **No rate limiting** on LLM calls

### Low
14. **`@tanstack/react-router` peer dependency** — unmet peer (1.120.20 vs ^1.160.2)
15. **Dashboard form focus trap** — agent create modal name field clears on provider switch
16. **`agentforge chat` stdin** — hangs on piped input, only works interactively

---

## 8. Recommendations for Lalo

### Immediate (before any new features)
1. **Fix API key encryption** — move to `"use node"` action with AES-256-GCM
2. **Strip `decryptedKey` from public queries** — security vulnerability
3. **Automate template sync** — add a `pnpm sync-templates` script
4. **Remove empty packages** — `cloud-client/`, `convex-adapter/`, `sandbox/`
5. **Update CHANGELOG.md and README.md**

### Short-term
6. **Add Convex Auth** — all functions currently accept any caller
7. **Implement rate limiting** on `chat:sendMessage`
8. **Fix usage tracking** — `await result.usage` in streaming mode
9. **Add `--name` flags** to interactive-only commands
10. **Wire up `voice` and `browser` CLI commands** or remove them

### Architecture
11. **Consider eliminating template duplication** — use a single source of truth with a build step that copies to dist
12. **Evaluate cold-start optimization** — consider caching Convex actions or using edge functions
13. **Add integration tests** — currently only unit tests; need end-to-end tests against a Convex deployment

---

## 9. How to Test (Reproduction Steps)

```bash
# 1. Install CLI
npm install -g @agentforge-ai/cli@0.11.21

# 2. Create project
agentforge create my-test
cd my-test

# 3. Deploy to Convex
npx convex dev  # Interactive — creates project, deploys schema

# 4. Set API key
npx convex env set OPENAI_API_KEY "sk-..."

# 5. Create agent
npx convex run agents:create '{"id":"agent-1","name":"Test","model":"gpt-4o-mini","provider":"openai","instructions":"Be helpful."}'

# 6. Test chat
THREAD=$(npx convex run threads:createThread '{"agentId":"agent-1"}' | tr -d '"')
npx convex run chat:sendMessage "{\"agentId\":\"agent-1\",\"threadId\":\"$THREAD\",\"content\":\"Hello\"}"

# 7. Launch dashboard
agentforge dashboard
# Open http://localhost:3000
```

---

## 10. Test Deployments Created During Audit

| Project | Convex ID | Team | Notes |
|---------|-----------|------|-------|
| test-app | `brazen-bulldog-292` | AgenticEngineering | First test (v0.11.16) |
| test-proj | `hallowed-stork-858` | AgenticEngineering | Main test (v0.11.20+) |

These can be deleted from the Convex dashboard when no longer needed.

---

*Generated by Seshat — AgentForge audit session, March 4, 2026*

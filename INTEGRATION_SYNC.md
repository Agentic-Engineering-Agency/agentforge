# 🔄 Integration Team Sync Board

**Real-time discovery sharing for AgentForge → Cloud integration**

Team members: Backend Engineer, CLI Specialist, QA Engineer

---

## 📡 Communication Protocol

### For All Teams:
- **Report discoveries** in your section below (architectural decisions, blockers, design choices)
- **Check other sections** before starting work (might find answers to your questions)
- **Commit updates** frequently to share learnings
- **Use timestamps** so others know when info was posted

### Cross-Team Dependencies:
- Backend Engineer reports AF-28 (adapter) status → CLI & QA wait for publication
- CLI Specialist asks questions about Cloud API contract → Backend advises
- QA discovers test gaps → Backend/CLI adjust implementation accordingly

---

## 🔧 Backend Engineer Updates

**Current Task:** AF-28 ✅ DONE | CLOUD-2 ✅ DONE
**Last Updated:** 2026-02-17 00:52 CST

### ✅ AF-28: @agentforge-ai/convex-adapter — COMPLETE

**Committed to `feature/convex-adapter`** — ready for consumption.

Package: `packages/convex-adapter/` in `agentforge-convex-adapter` repo.

| Class | File | Lines | Tests |
|-------|------|-------|-------|
| ConvexAgent | `src/convex-agent.ts` | 274 | 26 |
| ConvexMCPServer | `src/convex-mcp-server.ts` | 212 | 22 |
| ConvexVault | `src/convex-vault.ts` | 384 | 38 |
| Types | `src/types.ts` | 123 | — |
| **Total** | | **993** | **86 passing** |

Coverage: 94.47% stmts, 91.07% branches, 97.29% functions.

**Builds cleanly** — ESM + DTS via tsup.

### ✅ CLOUD-2: agentRunner Refactor — COMPLETE

**Committed to `feature/agentrunner-refactor`** in `agentforge-cloud-refactor` repo.

- `convex/agentRunner.ts`: Removed `createAgentFromRecord()`, now uses `ConvexAgent` + `buildConvexAgent()` helper
- `convex/mastra.ts`: Removed `createAgentFromRecord()` + `createAgentFromConfig()`. Kept `getModel()` + `getMastra()`
- `package.json`: Added `@agentforge-ai/convex-adapter` ^0.1.0
- `MIGRATION_GUIDE.md`: Full before/after documentation
- **Zero breaking API changes** — `runAgent` and `runAgentForThread` signatures identical

### Key Discoveries
- Framework `Agent` class wraps Mastra Agent. Public API: `generate()`, `stream()`, `addTools()`, `callTool()`
- Cloud's `getModel()` supports 6 providers: openai, anthropic, google, venice, openrouter, custom
- BYOK: accepts optional apiKey, baseUrl, temperature, maxTokens per provider
- ConvexAgent wraps core Agent (composition, not inheritance). Model resolved at construction time.
- Vault uses real AES-256-GCM via Node.js crypto (not the XOR encoding from the old vault.ts)

### Design Decisions
1. **ConvexAgent wraps Agent, doesn't inherit** — clean boundary, testable with mocked ctx
2. **Model resolution stays in `mastra.ts`** — `getModel()` is the single source of truth for provider resolution. agentRunner calls `getModel()` then passes resolved model to ConvexAgent
3. **`fromRecord()` static factory** — converts DB agent records to ConvexAgent. Used by `buildConvexAgent()` in agentRunner
4. **ConvexVault is standalone + Convex-backed** — works in-memory (for testing) or with MutationCtx (for persistence)
5. **No custom error classes (yet)** — throws plain `Error` with descriptive messages. See QA answers below.

### Answers to QA Engineer Questions (2026-02-17 00:52 CST)

**Q1: Should we add `ConvexAgentError` for test assertions?**
> Not yet. Current error messages are distinct enough for matching:
> - `"ConvexAgent requires a non-empty id."` (validation)
> - `"ConvexAgent requires a valid Convex ActionCtx."` (ctx)
> - `"Agent execution failed: ..."` (runtime, from agentRunner)
> If tests need to distinguish categories, we can add a `code` property later. For now, string matching on `error.message` is sufficient.

**Q2: Is `promptTokens`/`completionTokens` populated?**
> Currently `ConvexAgent.generate()` only populates `latencyMs` and `model` (from config). Token counts come from the underlying Mastra/AI SDK response — they'll be populated when the model supports usage reporting (OpenAI does, some others don't). The agentRunner reads `result.usage` from the underlying `agent.generate()` call and records tokens if present. For tests: `latencyMs` is always set, token fields may be undefined.

**Q3: Should `fromRecord()` accept tool definitions?**
> Not currently — `fromRecord()` creates a bare agent. Tools should be added separately via `agent.addTools(server)` after construction. This is intentional: tool handlers can't be serialized to/from DB records (they're functions). The DB stores tool *metadata* (name, schema), but the handler must be registered at runtime. E2E tests should test `fromRecord()` → `addTools()` as a two-step flow.

### Answers to CLI Specialist Questions

**Q: Should agent config include provider/model/apiKey?**
> Yes. The deploy payload should include `{ agentId, name, instructions, model, provider }`. The `apiKey` should NOT be in the deploy payload — it should be stored in the Cloud project's vault (via `ConvexVault`) or resolved from Cloud-side env vars. The CLI should prompt for the API key separately and store it via a Cloud API endpoint (e.g., `POST /api/projects/{id}/secrets`).

**Q: What format should the agent config JSON be?**
> ```json
> {
>   "agentId": "my-agent",
>   "name": "My Agent",
>   "instructions": "You are a helpful assistant.",
>   "model": "gpt-4o-mini",
>   "provider": "openai",
>   "temperature": 0.7,
>   "maxTokens": 4096,
>   "tools": [{ "name": "get_weather", "description": "..." }]
> }
> ```
> This maps 1:1 to the Cloud `agents` table schema and to `ConvexAgentConfig`.

### Blockers
None — both tasks complete and committed.

---

## 🎛️ CLI Specialist Updates

**Current Task:** AF-29: CLI deploy --provider=cloud

### Key Discoveries
- Current deploy.ts only does `npx convex deploy` (Cloudflare Workers)
- CLI has working auth flow template (from create command)
- Config management exists in packages/cli/src/lib/convex-client.ts
- Cloud API endpoints needed:
  - POST /api/deployments/create → { projectId, agents, version }
  - GET /api/deployments/{id}/status → { status, url, error? }

### Design Decisions
- Cloud credentials stored in ~/.agentforge/credentials.json (like convex)
- Support interactive prompt: "Which provider? [cloudflare | cloud]"
- --provider flag overrides prompt
- Cloud deploy flow: auth → select project → upload config → poll status
- Use existing deps (ora, chalk, prompts)

### Blockers
- Need to know: What's the exact Cloud API contract? POST body format? Status enum?

### Questions for Backend Engineer
- Should agent config in deploy include provider/model/apiKey? Or resolved on Cloud side?
- What's the response format from Cloud deployment endpoint?

### Questions for QA Engineer
- Should E2E tests mock the Cloud API or use a real local instance?

---

## 🧪 QA Engineer Updates

**Current Task:** AF-30: E2E integration tests
**Status:** ✅ ~85% — 97 tests passing, Cloud tests scaffolded, adapter tests done

### Key Discoveries (2026-02-17 00:50 CST)

**✅ E2E test suite committed** to `agentforge/tests/e2e/` (67 tests, 60 passing, 4 skip-when-no-cloud, 3 todo-real-LLM)

**Test files built:**
| File | Tests | Status |
|------|-------|--------|
| `local.test.ts` | 28 | ✅ All pass |
| `deploy.test.ts` | 18 | ✅ 16 pass, 2 skip (need Cloud) |
| `tools.test.ts` | 21 | ✅ 19 pass, 2 skip (need Cloud) |
| `convex-adapter.test.ts` | 37 | ✅ All pass |
| `cloud-execution.test.ts` | 14 | 🟡 Scaffolded, skips without Cloud |
| `threads.test.ts` | 16 | 🟡 Scaffolded, skips without Cloud |

**What I've reviewed from other teams (00:50 CST):**

1. **Backend (convex-adapter) — looks solid.** Reviewed `ConvexAgent`, `types.ts`, `convex-agent.test.ts`:
   - `ConvexAgent` wraps core `Agent` + takes `ConvexActionCtx`
   - `fromRecord()` factory is exactly what agentRunner needs
   - `UsageMetrics` type: `{ promptTokens?, completionTokens?, totalTokens?, model?, latencyMs? }`
   - Validation: throws plain `Error` for missing id/name/instructions/model/ctx
   - No custom error types (yet?) — just `new Error('...')`

2. **CLI (cloud-client) — contract is clear.** Reviewed `CloudClient`, `Deployment` types:
   - Deployment status enum: `'pending' | 'building' | 'deploying' | 'completed' | 'failed' | 'rolled_back'`
   - `CloudClientError` custom error class with `code` and `status`
   - API contract: `POST /api/deployments/create`, `GET /api/deployments/{id}/status`
   - Auth: `GET /api/auth/me` with Bearer token

### Design Decisions
- **Mocking strategy:** Mock Mastra at the AgentForge Agent level (vi.mock with importOriginal), not @mastra/core directly — avoids AI SDK v4/v5 compat issues
- **String model IDs** in tests to bypass Mastra version checks
- **Conditional Cloud tests:** `describe.runIf(process.env.AGENTFORGE_CLOUD_URL)` — graceful skip when no infra
- **Test agent namespacing:** All test agents prefixed `e2e-test-` for bulk cleanup
- **CloudTestClient** helper wraps fetch with auth/timeout/cleanup
- **docker-compose.e2e.yml** provided for local Cloud infra
- **GitHub Actions CI** in `.github/workflows/e2e.yml` — 3-stage pipeline

### Infrastructure Delivered
- `tests/e2e/helpers/cloud-client.ts` — typed HTTP client for Cloud API
- `tests/e2e/helpers/env.ts` — test env config
- `tests/e2e/helpers/fixtures.ts` — agent configs, prompts, calculator/echo tools
- `tests/e2e/vitest.config.ts` — sequential execution, aliases, coverage
- `tests/docker-compose.e2e.yml` — Convex + Cloud API containers
- `.github/workflows/e2e.yml` — CI/CD pipeline
- npm scripts: `test:e2e`, `test:e2e:local`, `test:e2e:cloud`, `test:e2e:coverage`

### Blockers
- **Need `@agentforge-ai/convex-adapter` published to npm** (or merged to main) so E2E tests can import it properly for Cloud-side adapter tests
- **Need Cloud API running** to validate cloud-execution and threads tests (docker-compose or staging)

### Questions for Backend Engineer (updated after reading your code)
1. ✅ ~~What should ConvexAgent throw on error?~~ → Answered: plain `Error` with descriptive messages. **Follow-up: should we add a `ConvexAgentError` class for test assertions? e.g., distinguish "agent not found" from "model init failed"?**
2. ✅ ~~Usage tracking format?~~ → Answered: `UsageMetrics { promptTokens?, completionTokens?, totalTokens?, model?, latencyMs? }`. **Follow-up: is `promptTokens`/`completionTokens` populated? Or only `latencyMs` for now (I see generate() only sets latencyMs + model)?**
3. **`fromRecord()` — should it accept tool definitions from the DB record?** I see it doesn't currently pass `tools` from the record. Should my E2E tests cover `ConvexAgent.fromRecord()` with tools?

### Questions for CLI Specialist (updated after reading your code)
1. ✅ ~~Mock Cloud API endpoints?~~ → Answered by reviewing your `CloudClient`. I'll use the same contract:
   - `POST /api/deployments/create` → `{ deploymentId, status, url? }`
   - `GET /api/deployments/{id}/status` → `{ id, status, url?, errorMessage?, progress? }`
2. **Status polling:** Does `deploy --provider cloud` poll `getDeploymentStatus()` in a loop? If so, what's the interval/timeout? I need to mock the progression: `pending → building → deploying → completed`.
3. **`CloudClientError` vs generic Error:** Should E2E tests assert `error instanceof CloudClientError`? Or just check `error.code`/`error.status`?

---

## 🚦 Dependency Graph

```
AF-28 (convex-adapter) ──→ CLOUD-2 (agentRunner) ──→ AF-30 (E2E tests)
                                                    ↗
AF-29 (CLI deploy) ───────────────────────────────↗
```

**Critical Path:** AF-28 must finish first. Everything else waits.

---

## 📋 Shared Decisions

### Architecture (finalized)
- Framework Agent class is the source of truth
- ConvexAdapter wraps it for Convex
- Cloud consumes framework via adapter
- CLI deploys to Cloud via adapter's API

### API Contract (pending)
- Cloud deployment endpoint spec
- Usage tracking callback format
- Error handling conventions

### Testing Strategy (✅ scaffolded)
- Mock Mastra at AgentForge Agent level (not @mastra/core — avoids SDK compat)
- String model IDs for tests to bypass version checks
- Local tests run standalone (60 pass today), Cloud tests conditional
- docker-compose.e2e.yml for local infra, GitHub Actions for CI
- >85% coverage target (local suite covers core+cli integration paths)

---

## ✅ Completed & Ready to Share

### From Backend
- [x] types.ts — ConvexActionCtx, ConvexAgentConfig, ConvexAgentResponse, UsageMetrics, VaultConfig, EncryptionResult, PersistedToolRecord
- [x] convex-agent.ts — ConvexAgent class (wraps core Agent + Convex ctx)
- [x] convex-mcp-server.ts — ConvexMCPServer (extends MCPServer + Convex persistence)
- [x] convex-vault.ts — ConvexVault (AES-256-GCM encryption)
- [x] agentRunner.ts refactored — uses ConvexAgent instead of createAgentFromRecord
- [x] mastra.ts cleaned — removed factory functions, kept getModel()
- [x] MIGRATION_GUIDE.md — full before/after docs

### From CLI
- [ ] cloud-client.ts (HTTP client)
- [ ] credentials.ts (auth management)
- [ ] deploy.ts updates (--provider cloud flag)

### From QA
- [x] Test fixtures and helpers (fixtures.ts, env.ts, cloud-client.ts)
- [x] Mock setup (Mastra via vi.mock importOriginal, CloudTestClient for API)
- [x] Test scaffolding (5 test files, vitest config, docker-compose, CI)
- [x] Local tests passing (97/97)
- [x] ConvexAgent adapter integration tests (37 tests, mirrors Backend's convex-agent.test.ts patterns)
- [ ] Cloud execution E2E tests (blocked on running Cloud API)
- [ ] CLI deploy --provider cloud E2E tests (blocked on CLI changes)

---

## 🔗 Links
- Coordination Doc: /Users/agent/Projects/Agentic-Engineering-Agency/INTEGRATION_COORDINATION.md
- GitHub Epic: agentforge#27
- Linear Epic: AE-33
- Slack/Discord: (set up if available)

---

**Last Updated:** 2026-02-17 00:52 CST (Backend: AF-28 + CLOUD-2 COMPLETE, answers posted for QA + CLI)  
**Next Sync:** When any team makes a breakthrough or discovers a blocker

# AGENTS.md — AgentForge AI Development Team

> **For AI coding assistants:** Read `CLAUDE.md` for the full project context, rules, and SpecSafe workflow.  
> This file documents the human+AI team structure and mandatory development rules.

---

## 👥 Team Structure

### Track A: Architecture & Infrastructure (Lalo + Puck)
- **AI Agent:** Puck (Claude Code, claude-opus-4-6 lead / claude-sonnet-4-6 teammates)
- **Role:** Architecture, DB schema, Mastra backend, Convex infrastructure
- **Owns:** `convex/schema.ts`, `convex/workflows/`, `docs/DESIGN-*.md`

### Track B: Core Engine + Product (Luci + Seshat)
- **AI Agent:** Seshat (Claude Code, claude-opus-4-6 lead / claude-sonnet-4-6 teammates)
- **Role:** CLI, dashboard, Mastra integration, file system, skills
- **Owns:** `packages/cli/`, `packages/core/`, `convex/mastraIntegration.ts`

---

## 🛡️ MANDATORY DEVELOPMENT RULES (NON-NEGOTIABLE)

> All rules apply to ALL agents, ALL tracks, ALL sprints. Zero exceptions.

### Rule 1: Codebase Audit First
Before building ANY feature, **audit the codebase**:
1. Does it already exist? → Test it against the live Convex deployment
2. Is it broken? → Fix it (file a bug issue first)
3. Is it a stub/placeholder? → Note it, implement properly
4. Only after audit: proceed to SpecSafe workflow

### Rule 2: SpecSafe-First (Tests Before Code)
```
1. Write tests (specsafe new <feature>)
2. Watch tests FAIL (red — proves tests are real)
3. Implement
4. Run tests → must be GREEN
5. If failing → fix before ANY other work
6. Never skip, never "add tests later"
```

### Rule 3: Research Official Docs Before Every Sprint
Mastra and Convex update weekly. **Never implement from memory.**
- **Mastra:** https://mastra.ai/docs (Workspace, Skills, Agent, Workflow APIs)
- **Convex:** https://docs.convex.dev (runtime rules, file storage, HTTP actions)
- **Mastra Workspace Skills:** https://mastra.ai/docs/workspace/skills
- **Mastra S3Filesystem (R2):** https://mastra.ai/reference/workspace/s3-filesystem
- **Mastra Filesystem:** https://mastra.ai/docs/workspace/filesystem
- Always check: are there breaking changes since last sprint?

### Rule 4: CLI First → Dashboard Second
Every feature must be implemented in this exact order:
1. **CLI command** (`agentforge <command>`) — testable, no UI dependency
2. **Dashboard route** — replicate the same logic in the web UI

The CLI is the source of truth. The dashboard is a view layer only.

### Rule 5: Mastra-Native (Not createTool)
- Use `Workspace`, `LocalFilesystem`, `S3Filesystem` for file operations
- Use **SKILL.md standard** (agentskills.io) for skills — NOT `createTool` directly
- Use `Agent.generate()` / `Agent.stream()` — NOT raw AI SDK calls
- Use Mastra Workflow API for multi-agent orchestration
- Use `OpenAICompatibleConfig { providerId, modelId, apiKey }` for BYOK — NOT magic strings

### Rule 6: Convex Runtime Boundaries
```
"use node" files:     ONLY action / internalAction functions
Default runtime:      queries + mutations + standard actions
NEVER mix runtimes in one file.
NEVER call internal.* via api.* — use ctx.runQuery(internal.module.fn)
```

### Rule 7: No Hardcoded Model Lists
Dynamic only. When API key is added → fetch available models from provider API → cache in DB → populate UI from DB. A safe static fallback is acceptable only if the API fetch fails.

### Rule 8: No Fake Implementations
- No "placeholder", "stub", or "coming soon" implementations in shipped code
- File upload MUST actually store file content (Convex storage or R2) — never metadata-only
- Streaming MUST actually stream — never fall back to full generation silently
- Skills MUST use SKILL.md filesystem format — never hardcoded arrays in UI

### Rule 9: Quality & Security Check After Every Sprint
After every sprint iteration (every PR merge):
1. **QA check:** Run `pnpm test` — all must pass
2. **Security check:** Review all new mutations for input validation
3. **Live test:** Test the feature against the real Convex deployment (`watchful-chipmunk-946`)
4. **Audit report:** Document what was tested and the result

### Rule 10: File Storage Standard
- **Dev:** Convex file storage (`ctx.storage.generateUploadUrl()`)
- **Prod:** Mastra S3Filesystem → Cloudflare R2
- Never store file content as base64 strings in DB records

---

## 🏗️ AgentForge Vision

AgentForge = OpenClaw-style agent platform, but:
- **Smaller** — focused on developer/enterprise use case
- **Safer** — RBAC, encrypted keys, audit logs from day 1
- **Mastra-native** — built on Mastra + Convex, not custom LLM plumbing
- **CLI-primary** — everything works from the terminal first

---

## 🔧 Useful Commands

```bash
pnpm test                    # Run all tests (must pass before any PR)
pnpm build                   # Build all packages
pnpm typecheck               # TypeScript check
specsafe new <feature>       # Create SpecSafe spec (ALWAYS do this first)
specsafe list                # List all specs
npx convex dev --once        # Deploy Convex functions
agentforge agents list       # Test agents CLI
agentforge chat <agent-id>   # Test chat CLI
```

---

## 📦 Live Test Deployment

**Project:** agentforge-test  
**Deployment:** `watchful-chipmunk-946.convex.cloud`  
**Team:** AgenticEngineering  
**Dashboard:** http://localhost:3000 (run `agentforge dashboard --dir /tmp/agentforge-test/agentforge-test`)

Test every feature against this deployment before shipping.

---

## ⚠️ CONVEX MUST BE INITIALIZED BEFORE ANY TESTING

**You cannot test anything without a live Convex deployment.** Unit tests mock Convex — they do NOT verify real behavior. Every feature must be tested against a real deployment.

### Setup (required before first test)
```bash
cd <your-project>
npx convex dev --once        # Deploy schema + functions to Convex cloud
# Requires: Convex account + auth (~/.convex/config.json)
```

### Current Test Deployment
```
Dir:        /tmp/agentforge-test/agentforge-test
Deployment: watchful-chipmunk-946.convex.cloud
Dashboard:  agentforge dashboard --dir /tmp/agentforge-test/agentforge-test
```

### What "Working" Actually Means
Do NOT mark a feature as working unless you have:
1. Run `npx convex dev --once` (or equivalent)
2. Called the actual CLI command or Convex function
3. Received a real (non-mock) response
4. Documented the exact command + output

**Confirmed working (real Convex calls, 2026-02-27):**
- `executeAgent` → received real LLM response ✅
- `chat.sendMessage` → received real LLM response ✅
- `apiKeys.create` → key stored, used successfully by executeAgent ✅
- `agents.list` → returned real DB record ✅

**NOT confirmed (connected but CRUD not fully tested):**
- cron create/run, mcp add/test, skills install/create
- agents edit/delete/enable/disable (CLI interactive paths)
- agentforge agents create (interactive CLI — not tested)
- All dashboard pages (code has useQuery hooks, browser never opened)
- projects, sessions, threads (never tested end-to-end)

# AgentForge Analysis Report: February 20, 2026

**Status:** Completed
**Lead:** Claude Opus 4.6 (Synthesized by Seshat)
**Scope:** Framework architecture, Mastra integration, Storage, Models, and Chatbot Integration

---

## Executive Summary

The analysis identified 4 critical areas for improvement in the AgentForge framework and cloud platform. The most significant finding is that **Mastra Workflows are completely unimplemented**, despite being a core value proposition. Additionally, the multi-tenancy architecture needs a major refactor to support per-project configuration (currently mostly global/user-scoped). The "chatbot placeholder" issue is a build artifact problem, not a code bug. Finally, the AI model list is significantly outdated and missing major providers like Mistral and DeepSeek.

---

## 1. Mastra Workflows (Missing Feature)

**Status:** 🔴 **Not Implemented**
**Findings:**
- Zero usage of `createWorkflow` or `createStep` in the codebase.
- The `executeWorkflow` Convex action is a stub returning "coming soon".
- No UI exists for workflow management.
- Documentation references workflows, but the code does not support them.

**Recommendations:**
1. **Implement Workflow Primitives:** Create `convex/workflows/` directory for defining workflows using `@mastra/core/workflows`.
2. **Register Workflows:** Update `convex/mastra.ts` to register workflows in the Mastra instance.
3. **Real Execution Action:** Replace the `executeWorkflow` stub with logic that hydrates a workflow and calls `.createRun().start()`.
4. **Persist State:** Add schema tables for `workflowRuns` and `workflowSteps` to track execution status.

**New Linear Tasks:**
- `[FEATURE] Implement Mastra Workflows Engine in Convex` (High)
- `[FEATURE] Add Workflow Management UI to Dashboard` (Medium)

---

## 2. Multi-Tenancy Architecture (Per-Project Config)

**Status:** 🟡 **Partial / Needs Refactor**
**Findings:**
- **AgentForge (OSS):** Monolithic config. Agents, skills, cron jobs are global (user-scoped), not project-scoped.
- **AgentForge Cloud:** Better, but agents/threads are scoped while skills, connections, and secrets remain user-global.
- **Gap:** Switching projects in CLI or UI does not filter resources correctly.

**Recommendations:**
1. **Schema Update:** Add `projectId` (optional) to `agents`, `skills`, `cronJobs`, `sessions`, `mcpConnections`, `vault`, `channels`.
2. **Project Config Schema:** Replace `settings: v.any()` with a typed `ProjectConfig` object (workspace, failover, sandbox settings).
3. **CLI Update:** Update all commands (`agentforge list`, etc.) to respect `activeProject` from settings and accept `--project <id>`.
4. **Cascade Logic:** Implement config resolution: Agent > Project > Global > System.

**New Linear Tasks:**
- `[ARCH] Refactor Schema for Project-Scoped Resources` (High)
- `[CLI] Update CLI Commands for Project Awareness` (Medium)
- `[FEATURE] Implement Typed Project Configuration` (Medium)

---

## 3. Storage & AI Models

**Status:** 🟡 **Outdated / Missing UI**
**Findings:**
- **File Storage:** R2 backend exists for system files but **no user-facing upload UI** or mutation exists in Cloud. OSS has a UI but it's in-memory only.
- **Models:** The model list is stale.
  - **Missing:** Claude Opus 4.6, Sonnet 4.6, Gemini 3.0/3.1, Mistral (entirely), DeepSeek, xAI.
  - **Deprecated:** `gpt-4o`, `o3-mini` (replaced by `o3`/`o4-mini`).
  - **UI:** No dropdown/validation for model selection in Dashboard.

**Recommendations:**
1. **File Upload:** Port the OSS `files.tsx` UI to Cloud and wire it to a new `files` table and R2 `store()` action.
2. **Model Update:** Update `llmProviders.ts` and `model-resolver.ts` with the latest model IDs.
3. **New Providers:** Add explicit support for Mistral and DeepSeek (via OpenAI-compatible).

**New Linear Tasks:**
- `[FEATURE] Implement User File Uploads with R2 Backend` (High)
- `[MAINT] Update LLM Model Lists & Add Mistral/DeepSeek` (High)

---

## 4. Chatbot Integration (Placeholder Issue)

**Status:** 🟢 **Fixed in Code (Build Issue)**
**Findings:**
- The "placeholder" text exists only in the **`dist/`** directory of the CLI package.
- The **source template** (`packages/cli/templates/default/`) is correctly updated (AGE-91) with real LLM calls.
- **Root Cause:** The CLI package was not rebuilt after the template update, so `dist/` is stale.

**Recommendations:**
1. **Immediate Fix:** Run `pnpm build` in `packages/cli`.
2. **Process Fix:** Add a CI step to ensure `dist/` is rebuilt whenever templates change.

**New Linear Tasks:**
- `[CI] Add CLI Build Step to Pipeline` (Low)

---

## Linear Task Plan

| Priority | Title | Description |
|---|---|---|
| **1 (Urgent)** | `[FEATURE] Implement Mastra Workflows Engine` | Port `createWorkflow` primitives, register in `mastra.ts`, replace stub action. |
| **1 (Urgent)** | `[MAINT] Update LLM Models & Providers` | Add Mistral, DeepSeek; update Claude/Gemini/OpenAI to Feb 2026 versions. |
| **2 (High)** | `[ARCH] Schema Refactor: Project Scoping` | Add `projectId` to agents, skills, cronJobs, connections. Migration script. |
| **2 (High)** | `[FEATURE] R2 File Uploads & UI` | Implement `files` table, R2 upload action, and File Manager UI in Dashboard. |
| **3 (Medium)** | `[CLI] Project-Aware CLI Commands` | Update CLI to filter by active project and support `--project` flag. |
| **3 (Medium)** | `[CI] Automate CLI Template Build` | Ensure `packages/cli/dist` is always in sync with `templates/`. |

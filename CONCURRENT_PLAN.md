# AgentForge Concurrent Development Plan: Phase 1 & Beyond

**Objective:** Achieve feature parity and architectural maturity by Q4 2026.
**Strategy:** "Core vs. Feature" Split.
- **Track A (Luci/Seshat):** Core Framework, Schema Architecture, Deep Backend (Mastra).
- **Track B (Lalo/Puck):** Product Features, UI/UX, Integrations, DevOps.

**Protocol:** Strict **SpecSafe TDD**. No code is written without a passing test generated from a spec.

---

## 🏁 Phase 0: Synchronization (Immediate)

**Goal:** align the repo state so concurrent work is safe.

| Task | Owner | Action | Output |
| :--- | :--- | :--- | :--- |
| **Repo Init** | **Luci** | Run `specsafe init` in repo root. | `specsafe.config.json`, `.claude/skills/`, `PROJECT_STATE.md` |
| **Branching** | **Both** | Create protected `develop` branch. | Branch rules set. |

---

## 🚀 Phase 1: Foundation (Q1 2026) - The "Big Refactor" Sprint

**Focus:** Multi-tenancy, Workflows, and Basic Assets.

### Sprint 1.1: Schema & Models (Parallel)

**Conflict Risk:** Low (Touching different files).
**Sync Point:** Merge AGE-106 (Schema) before starting Sprint 1.2.

#### Track A: Luci (Architecture) — AGE-106
**Focus:** Refactoring the database schema to support true multi-tenancy.
- **Spec:** `specs/active/SPEC-AGE-106-schema.md`
- **Steps:**
  1.  **Spec:** Define `ProjectConfig` type and `projectId` relations.
  2.  **Test:** Generate tests for `convex/schema.ts` validation logic.
  3.  **Code (Claude Opus):** Update schema, create migration script `convex/migrations/addProjectIds.ts`.
  4.  **QA:** Verify `agentforge init` still works with new schema.

#### Track B: Lalo (Features) — AGE-105
**Focus:** updating the "brains" of the operation (Models).
- **Spec:** `specs/active/SPEC-AGE-105-models.md`
- **Steps:**
  1.  **Spec:** List all new models (Mistral, DeepSeek, Claude 3.7/4.6).
  2.  **Test:** Create `tests/model-resolver.test.ts` ensuring all IDs resolve to correct API params.
  3.  **Code (Claude Sonnet):** Update `llmProviders.ts` and `model-resolver.ts`.
  4.  **QA:** Verify Dashboard "Create Agent" dropdown shows new models.

---

### 🛑 SYNC POINT 1: The Schema Merge
**Action:** Luci merges AGE-106 into `develop`.
**Why:** AGE-107 (Files) and AGE-104 (Workflows) depend on the new `projectId` schema. Lalo must pull changes before starting Sprint 1.2 backend work.

---

### Sprint 1.2: Workflows & Assets (Parallel)

**Conflict Risk:** Medium (Both touching Convex actions).

#### Track A: Luci (Core Engine) — AGE-104
**Focus:** Implementing the Mastra Workflows engine.
- **Spec:** `specs/active/SPEC-AGE-104-workflows.md`
- **Steps:**
  1.  **Spec:** Define `Workflow` and `WorkflowStep` interfaces.
  2.  **Test:** Generate unit tests for `convex/workflows/engine.ts`.
  3.  **Code (Claude Opus):** Implement the engine, register in `mastra.ts`, replace the stub action.
  4.  **QA:** Create a "Hello World" workflow and execute it via API.

#### Track B: Lalo (Product UI) — AGE-107 & AGE-108
**Focus:** User-facing Files feature and DevOps health.
- **Task 1: AGE-108 (CI)**
  - **Spec:** `specs/active/SPEC-AGE-108-ci.md`
  - **Code:** Update `package.json` scripts and GitHub Actions to run `pnpm build` on CLI templates.
- **Task 2: AGE-107 (Files UI & Backend)**
  - **Spec:** `specs/active/SPEC-AGE-107-files.md`
  - **Test:** Component tests for `FileExplorer.tsx`.
  - **Code (Claude Sonnet):**
    - Port `packages/web/routes/files.tsx` to Cloud Dashboard.
    - Implement `convex/files.ts` (using new `projectId` from Sprint 1.1).
    - Wire up R2 upload action.

---

## 🔮 Phase 2: Execution & Voice (Q2 2026)

**Focus:** Closing the gap with Manus (Browser) and OpenOperator (Voice).

### Sprint 2.1: The Senses (Parallel)

| Track | Feature | Spec ID | Description |
| :--- | :--- | :--- | :--- |
| **A: Luci** | **Browser Automation** | `SPEC-AGE-14` | Integrate **BrowserBase / Stagehand**. Build the headless browser cluster manager in Convex. |
| **B: Lalo** | **Voice & TTS** | `SPEC-AGE-11` | Integrate **ElevenLabs**. Build the real-time websocket relay for voice chat in the Dashboard. |

### Sprint 2.2: Advanced Intelligence (Parallel)

| Track | Feature | Spec ID | Description |
| :--- | :--- | :--- | :--- |
| **A: Luci** | **Memory System** | `SPEC-AGE-12` | Implement **Mem0 / Zep** integration. Vector database setup for long-term agent recall. |
| **B: Lalo** | **Messaging Adapters** | `SPEC-AGE-05` | Build **WhatsApp & Telegram** bots using the new schema. User-facing chat integrations. |

---

## 🌍 Phase 3: Ecosystem (Q3 2026)

**Focus:** Expanding the platform surface area.

| Track | Feature | Spec ID | Description |
| :--- | :--- | :--- | :--- |
| **A: Luci** | **Skill Marketplace** | `SPEC-AGE-14` | Build the registry backend, versioning, and "Install Skill" logic. |
| **B: Lalo** | **Mobile Apps** | `SPEC-AGE-55` | React Native / Expo project setup. Port the Dashboard chat interface to iOS/Android. |

---

## 🏢 Phase 4: Enterprise (Q4 2026)

**Focus:** "Boring" but profitable features.

| Track | Feature | Spec ID | Description |
| :--- | :--- | :--- | :--- |
| **A: Luci** | **SSO & RBAC** | `SPEC-AGE-21` | WorkOS integration. Role-Based Access Control logic in Convex middleware. |
| **B: Lalo** | **Data Residency** | `SPEC-AGE-23` | EU Region setup. Configurable data locality per Project. |

---

## 🛠️ Working Agreements

1.  **SpecSafe First:** `specsafe new` -> `specsafe test` -> `claude-code` -> `specsafe qa`.
2.  **Pull Before Push:** Always pull `develop` before starting a new Spec to ensure schema compatibility.
3.  **One Spec per Branch:** `feat/AGE-104-workflows` is for one spec only.
4.  **Agent Roles:**
    -   **Seshat (Luci):** Architect. Handles `convex/schema.ts`, core logic, deep backend.
    -   **Puck (Lalo):** Product. Handles `apps/dashboard`, integrations, specialized adapters.

---

### Next Action
Ready to initialize Phase 0?
Run: `cd /Users/agent/Projects/Agentic-Engineering-Agency/agentforge && specsafe init`

---

## 📍 Current Status

**Last Updated:** 2026-02-20

### Phase 0: ✅ COMPLETE
- SpecSafe initialized
- Branching strategy configured
- Team structure established

### Phase 1 Sprint 1.1: 🔄 READY TO START
- **AGE-106 (Schema Refactor)** → Track A: Luci/Seshat
- **AGE-105 (LLM Models Update)** → Track B: Lalo/Puck

Both tracks can proceed in parallel with low conflict risk.

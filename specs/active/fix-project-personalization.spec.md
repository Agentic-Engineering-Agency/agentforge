# Spec: Project Personalization in Chat Pipeline

> **Spec ID:** FIX-PROJECT-PERSONALIZATION
> **Status:** SPEC
> **Created:** 2026-02-26
> **Track:** Team B (Luci/Seshat)
> **Issue:** Projects can be created but have no personalization or functionality applied in chat

---

## Problem Statement

Users report: "Projects can be created but seem to have no personalization or functionality."

The schema (Sprint 3.0, AGE-139) added project settings fields (`systemPrompt`, `defaultModel`, `defaultProvider`) stored in the `settings` object of the projects table. However, `chat.ts` ignores these project fields — it only reads agent-level settings (`agent.model`, `agent.provider`, `agent.instructions`).

Project-level overrides should take precedence over agent-level defaults but are never applied.

---

## Proposed Solution

Wire project settings into the chat execution pipeline so that:

1. When an agent belongs to a project (`agent.projectId` is set), load the project's settings
2. Project settings override agent-level defaults:
   - `project.settings.systemPrompt` prepended to `agent.instructions`
   - `project.settings.defaultProvider` overrides `agent.provider`
   - `project.settings.defaultModel` overrides `agent.model`
3. The UI already displays these fields (dist/templates), and packages/web now includes them too

---

## Sections

### Section A: Project systemPrompt prepends to agent instructions

**Given:** An agent with `instructions = "You are a helpful assistant."` belongs to a project with `settings.systemPrompt = "Always respond in Spanish."`

**When:** A user sends a message through `chat.sendMessage`

**Then:**
- [A1] The action loads the project via `api.projects.get`
- [A2] The system prompt combines both: `"Always respond in Spanish.\n\nYou are a helpful assistant."`
- [A3] The combined prompt is passed to the LLM
- [A4] Responses reflect the project-level instruction (Spanish responses)
- [A5] If the project has no `systemPrompt`, only agent instructions are used
- [A6] If the project has no `settings` object, only agent instructions are used

### Section B: Project defaultModel/defaultProvider override agent settings

**Given:** An agent with `provider = "openai"`, `model = "gpt-4o-mini"` belongs to a project with:
- `settings.defaultProvider = "anthropic"`
- `settings.defaultModel = "claude-sonnet-4-6"`

**When:** A user sends a message through `chat.sendMessage`

**Then:**
- [B1] The action loads the project via `api.projects.get`
- [B2] The provider `anthropic` overrides the agent's `openai`
- [B3] The model `claude-sonnet-4-6` overrides the agent's `gpt-4o-mini`
- [B4] The LLM call uses `anthropic/claude-sonnet-4-6` as the model key
- [B5] Usage recording records `anthropic` as the provider
- [B6] Usage recording records `claude-sonnet-4-6` as the model
- [B7] If the project only sets `defaultProvider`, agent model is still used
- [B8] If the project only sets `defaultModel`, agent provider is still used

### Section C: projects.get query exists and returns project with settings

**Given:** The Convex database has a projects table

**When:** `api.projects.get` is called with `{ id: projectId }`

**Then:**
- [C1] The query exists in `convex/projects.ts`
- [C2] The query accepts `{ id: v.id("projects") }` as args
- [C3] The query returns a project object with all fields
- [C4] The returned project includes the `settings` field if set
- [C5] The `settings` field can contain `systemPrompt`, `defaultModel`, `defaultProvider`
- [C6] If the project has no settings, `settings` is `undefined` or an empty object

### Section D: Projects UI shows systemPrompt, defaultModel, defaultProvider fields

**Given:** A user opens the projects page in the dashboard

**When:** The user views or edits a project

**Then:**
- [D1] The projects page includes a "Settings" tab (dist/templates)
- [D2] The Settings tab shows a "System Prompt" textarea
- [D3] The System Prompt field accepts up to 2000 characters
- [D4] The Settings tab shows a "Default Provider" dropdown
- [D5] The Settings tab shows a "Default Model" dropdown
- [D6] The Model dropdown is disabled when no Provider is selected
- [D7] Changes to Provider auto-select the first Model for that provider
- [D8] The "Save Settings" button persists changes to the database
- [D9] (packages/web) The ProjectForm includes an expandable settings section
- [D10] (packages/web) The ProjectDetailView Settings tab displays current settings
- [D11] Form validation ensures required fields are present
- [D12] Empty values mean "use agent default" for that field

---

## Implementation Plan

1. **convex/chat.ts** (both root and templates/default):
   - After loading the agent, check if `agent.projectId` exists
   - If yes, load project via `ctx.runQuery(api.projects.get, { id: agent.projectId })`
   - Extract `settings.systemPrompt`, `settings.defaultModel`, `settings.defaultProvider`
   - Build combined system prompt: project prompt + agent instructions
   - Use overridden provider/model for LLM call and usage recording

2. **packages/web/app/routes/projects.tsx**:
   - Add `ProjectSettings` type with `systemPrompt`, `defaultModel`, `defaultProvider`
   - Update `Project` type to include optional `settings`
   - Add expandable settings section to `ProjectForm`
   - Update `ProjectDetailView` Settings tab to display settings
   - Import `LLM_PROVIDERS` and `getModelsByProvider` for dropdowns

3. **convex/projects.ts**:
   - Verify `get` query exists (it already does)

4. **Tests** (packages/cli/tests/unit/project-personalization.test.ts):
   - Test override precedence: project > agent > defaults
   - Test system prompt concatenation
   - Test provider/model override
   - Test null/undefined handling

---

## Edge Cases

1. **Agent not in a project**: Use agent-level settings only (existing behavior)
2. **Project exists but has no settings**: Use agent-level settings only
3. **Project settings.partial**: Only override what's set, use agent for rest
4. **Project with empty settings**: Treat as no settings (use agent defaults)
5. **Agent projectId points to deleted project**: Gracefully handle, use agent defaults

---

## Success Criteria

- [ ] All 32 assertions pass (A1-A6, B1-B8, C1-C6, D1-D12)
- [ ] `pnpm test` passes with at least 8 new test cases
- [ ] `pnpm build` completes without errors
- [ ] `diff -rq dist/default/ templates/default/` shows no differences for chat.ts
- [ ] Manual test: Create project with overrides, verify agent chat uses them

---

## Dependencies

- **AGE-106**: Project-scoped schema (already merged)
- **AGE-107**: File uploads (not blocking)
- **Convex projects.get query**: Already exists

---

## Rollout Plan

1. Deploy to development environment
2. Create test project with overrides
3. Send chat message through assigned agent
4. Verify system prompt and model/provider are applied
5. Run test suite
6. Deploy to production

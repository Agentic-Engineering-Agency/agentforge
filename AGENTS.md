# AgentForge AI Agent Team

## Overview

AgentForge uses **Claude Code Agent Teams** for concurrent development with parallel work tracks.

**Environment Variable:** `CLAUDE_EXPERIMENTAL_AGENT_TEAMS=1`

## Team Configuration

### Models
- **Lead Model:** `claude-opus-4-6` (Team coordination, architecture decisions)
- **Teammate Model:** `claude-sonnet-4-6` (Feature implementation, development tasks)

### Team Structure

#### Track A: Architecture Team
**Teammates:** Luci + Seshat

**Role:** Architect

**Responsibilities:**
- `convex/schema.ts` - Database schema design and migrations
- Core framework logic and architecture
- Deep backend systems and Mastra integration
- Workflow engine implementation
- Memory and vector database systems

**Key Files:**
- `packages/convex/schema.ts`
- `packages/mastra/`
- `convex/workflows/`

#### Track B: Product Engineering Team
**Teammates:** Lalo + Puck

**Role:** Product Engineer

**Responsibilities:**
- `apps/dashboard` - UI/UX implementation
- Integrations and adapters (WhatsApp, Telegram, etc.)
- DevOps, CI/CD pipelines
- Feature development and user-facing functionality
- Mobile apps (React Native / Expo)

**Key Files:**
- `apps/dashboard/`
- `packages/adapters/`
- `.github/workflows/`

## Workflow

### SpecSafe Protocol

**All code changes follow SpecSafe TDD:**

1. **Spec:** Create or update spec in `specs/active/SPEC-AGE-{number}.md`
2. **Test:** Generate tests from the spec
3. **Code:** Implement feature with passing tests
4. **QA:** Validate before merge

### Branching Strategy

```
feature/AGE-{number}-{description}  →  main
fix/AGE-{number}-{description}       →  main
```

### Sync Points

- **Sprint 1.1 → 1.2:** AGE-106 (Schema) must merge before AGE-107 (Files) starts
- Regular pull-before-push to maintain compatibility
- One spec per branch principle

## Communication

- Teammates coordinate via agent messaging system
- Status updates in `PROJECT_STATE.md`
- Roadmap maintained in `CONCURRENT_PLAN.md`

## Current Assignments

**Phase 1 - Sprint 1.1:**

| Track | Task | Spec ID | Status |
|-------|------|---------|--------|
| A (Luci/Seshat) | Schema Refactor | AGE-106 | Ready to start |
| B (Lalo/Puck) | LLM Models Update | AGE-105 | Ready to start |

---

*Configuration initialized: 2026-02-20*

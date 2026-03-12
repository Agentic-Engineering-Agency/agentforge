---
name: specsafe-spec-start
description: Start or refine a AgentForge SpecSafe spec. Use when a new feature slice needs to be turned into a scoped active spec with explicit requirements, acceptance criteria, and out-of-scope boundaries.
---

# SpecSafe Spec Start

## Read First

1. `docs/PRD.md`
2. `docs/FEATURES.md`
3. `docs/ARCHITECTURE.md`
4. `docs/PRE_SPEC_CHECKLIST.md`
5. `PROJECT_STATE.md`
6. `prompts/planner.md`
7. `prompts/spec-writer.md`

## Steps

1. Run `pnpm spec:status`.
2. Decide whether to continue the current active spec or create a new one.
3. If needed, create a new spec with `specsafe new <name> --description "<desc>" --skip-interactive`.
4. Refine the spec in `specs/active/`.
5. Add explicit in-scope, out-of-scope, requirements, scenarios, and references.
6. Run `pnpm spec:sync`.
7. Re-run `pnpm spec:status` and confirm `PROJECT_STATE.md` reflects the current active spec.

## Rules

- Keep one active implementation spec at a time.
- Reduce scope aggressively.
- If the slice depends on unfinished foundation work, keep it out of a new implementation spec.
- Do not write production code in this stage.
- Do not leave a new spec in a partially created state without checking project status.
- Do not rely on upstream `specsafe status` or `specsafe list` for repo state tracking here.
- If the spec will use upstream `specsafe test-create`, keep its requirements table under `### Functional Requirements`.

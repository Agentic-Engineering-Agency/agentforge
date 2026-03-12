---
name: specsafe-implement
description: Implement an approved AgentForge SpecSafe slice. Use when a spec and tests already exist and the task is to write production code without expanding scope.
---

# SpecSafe Implement

## Read First

1. active spec in `specs/active/`
2. relevant tests
3. `docs/SOURCE_OF_TRUTH.md`
4. `PROJECT_STATE.md`
5. `prompts/implementer.md`

## Steps

1. Confirm the current spec is the only active implementation slice.
2. Confirm tests exist or a test plan exists.
3. Implement only the required behavior.
4. Run the relevant test or verification commands.
5. Update docs if architecture or behavior changes.
6. Run `pnpm spec:stage <SPEC-ID> CODE` once the slice has moved into implementation.
7. Re-run `pnpm spec:status` and keep the spec file header aligned with the active stage.

## Rules

- Do not expand scope.
- Verify Mastra and Convex APIs before coding.
- Preserve local-first behavior, auditability, and security boundaries.
- Prefer small, reviewable changes.
- Treat failing verification or stale status metadata as part of the implementation work, not someone else's cleanup.
- Do not use upstream `specsafe qa` or `specsafe done` for authoritative stage movement in this repo.

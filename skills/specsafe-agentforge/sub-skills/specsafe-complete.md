---
name: specsafe-complete
description: Complete, archive, and document a finished AgentForge SpecSafe slice. Use when QA is done or a spec is ready to move through completion so status, archival, and documentation remain consistent.
---

# SpecSafe Complete

## Read First

1. active spec in `specs/active/`
2. `PROJECT_STATE.md`
3. `docs/SPECSAFE_WORKFLOW.md`
4. `prompts/reviewer.md`
5. `prompts/docs-curator.md` if documentation changed

## Steps

1. Confirm QA findings are closed or explicitly accepted as residual risk.
2. Confirm tests and required verification commands pass.
3. Confirm the spec file header and `PROJECT_STATE.md` agree on the stage.
4. Move the spec through `QA`, `COMPLETE`, and `ARCHIVED` with `pnpm spec:stage <SPEC-ID> <STAGE>`.
5. Re-run `pnpm spec:status`.
6. Update any docs that should reflect the completed slice.
7. Verify the spec moved out of active work if completion succeeded.

## Rules

- Do not archive a spec with unresolved blocking findings.
- Do not mark a spec complete if documentation is materially stale.
- Completion includes status hygiene, not just code hygiene.
- If the tool leaves state inconsistent, fix the inconsistency before stopping.
- Do not use upstream `specsafe qa` or `specsafe done` for authoritative completion in this repo.

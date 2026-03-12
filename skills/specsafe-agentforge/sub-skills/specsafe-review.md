---
name: specsafe-review
description: Review AgentForge work against the active SpecSafe spec. Use when checking for bugs, regressions, missing tests, or security issues before advancing the spec.
---

# SpecSafe Review

## Read First

1. active spec in `specs/active/`
2. changed files
3. `prompts/reviewer.md`
4. `prompts/security-reviewer.md`
5. `PROJECT_STATE.md`

## Steps

1. Check the implementation against the active spec.
2. Review tests for coverage gaps.
3. Review security boundaries for approvals, secrets, MCP exposure, and privileged tools if relevant.
4. Present findings first with file references.
5. Confirm whether the spec is actually ready to move to QA or completion.

## Rules

- Prioritize correctness over style.
- Explicitly call out missing tests, unsafe assumptions, and spec drift.
- If there are no findings, state that clearly and mention residual risk.
- Call out stale status or documentation as a finding when it affects workflow integrity.
- Treat repo-local lifecycle output as authoritative when checking stage hygiene.

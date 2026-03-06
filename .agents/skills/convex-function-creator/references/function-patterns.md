# Function Patterns

## Use these defaults

- `query`: read-only, deterministic, reactive.
- `mutation`: transactional reads and writes.
- `action`: external APIs or Node.js-only behavior.
- `internalQuery`, `internalMutation`, `internalAction`: backend-only paths.

## Public function checklist

- `args` validator present.
- `returns` validator present.
- Authentication check present if the function touches protected data.
- Authorization check present if the resource is user- or org-scoped.
- Errors are explicit and useful.

## Action checklist

- Add `"use node"` only when Node.js APIs or SDKs are actually required.
- Never mix queries or mutations into a `"use node"` file.
- Use `ctx.runMutation`, `ctx.runQuery`, or `ctx.runAction` for follow-up work.

## Scheduler rule

- Schedule `internal.*` functions only.

## Anti-patterns

- Missing `await` on `ctx.db.*` or `ctx.scheduler.*`.
- `.filter()` on large tables instead of indexed lookups.
- `Date.now()` inside queries.
- Public functions trusting client-provided ownership data.
- LLM calls or Mastra orchestration in Convex for this repo.

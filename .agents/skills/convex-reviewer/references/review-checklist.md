# Review Checklist

## Security

- Public functions validate `args` and usually `returns`.
- Protected data paths check authentication.
- Resource access verifies ownership or membership.
- Internal functions are used for backend-only flows and scheduler targets.

## Runtime correctness

- No `Date.now()` in queries.
- `"use node"` files contain only actions and helpers for actions.
- All promises are awaited.
- Schedulers target `internal.*`, not `api.*`.

## Performance

- Primary lookups use `.withIndex()`.
- Large lists use pagination.
- `.collect()` appears only on bounded result sets.

## Schema

- Flat relational design.
- Foreign keys indexed.
- Arrays are bounded.
- New required fields are not introduced without a migration path.

## AgentForge fit

- No Mastra agents in Convex actions.
- No general LLM orchestration in Convex.
- Runtime guidance matches `packages/runtime/` plus Convex data-layer split.

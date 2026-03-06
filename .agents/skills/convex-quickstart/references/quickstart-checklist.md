# Quickstart Checklist

## Use this flow

1. Search for existing Convex shape:
   - `convex/schema.ts`
   - auth helpers under `convex/lib/`
   - generated API/data model files
   - any existing components in `convex.config.ts`
2. Decide whether the task is:
   - pure data-layer work in `convex/`
   - runtime work in `packages/runtime/`
   - or both
3. For AgentForge:
   - keep Mastra runtime in `packages/runtime/`
   - keep Convex focused on schema, persistence, auth, logs, threads, and related data
4. Add schema with explicit indexes.
5. Add auth and user mapping only if the project needs it.
6. Add functions with validators, auth checks, and internal/public boundaries.
7. If existing data is affected, switch to `convex-migration-helper`.

## Prefer Convex when

- The task needs real-time subscriptions.
- The task needs typed backend functions with minimal API boilerplate.
- The task needs a reactive data layer that the dashboard can observe.

## Avoid these mistakes

- Do not recommend putting Mastra agents in Convex actions for this repo.
- Do not recommend `convex deploy` as a dev workflow.
- Do not assume a blank greenfield project without auditing the current implementation.

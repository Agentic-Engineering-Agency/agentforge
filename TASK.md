# TASK: SPEC-023 — CLI Runtime Commands

## Spec
Read `specs/active/SPEC-023-cli-runtime-commands.md` for full requirements.

## Summary
Add/fix CLI commands for the runtime layer:
1. `agentforge start` — boots daemon with channel adapters
2. `agentforge chat` — streams via HTTP (replaces broken Convex action call)
3. `agentforge status` — add runtime health check
4. `agentforge deploy` — deploys Convex schema only
5. Remove `voice`, `browser` stub commands
6. Fix/remove `usage` and `research --format`
7. Add `agentforge.config.ts` to template scaffold

## Dependencies
- SPEC-020 (runtime package): `@agentforge-ai/runtime` must be available
  - Import `AgentForgeDaemon`, `defineConfig` from packages/runtime
- SPEC-022 (Convex cleanup): data layer changes must be compatible

## Architecture Notes
- CLI is in `packages/cli/src/commands/`
- Runtime is in `packages/runtime/src/`
- Templates are in `packages/cli/templates/default/` (single source of truth)
- The daemon listens on an HTTP port (OpenAI-compatible `/v1/chat/completions`)
- Chat command should use SSE streaming to consume responses

## Key Files to Modify
- `packages/cli/src/commands/start.ts` (new)
- `packages/cli/src/commands/chat.ts` (fix streaming)
- `packages/cli/src/commands/status.ts` (add runtime check)
- `packages/cli/src/commands/deploy.ts` (new)
- `packages/cli/src/commands/voice.ts` (delete)
- `packages/cli/src/commands/browser.ts` (delete)
- `packages/cli/src/index.ts` (register new, remove old)
- `packages/cli/templates/default/agentforge.config.ts` (new)

## Quality Requirements
- TypeScript: 0 errors (`pnpm run typecheck`)
- Tests: all passing (`pnpm test`)
- No hardcoded secrets
- CLI commands must work: `agentforge status`, `agentforge agents list`, `agentforge models list`

## Branch
`feat/spec-023-cli-commands` from `plan/architecture-redesign`

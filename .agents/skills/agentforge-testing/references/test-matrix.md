# Test Matrix

## Repo-level

- `pnpm test`
- `pnpm typecheck`

## Package-level

- `pnpm --filter @agentforge-ai/core test`
- `pnpm --filter @agentforge-ai/cli test`
- `pnpm --filter @agentforge-ai/runtime test`

## Higher-signal manual checks

- project creation flow,
- `agentforge run` or runtime startup path,
- skills install/list behavior,
- MCP connection list/test/run path when changed.

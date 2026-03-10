# @agentforge-ai/web

Standalone dashboard package for AgentForge.

This package is separate from the root repo documentation and should be read as package-specific web app documentation. The root architecture and contributor workflow are documented in the repository [`README.md`](/Users/eduardojaviergarcialopez/AgenticEngineering/agentforge/README.md).

## Current Package Role

`@agentforge-ai/web` is a Vite-based dashboard app packaged under `packages/web`. The CLI `dashboard` command can also discover dashboard apps in project scaffolds and other package locations, so this package is one dashboard path, not the only one.

## Scripts

```bash
pnpm --filter @agentforge-ai/web dev
pnpm --filter @agentforge-ai/web build
pnpm --filter @agentforge-ai/web typecheck
pnpm --filter @agentforge-ai/web lint
```

## Tech Stack

- Vite
- React 18
- TanStack Router
- Convex client
- Tailwind CSS and Radix UI primitives

## Notes

- This package is marked `private` in its package manifest.
- The root workspace does not expose repo-wide `dev` orchestration for this package.
- For scaffolded project dashboard behavior, see the template README at [`packages/cli/templates/default/README.md`](/Users/eduardojaviergarcialopez/AgenticEngineering/agentforge/packages/cli/templates/default/README.md).

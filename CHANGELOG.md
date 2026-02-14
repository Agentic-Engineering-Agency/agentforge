# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-02-13

### Added

- **Dynamic Tooling (`agent.addTools()`)** — Added `agent.addTools(server: MCPServer)` method to dynamically add tools to an agent after construction. This allows for more flexible and context-aware agent capabilities.
- `agent.clearTools()` to remove all tools.
- `agent.getTools()` to get a list of all registered tool schemas.
- `agent.callTool()` to invoke a tool by name across all attached servers.

### Fixed

- **CLI Template Dependency** — The default project template created by `agentforge create` now correctly references the latest version of `@agentforge-ai/core` (`^0.2.1`) instead of `^0.1.0`.

## [0.2.0] - 2026-02-12

### Added

- **`agentforge deploy` command** — Deploy Convex backend to production with environment variable management, `--dry-run` preview, `--rollback` support, and `--force` for CI/CD pipelines.
- **Test coverage reporting** — Integrated `@vitest/coverage-v8` with 100% coverage across all packages. Coverage thresholds enforced: >95% for core, >90% for CLI.
- **Documentation expansion**:
  - `docs/multi-agent-collaboration.md` — Guide for building multi-agent systems with the Coordinator-Worker pattern.
  - `docs/advanced-tools.md` — Guide for creating custom MCP tools with Zod schemas.
  - `docs/deployment-guide.md` — Complete production deployment guide including CI/CD with GitHub Actions.
  - `docs/dependency-optimization.md` — Technical analysis of the dependency optimization.

### Changed

- **Upgraded `@mastra/core` from `0.5.0` to `^1.4.0`** — Eliminates `fastembed`, `onnxruntime-node`, `cohere-ai`, and OpenTelemetry transitive dependencies. Reduces `node_modules` from **843 MB to ~116 MB** (727 MB / 86% reduction).
- Agent `model` field now accepts `LanguageModelV1 | LanguageModelV2 | string` (Mastra v1.4.0 `MastraModelConfig`).

### Fixed

- Resolved dependency bloat: `onnxruntime-node` (80 MB) and `fastembed` (520 MB) are no longer pulled as transitive dependencies.

## [0.1.0] - 2026-02-12

### Added

- **`@agentforge-ai/core`** — Core framework package:
  - `Agent` class wrapping Mastra with BYOK model support.
  - `SandboxManager` for secure E2B code execution.
  - `MCPServer` for type-safe tool registration with Zod schemas.
- **`@agentforge-ai/cli`** — CLI tool:
  - `agentforge create` — Scaffold new projects from templates.
  - `agentforge run` — Start the local Convex development server.
- **Convex schema** — Base tables for agents, threads, and messages.
- **FinForge example** — Financial intelligence agent demo showcasing the framework.
- **Documentation** — Usage guide, FinForge tutorial, README, CONTRIBUTING, CODE_OF_CONDUCT.

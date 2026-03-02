# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.3] - 2026-03-02

### Fixed
- **Convex bundling errors** — Replaced `@mastra/core` dependency with direct AI SDK integration to resolve Convex deployment bundling issues

### Added
- **Model fetching** — Support for 6 providers (OpenAI, Anthropic, Google, xAI, OpenRouter, Groq) with 37 models available
- **Research orchestrator** — Multi-agent research system for coordinated knowledge gathering and synthesis
- **TTS engine** — Text-to-speech capabilities with ElevenLabs provider support

## [0.8.0] - 2026-02-24

### BREAKING CHANGES
Reduced from 5 published packages to 2 (`@agentforge-ai/core` + `@agentforge-ai/cli`).

Deleted packages — import from `@agentforge-ai/core` instead:
- `@agentforge-ai/sandbox` → `core/src/sandbox/`
- `@agentforge-ai/channels-discord` → `core/src/channels/discord/`
- `@agentforge-ai/channels-slack` → `core/src/channels/slack/`
- `@agentforge-ai/tools-voice` → removed (was a deprecated shim)

## [0.7.3] - 2026-02-24

### Refactored
- **Core Dependencies**: Moved `playwright` to optional peer dependency and `@e2b/code-interpreter` to `@agentforge-ai/sandbox`. The sandbox package now properly owns all heavy execution dependencies, significantly reducing the base install size of `@agentforge-ai/core`.
- **Voice Tools**: Merged TTS and STT functionality from `@agentforge-ai/tools-voice` directly into `@agentforge-ai/core`.
  - The `@agentforge-ai/tools-voice` package is now deprecated and serves only as a backward-compatibility re-export wrapper.
  - Meaningful package count reduced from 6 to 5.

## [0.7.2] - 2026-02-24

### Changed
- **UI**: Applied Agentic Engineering brand palette across the entire dashboard
  - Dark theme: deep navy background with Accent Blue (#6A81C7) as interactive primary
  - Light theme: Bone (#F5F5F5) background, Charcoal (#1A1A1A) text, Primary Blue (#1F337A) for headings/actions
  - Tailwind tokens added: `bg-ae-primary`, `text-ae-accent`, `bg-ae-bone`, `text-ae-charcoal`

## [0.7.1] - 2026-02-23

### Fixed
- CLI: register `channel:slack` and `skill search|publish|featured` commands in CLI index (both commands existed but were not imported or registered — caught via manual testing)

## [0.7.0] - 2026-02-23

### Added

- **Skill Marketplace MVP** with search, publish, and featured skills
- **MCP-Native Architecture** — MCPClient (stdio/HTTP/SSE), MCPDynamicToolLoader for runtime tool discovery
- **WhatsApp Cloud API** channel adapter with webhook support and voice notes
- **Slack Bolt.js** channel adapter (`@agentforge-ai/channels-slack`) with Socket Mode and slash commands
- **Discord** channel adapter (`@agentforge-ai/channels-discord`) with embeds and slash commands
- **Agent-to-Agent (A2A) protocol** — client, server, registry, streaming task delegation
- **Channel Adapter Framework** unification — normalized InboundMessage/OutboundMessage across all channels
- **Live Agent Run View** at `/runs/:runId` in the web dashboard
- **Voice TTS** (ElevenLabs) + **STT** (Whisper) support via `@agentforge-ai/tools-voice`
- **Git Tool** — built-in git operations (branch, commit, diff, log, stash)
- **Browser Automation Tool** — Playwright-based navigate, click, type, screenshot, evaluate
- **Swarm Orchestration** — parallel multi-agent execution with resource tiers
- **Comprehensive documentation** — getting started, architecture, channels, skills, MCP, A2A, competitive positioning

## [0.3.0] - 2026-02-16

### Added

#### Web Dashboard
- **TanStack Start web dashboard** with modern UI and dark theme
- **Dashboard layout** with sidebar navigation matching OpenClaw's structure
- **Overview page** with stats and recent activity
- **Chat interface** with real-time messaging
- **Agents management** page for creating and managing agents
- **Placeholder routes** for all major features (sessions, files, projects, skills, cron, connections, settings, usage)
- **Responsive design** that works on desktop and mobile

#### Backend & Database
- **Comprehensive Convex schema** with 13 tables for agents, threads, messages, sessions, files, folders, projects, skills, cron jobs, MCP connections, API keys, usage tracking, and heartbeats
- **Convex functions** for all core operations including CRUD for all entities
- **Real-time subscriptions** powered by Convex

#### Mastra Integration
- **Multi-provider LLM support**: OpenAI, Anthropic, OpenRouter, Google, xAI
- **Mastra integration module** with agent orchestration
- **Convex actions** for agent execution
- **Usage tracking** and cost estimation
- **Streaming support** (placeholder)
- **Workflow orchestration** (placeholder)

#### Heartbeat System
- **Task continuity** - Agents can check on ongoing conversations
- **Pending task tracking** - Resume unfinished work
- **Context maintenance** - Preserve state across sessions
- **Scheduled checks** - Periodic heartbeat monitoring
- **HEARTBEAT.md documentation** similar to OpenClaw

#### Deployment
- **Cloudflare Pages configuration** with wrangler.toml
- **Environment variable templates** (.env.example)
- **R2 bucket bindings** for file storage
- **Deployment documentation** with step-by-step guides
- **Multiple deployment options**: Cloudflare Pages, Vercel, Self-hosted

#### Documentation
- **Updated README** with comprehensive feature list
- **Web dashboard README** with architecture details
- **HEARTBEAT.md** documentation
- **Deployment guide** with Cloudflare focus
- **Architecture diagrams** and tech stack overview
- **Roadmap** and comparison table

### Changed
- **Fixed Convex schema error** - Renamed reserved index `by_id` to `byAgentId`
- **Updated package versions** to 0.3.0
- **Enhanced README** with full feature documentation

### Technical Details
- **Frontend**: TanStack Start, Tailwind CSS, Radix UI, Lucide Icons
- **Backend**: Convex (real-time database)
- **Agent Engine**: Mastra
- **Deployment**: Cloudflare Pages, Cloudflare R2
- **Code Execution**: E2B sandboxes

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

---
title: "AgentForge Documentation"
description: "Official documentation for AgentForge — a self-hosted AI agent framework built on Mastra and Convex."
---

# AgentForge Documentation

AgentForge is a self-hosted AI agent framework: a central daemon powered by Mastra + Convex. Build, deploy, and manage autonomous AI agents with full control of your infrastructure and data.

## Guides

- [Getting Started](./guides/getting-started.md) — Zero to a running agent in 5 minutes
- [Usage Guide](./guides/guide.md) — Core concepts and your first agent tutorial
- [Deployment Guide](./guides/deployment-guide.md) — Deploy to production with CLI, CI/CD, or manual setup

## Reference

- [CLI Reference](./reference/CLI.md) — Complete command reference for the `agentforge` CLI
- [Technical Reference](./reference/TECH-REFERENCE.md) — Deep dive into Convex + Mastra integration patterns
- [Releasing](./reference/releasing.md) — npm package release process

## Architecture

- [Architecture](./architecture/architecture.md) — System overview, data flow, and design decisions
- [Architecture Diagrams](./architecture/architecture-diagrams.md) — Mermaid diagrams of all subsystems
- [Channel Adapters](./architecture/channels.md) — HTTP, Telegram, WhatsApp, Slack, Discord

## Features

- [Skills](./features/skills.md) — Extend agents with self-contained tool packages
- [MCP Integration](./features/mcp.md) — Model Context Protocol client and server
- [A2A Protocol](./features/a2a.md) — Agent-to-agent task delegation and discovery
- [Multi-Agent Collaboration](./features/multi-agent-collaboration.md) — Coordinator-worker and swarm patterns
- [Advanced Tools](./features/advanced-tools.md) — Dynamic tool registration and Zod schemas

## Examples

- [FinForge Demo](./examples/finforge-demo.md) — Build a financial intelligence agent step by step

## Contributing

- [Development Guide](./contributing/development.md) — Workflow, rules, and QA gates
- [Dependency Optimization](./contributing/dependency-optimization.md) — How we keep the install small

## Other

- [Why AgentForge?](./competitive-positioning.md) — Competitive positioning and value proposition
- [Design: Project Config](./DESIGN-PROJECT-CONFIG.md) — Internal design document for project-scoped configuration

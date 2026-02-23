# Why AgentForge?

AgentForge is built for teams that need autonomous AI agents without giving up control of their infrastructure or data.

## The Problem

Cloud-hosted agent platforms lock you in. Your agent logic, conversation data, and tool integrations live on someone else's servers. For regulated industries, privacy-conscious teams, or anyone who's been burned by a vendor pivot — that's a dealbreaker.

## How AgentForge Compares

| Capability | AgentForge | Manus | OpenClaw |
|-----------|-----------|-------|----------|
| **Self-hosted** | Yes | No (cloud-only) | Yes |
| **Data ownership** | Full — your infra, your data | No — vendor-hosted | Full |
| **Open source** | Apache 2.0 | Proprietary | MIT |
| **Agent framework** | Full (Mastra-native) | Full | Limited |
| **Channel adapters** | 4 (Telegram, WhatsApp, Slack, Discord) | N/A | 20+ |
| **Skill marketplace** | Yes | No | Yes |
| **MCP support** | Native (client + server) | No | Partial |
| **A2A protocol** | Yes | No | No |
| **Voice (TTS/STT)** | Yes (ElevenLabs + Whisper) | Limited | No |
| **Browser automation** | Yes (Playwright) | Yes | No |
| **Multi-provider LLM** | 8+ providers via Mastra | Limited | Yes |
| **Real-time backend** | Yes (Convex) | Yes | No |

## What Sets AgentForge Apart

### Self-hosted by default

AgentForge runs on your infrastructure. Deploy to Cloudflare, AWS, GCP, or bare metal — your agents, data, and credentials never leave your control.

This isn't just a privacy feature. It means:

- **Compliance by design** — GDPR, HIPAA, SOC 2 data residency requirements are met by default because you choose where data lives
- **No vendor lock-in** — Switch hosting providers without changing your agent code
- **Cost control** — No per-seat or per-message pricing from an agent platform vendor

### Mastra-native architecture

AgentForge is built directly on [Mastra](https://mastra.ai), the open-source TypeScript AI framework. This means:

- **8+ LLM providers** with a unified `"provider/model"` API (OpenAI, Anthropic, Google, Mistral, DeepSeek, xAI, Cohere, OpenRouter)
- **Hot-swap models** without code changes — switch from GPT-4o to Claude to Gemini by changing a config string
- **Tool framework** built on Zod schemas with type safety end-to-end
- **No Vercel AI SDK dependency** — one less abstraction layer to manage

### Real-time by default

Convex provides real-time subscriptions for the entire backend. The web dashboard, channel adapters, and API clients all get live updates without polling. Conversation state, agent status, and file changes propagate instantly.

### Agent-to-Agent protocol

AgentForge is one of the first frameworks to implement A2A (Agent-to-Agent) communication as a first-class feature. Agents can discover each other, delegate tasks, stream results, and collaborate on complex work — with whitelist-based security and timeout controls.

### MCP everywhere

Full MCP (Model Context Protocol) support — both as a client and server:

- **Client**: Connect to any MCP-compatible tool server (stdio, HTTP, SSE transports)
- **Server**: Expose your agent's tools to other MCP clients
- **Dynamic loading**: Tools from MCP servers become available at runtime without restarts

## Who Is AgentForge For?

### Enterprise teams

Teams that need AI agents but can't send proprietary data to third-party platforms. AgentForge's self-hosted model and project-scoped multi-tenancy support enterprise requirements out of the box.

### Regulated industries

Healthcare, finance, legal, and government teams with strict data residency requirements. Self-hosted deployment means compliance is a deployment decision, not a feature request to a vendor.

### Privacy-conscious developers

Developers and teams who want full control over their AI stack. No telemetry, no data sharing, no vendor dependencies for core functionality.

### Teams already using Mastra or Convex

AgentForge integrates natively with both. If you're already in the Mastra/Convex ecosystem, AgentForge adds agent orchestration, channels, skills, and a production CLI on top of what you already have.

## The Trust Question

When an agent platform is acquired, users don't just lose a tool — they lose control of their data and workflows. Self-hosted open-source frameworks eliminate this risk entirely. Your agents keep running regardless of what happens to any company.

AgentForge is Apache 2.0 licensed. Fork it, modify it, deploy it, sell services on top of it. The code is yours.

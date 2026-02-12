# AgentForge 🚀

Enterprise-grade AI agent framework built on [Mastra](https://mastra.ai), [Convex](https://convex.dev), and [Cloudflare Workers](https://workers.cloudflare.com).

A secure, cloud-native alternative to OpenClaw with defense-in-depth security.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://typescriptlang.org)
[![Status](https://img.shields.io/badge/status-planning-orange.svg)](ROADMAP.md)

## 🎯 Vision

AgentForge aims to be the definitive TypeScript framework for building, deploying, and managing AI agents across messaging platforms, voice interfaces, and web applications.

Unlike OpenClaw's local-first architecture, AgentForge operates as a cloud-native, edge-first platform with **security as a foundational pillar**—not a bolt-on.

## ✨ Key Features

- 🤖 **Multi-Platform Agents** — Deploy to WhatsApp, Telegram, Web, and Voice with a single codebase
- 🔒 **Security-First** — Defense-in-depth sandboxing addressing the "Lethal Quartet" vulnerabilities
- ⚡ **Edge-Native** — Cloudflare Workers for global low-latency deployment
- 🔄 **Real-Time** — Convex for real-time state and persistent storage
- 🎙️ **Voice-Ready** — ElevenLabs integration for conversational AI
- 🔌 **MCP-Native** — Full Model Context Protocol support
- 🤝 **A2A-Ready** — Google Agent-to-Agent protocol support
- 🧩 **Plugin Ecosystem** — WASM-sandboxed plugins with security scanning

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│  (WhatsApp, Telegram, Web, Voice)                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Cloudflare Workers (Edge)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Gateway   │  │   Durable   │  │    Auth     │         │
│  │             │  │   Objects   │  │   (Clerk)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                  Convex Backend                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Agents  │ │ Threads  │ │ Messages │ │ Memories │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │  Users   │ │ AuditLog │ │  Vector  │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Packages

| Package | Description |
|---------|-------------|
| `@agentforge/core` | Agent creation, tool system, workflow engine |
| `@agentforge/convex` | Convex backend integration, thread management |
| `@agentforge/edge` | Cloudflare Workers gateway, Durable Objects |
| `@agentforge/channels` | WhatsApp, Telegram, Web adapters |
| `@agentforge/voice` | ElevenLabs voice integration |
| `@agentforge/sandbox` | E2B code execution |
| `@agentforge/browser` | Vercel Agent Browser for AI-powered web automation |
| `@agentforge/plugins` | Plugin registry, sandboxing |
| `@agentforge/security` | Auth, rate limiting, trust boundaries |
| `@agentforge/mcp` | MCP client/server |
| `@agentforge/a2a` | A2A protocol support |
| `@agentforge/client` | React/JS client SDK |

## 🚀 Quick Start

```bash
# Install CLI
npm install -g @agentforge/cli

# Create new project
agentforge create my-agent

# Deploy to Cloudflare Workers
agentforge deploy
```

## 📋 Roadmap

| Phase | Timeline | Focus |
|-------|----------|-------|
| **1: Foundation** | Months 1-3 | Core framework, messaging, auth |
| **2: Execution** | Months 3-5 | E2B, browser, voice, memory |
| **3: Ecosystem** | Months 5-8 | Plugins, A2A, security dashboard |
| **4: Cloud** | Months 8-12 | Managed offering, SOC 2 |

See [ROADMAP.md](ROADMAP.md) for detailed timeline.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

AgentForge is dual-licensed:
- **Framework**: [Apache 2.0](LICENSE)
- **Managed Cloud**: Proprietary

## 🏢 Organization

Built with ❤️ by [Agentic Engineering](https://agenticengineering.agency) — Guadalajara, Mexico

---

**Status**: Planning Phase | **Start Date**: February 2026

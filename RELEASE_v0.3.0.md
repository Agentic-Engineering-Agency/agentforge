# AgentForge v0.3.0 Release Summary

## 🎉 Release Overview

AgentForge v0.3.0 is a **major release** that transforms AgentForge from a minimalist framework into a comprehensive platform for building and managing AI agents. This release includes a full-featured web dashboard, multi-provider LLM support, and a complete backend infrastructure.

**Release Date**: February 16, 2026  
**GitHub Tag**: v0.3.0  
**GitHub Repository**: https://github.com/Agentic-Engineering-Agency/agentforge  
**npm Packages**: 
- `@agentforge-ai/core@0.3.0`
- `@agentforge-ai/cli@0.3.0`
- `@agentforge-ai/web@0.3.0` (new)

---

## ✨ Major Features

### 1. Web Dashboard (NEW)

A comprehensive web dashboard built with **TanStack Start** and **Tailwind CSS**, featuring:

- **Modern UI**: Dark theme, responsive design, OpenClaw-inspired layout
- **Chat Interface**: Real-time conversation with agents
- **Agent Management**: Create, configure, and manage agents
- **Session Tracking**: View active and historical sessions
- **File Management**: Upload and organize files (placeholder)
- **Projects/Workspaces**: Organize agents by project (placeholder)
- **Skills Marketplace**: Browse and install agent skills (placeholder)
- **Cron Jobs**: Schedule recurring agent tasks (placeholder)
- **MCP Connections**: Manage external service connections (placeholder)
- **Usage Dashboard**: Track token usage and costs (placeholder)
- **Configuration**: Manage API keys and settings (placeholder)

**Tech Stack**:
- TanStack Start (React framework with SSR)
- Tailwind CSS + Radix UI
- Lucide Icons
- Convex (real-time backend)

### 2. Comprehensive Backend

**13 Convex Tables**:
1. `agents` - Agent configurations
2. `threads` - Conversation threads
3. `messages` - Message history
4. `sessions` - Active sessions
5. `files` - File metadata
6. `folders` - Folder structure
7. `projects` - Project/workspace management
8. `skills` - Skills marketplace
9. `cronJobs` - Scheduled tasks
10. `mcpConnections` - MCP connections
11. `apiKeys` - Encrypted API key storage
12. `usage` - Token usage tracking
13. `heartbeats` - Task continuity system

**Convex Functions**: Complete CRUD operations for all entities, plus:
- Real-time subscriptions
- Query optimization with indexes
- Mutation validation
- Action-based agent execution

### 3. Mastra Integration

**Multi-Provider LLM Support**:
- OpenAI (GPT-4, GPT-4 Turbo, GPT-4o, GPT-3.5)
- Anthropic (Claude 3 Opus, Sonnet, Haiku, Claude 3.5)
- OpenRouter (unified access to 50+ models)
- Google (Gemini Pro, Gemini Ultra)
- xAI (Grok, Grok Vision)

**Features**:
- Agent orchestration via Mastra
- Convex actions for agent execution
- Usage tracking and cost estimation
- Streaming support (placeholder)
- Workflow orchestration (placeholder)

### 4. Heartbeat System

Similar to OpenClaw's HEARTBEAT.md:

- **Task Continuity**: Agents check on ongoing conversations
- **Pending Tasks**: Track and resume unfinished work
- **Context Maintenance**: Preserve state across sessions
- **Scheduled Checks**: Periodic heartbeat monitoring
- **Comprehensive Documentation**: HEARTBEAT.md guide

### 5. Cloudflare Deployment

**Production-Ready Configuration**:
- `wrangler.toml` for Cloudflare Pages
- R2 bucket bindings for file storage
- Environment variable templates
- Deployment documentation
- Multiple deployment options (Cloudflare, Vercel, Self-hosted)

---

## 🔧 Bug Fixes

### Fixed Convex Schema Error

**Issue**: Convex schema used reserved index name `by_id`  
**Fix**: Renamed to `byAgentId`  
**Impact**: Convex deployment now works without errors

---

## 📚 Documentation

### New Documentation

1. **Updated README**: Comprehensive feature list, architecture diagrams, tech stack
2. **Web Dashboard README**: Detailed dashboard documentation
3. **HEARTBEAT.md**: Task continuity system guide
4. **Deployment Guide**: Step-by-step Cloudflare deployment
5. **Architecture Diagrams**: Visual system overview
6. **Roadmap**: Feature timeline and comparison table

---

## 🚀 Getting Started

### Installation

```bash
npm install -g @agentforge-ai/cli@0.3.0
# or
pnpm add -g @agentforge-ai/cli@0.3.0
```

### Create a Project

```bash
agentforge create my-agent
cd my-agent
```

### Start Development

```bash
# Terminal 1: Start Convex backend
agentforge run

# Terminal 2: Start web dashboard
cd packages/web
pnpm dev
```

### Access Dashboard

Open http://localhost:3000

---

## 📦 Package Details

### @agentforge-ai/core@0.3.0

**Changes**:
- Added Mastra integration module
- Multi-provider LLM support
- Cost estimation utilities
- Model validation functions

**Dependencies**:
- `@mastra/core@^1.4.0`
- `@e2b/code-interpreter@^1.0.0`
- `ai@^4.0.0`
- `zod@^3.23.0`

### @agentforge-ai/cli@0.3.0

**Changes**:
- Updated templates to v0.3.0
- Added web dashboard scaffolding (future)
- Improved error messages

**No Breaking Changes**

### @agentforge-ai/web@0.3.0 (NEW)

**Initial Release**:
- TanStack Start web dashboard
- Complete UI for agent management
- Real-time updates via Convex
- Cloudflare Pages deployment ready

**Dependencies**:
- `@tanstack/react-router@^1.91.6`
- `@tanstack/start@^1.91.6`
- `convex@^1.18.0`
- `react@^18.3.1`
- `tailwindcss@^3.4.17`

---

## 🎯 Deployment

### Cloudflare Pages (Recommended)

1. **Connect GitHub Repository**
2. **Configure Build Settings**:
   - Build command: `cd packages/web && pnpm install && pnpm build`
   - Output directory: `packages/web/.vinxi/output/public`
3. **Add Environment Variables**:
   - `CONVEX_URL`
   - `OPENAI_API_KEY`
   - Other provider keys
4. **Deploy**

### Convex Backend

```bash
cd convex
npx convex deploy
```

### R2 File Storage

```bash
wrangler r2 bucket create agentforge-files
```

---

## 🗺️ Roadmap

### v0.3.x (Current)
- ✅ Web dashboard
- ✅ Mastra integration
- ✅ Multi-provider support
- ✅ Heartbeat system
- 🚧 Real-time agent execution
- 🚧 File upload implementation
- 🚧 Usage tracking UI

### v0.4.0 (Next)
- ⏳ Skills marketplace implementation
- ⏳ Cron jobs implementation
- ⏳ MCP connections implementation
- ⏳ Authentication (Better Auth)
- ⏳ Multi-user support

### v1.0.0 (Future)
- ⏳ Production-ready
- ⏳ Enterprise features
- ⏳ Advanced observability
- ⏳ Marketplace ecosystem

---

## 📊 Statistics

### Code Changes

- **Files Changed**: 93 files
- **Insertions**: ~10,000 lines
- **Deletions**: ~500 lines
- **Commits**: 7 commits

### New Files

- **Convex Functions**: 13 files
- **Web Dashboard Routes**: 11 routes
- **Components**: 5+ components
- **Documentation**: 4 new docs

### Package Sizes

- `@agentforge-ai/core`: ~116 MB (node_modules)
- `@agentforge-ai/cli`: ~50 MB (node_modules)
- `@agentforge-ai/web`: ~200 MB (node_modules)

---

## 🙏 Acknowledgments

This release was inspired by:

- **OpenClaw**: Architecture and dashboard design
- **NanoClaw**: Minimalist philosophy
- **TanStack Start**: Modern React framework
- **Mastra**: AI agent orchestration
- **Convex**: Real-time database

---

## 📝 Next Steps for Users

### 1. Update Existing Projects

```bash
cd your-agentforge-project
pnpm update @agentforge-ai/core @agentforge-ai/cli
```

### 2. Try the Web Dashboard

```bash
# Clone the repo
git clone https://github.com/Agentic-Engineering-Agency/agentforge.git
cd agentforge/packages/web

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### 3. Deploy to Cloudflare

Follow the [Deployment Guide](docs/deployment.md)

### 4. Explore Examples

Check out the [examples](examples/) directory

---

## 🐛 Known Issues

1. **Streaming Responses**: Placeholder implementation, full support coming in v0.3.1
2. **File Upload**: UI ready, backend integration pending
3. **Skills Marketplace**: UI ready, marketplace API pending
4. **Cron Jobs**: UI ready, execution engine pending

---

## 🔗 Links

- **GitHub**: https://github.com/Agentic-Engineering-Agency/agentforge
- **npm**: https://www.npmjs.com/package/@agentforge-ai/cli
- **Documentation**: https://github.com/Agentic-Engineering-Agency/agentforge/tree/main/docs
- **Issues**: https://github.com/Agentic-Engineering-Agency/agentforge/issues
- **Changelog**: https://github.com/Agentic-Engineering-Agency/agentforge/blob/main/CHANGELOG.md

---

## 📧 Support

- **Email**: hello@agenticengineering.agency
- **GitHub Issues**: https://github.com/Agentic-Engineering-Agency/agentforge/issues
- **Discord**: Coming soon

---

## 📄 License

Apache-2.0 - See [LICENSE](LICENSE) for details.

---

**Built with ❤️ by [Agentic Engineering](https://agenticengineering.agency) — Guadalajara, Mexico**

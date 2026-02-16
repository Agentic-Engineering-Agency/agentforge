# AgentForge Architecture Research: OpenClaw & NanoClaw

## Executive Summary

This document synthesizes research on OpenClaw and NanoClaw architectures to inform the AgentForge framework redesign. The goal is to create a minimalist, enterprise-grade framework combining the best patterns from both systems while maintaining AgentForge's unique positioning with Mastra, Convex, and TanStack Start.

## OpenClaw Architecture Analysis

### Core Philosophy
OpenClaw treats AI assistants as an **infrastructure problem**, not just a prompt engineering problem. It provides an "operating system for AI agents" with structured execution environments, proper session management, memory systems, tool sandboxing, and message routing.

### Hub-and-Spoke Architecture

**Gateway (Control Plane)**
- WebSocket server connecting messaging platforms and control interfaces
- Routes messages to Agent Runtime
- Handles authentication and access control
- Manages multi-channel communication (WhatsApp, Telegram, Discord, Slack, iMessage, etc.)

**Agent Runtime (Execution Layer)**
- Runs the AI loop end-to-end
- Assembles context from session history and memory
- Invokes AI models
- Executes tool calls against system capabilities
- Persists updated state

**Key Insight**: Separation of interface layer (where messages come from) from assistant runtime (where intelligence and execution live) enables one persistent assistant accessible through any messaging app.

### Core Components

#### 1. Channel Adapters
- Dedicated adapter for each messaging platform
- Normalize inbound/outbound messaging
- Built-in adapters: Telegram, Discord, Slack, iMessage, WhatsApp
- Plugin system for additional channels

#### 2. Session Management
- Session-based isolation for conversations
- Each session maintains its own context
- Session history and state persistence
- Multi-channel session tracking
- Session compaction to manage context size

#### 3. Memory System
- Persistent memory across all channels (MEMORY.md)
- Vector-based memory search with embeddings
- SQLite-backed storage with indexing
- Memory files in workspace
- Context assembly from session + memory

#### 4. Tool Execution
- Sandboxed tool execution for security
- Built-in tools: bash, browser automation, file operations
- Plugin system for custom tools
- Tool policy and precedence management
- Session-based security boundaries

#### 5. Control Interfaces
- **Web UI**: Browser-based dashboard with chat, session management, configuration
- **CLI**: Command-line interface for power users
- **macOS App**: Native menu bar application
- **Mobile**: Canvas mode for touch-friendly mobile access

### Dashboard Features (Critical for AgentForge)

**Chat Interface**
- Full message rendering with formatting
- Code blocks with syntax highlighting
- Markdown support
- Conversation history
- Real-time streaming responses

**Session Management**
- View active sessions across all channels
- Start new sessions
- Review session history
- Session debugging capabilities

**Configuration Panel**
- AI model selection (multiple providers)
- Model parameter adjustments
- Channel status monitoring
- Skills overview
- Memory management (view/clear)
- GUI for configuration (no manual JSON editing)

**Monitoring**
- Gateway connection status
- Real-time session monitoring
- Token usage tracking
- Cost tracking per session

### Extensibility Through Plugins

**Plugin Types**
1. **Channel plugins**: Additional messaging platforms
2. **Memory plugins**: Alternative storage backends
3. **Tool plugins**: Custom capabilities
4. **Provider plugins**: Custom LLM providers or self-hosted models

**Plugin Architecture**
- Discovery-based model
- Plugin loader scans workspace packages
- Validates against declared schemas
- Hot-loads when configuration is present

### Security Architecture

**Network Security**
- Local-first operation
- SSH tunnel or Tailscale for remote access
- No external dependencies by default

**Authentication & Device Pairing**
- Device-based authentication
- Channel access control
- Session-based security boundaries

**Tool Sandboxing**
- Container isolation for tool execution
- Filesystem isolation
- Only mounted directories accessible
- Tool policy enforcement

**Prompt Injection Defense**
- Structured system prompts
- Tool execution validation
- Access control layers

### Data Storage

**Configuration**: JSON files in workspace
**Session State**: SQLite with compaction
**Memory**: Vector embeddings + SQLite
**Credentials**: Encrypted storage

## NanoClaw Architecture Analysis

### Core Philosophy
NanoClaw is the **minimalist** version of OpenClaw: "One process, a handful of files, no complexity." It focuses on simplicity while maintaining security through container isolation.

### Key Differentiators

**Simplicity First**
- **1 process** (vs. OpenClaw's microservices)
- **5 core files** (vs. OpenClaw's extensive codebase)
- **6.7k GitHub stars** (growing rapidly)
- **MIT license** (permissive)

**Container Isolation**
- Agents run in Linux containers
- Filesystem isolation
- Only mounted directories accessible
- Bash commands execute safely within containers

**Scheduled Tasks**
- Built-in task scheduler
- Automate daily reports, reminders, background operations
- No external dependencies

**Claude Agent SDK Integration**
- Streaming agent containers powered by Claude Agent SDK
- Direct access to Claude's capabilities
- Built-in web search and content fetching

**Agent Swarms**
- Collaborative multi-agent workflows
- Coordinate multiple Claude instances
- Tackle sophisticated problems efficiently

**Session Groups**
- Isolated context groups
- Individual CLAUDE.md memory files per group
- Personalized interactions
- SQLite-backed message storage with per-group queuing

### Architecture Simplification

NanoClaw achieves simplicity by:
1. **Single process architecture** (no microservices)
2. **Minimal file structure** (5 core files)
3. **Container-based security** (no complex sandboxing)
4. **Built-in features** (no external dependencies for core functionality)
5. **WhatsApp integration** (focused on primary use case)
6. **AI-native setup** (Claude Code for configuration)

## AgentForge Positioning

### Unique Value Proposition

AgentForge sits between OpenClaw (full-featured, complex) and NanoClaw (minimal, simple) by offering:

1. **Minimalist Core** (like NanoClaw)
   - Simple agent primitives
   - Focused feature set
   - Easy to understand and extend

2. **Enterprise-Grade Infrastructure** (like OpenClaw)
   - Proper session management
   - Real-time database (Convex)
   - Secure execution (E2B sandboxes)
   - Production-ready architecture

3. **Modern Stack** (unique to AgentForge)
   - **Mastra**: AI orchestration and agent primitives
   - **Convex**: Reactive database and real-time backend
   - **TanStack Start**: Modern React framework (not Next.js)
   - **Cloudflare**: Edge deployment and scalability

### Recommended Architecture for AgentForge

#### Backend (Convex + Mastra)

**Database Schema** (Convex tables)
```
- agents: Agent definitions and configurations
- threads: Conversation threads
- messages: Message history
- sessions: Active sessions with state
- files: File uploads and metadata
- folders: Folder organization
- projects: Project/workspace management
- skills: Installed skills and configurations
- cronJobs: Scheduled task definitions
- mcpConnections: MCP server connections
- apiKeys: Encrypted API keys (OpenAI, OpenRouter, etc.)
- usage: Token usage and cost tracking
- settings: User configuration
```

**Convex Functions**
- Queries: Read operations (real-time subscriptions)
- Mutations: Write operations (transactional)
- Actions: Long-running operations with Mastra agents (Node.js runtime)

**Mastra Integration**
- Agents run as Convex Node Actions
- Agent definitions stored in Convex
- Tool execution in E2B sandboxes
- MCP for agent-to-agent communication

#### Frontend (TanStack Start)

**Routing Structure**
```
/                    → Dashboard home
/chat                → Chat interface
/agents              → Agent management
/agents/new          → Create agent
/agents/:id          → Agent details
/sessions            → Session management
/files               → File browser
/projects            → Projects/workspaces
/skills              → Skills marketplace
/cron                → Cron job management
/connections         → MCP connections
/metrics             → Usage dashboard
/settings            → Configuration
```

**Key UI Components**
- Chat interface with streaming
- Agent creation wizard
- File upload with drag-and-drop
- Session history viewer
- Metrics dashboard with charts
- Configuration forms
- Mobile-responsive design

#### Multi-Provider LLM Support

**Provider Abstraction Layer**
```typescript
interface LLMProvider {
  id: string;
  name: string;
  models: string[];
  apiKeyRequired: boolean;
  endpoint: string;
}

// Supported providers
- OpenAI (direct)
- OpenRouter (unified access to multiple models)
- Anthropic (via OpenRouter or direct)
- Google (via OpenRouter)
- DeepSeek (via OpenRouter)
- Custom endpoints
```

**BYOK (Bring Your Own Key) Model**
- Users provide their own API keys
- Keys encrypted in Convex
- Per-agent model selection
- Fallback provider configuration

## Implementation Roadmap

### Phase 1: Foundation (Current)
- ✅ Fix Convex schema error
- ✅ Research OpenClaw/NanoClaw architectures
- Design comprehensive database schema
- Set up TanStack Start project structure

### Phase 2: Core Backend
- Implement Convex schema with all tables
- Create Convex functions (queries, mutations, actions)
- Integrate Mastra for agent orchestration
- Set up E2B sandbox integration
- Implement multi-provider LLM support

### Phase 3: Core Frontend
- Set up TanStack Start with routing
- Implement chat interface
- Build agent management UI
- Create session management views
- Add authentication (BetterAuth)

### Phase 4: Extended Features
- File upload and folder management
- Projects/workspaces functionality
- Skills management system
- Cron jobs management
- MCP connections management

### Phase 5: Analytics & Polish
- Metrics and usage dashboard
- Configuration and settings pages
- Mobile-responsive design
- Performance optimization
- Documentation

### Phase 6: Deployment
- Cloudflare Workers setup
- Cloudflare R2 for file storage
- Production deployment guide
- CLI package updates
- npm release

## Key Architectural Decisions

### 1. Database: Convex (Not SQLite)
**Rationale**: Real-time subscriptions, serverless, type-safe, built-in auth
**Trade-off**: Vendor lock-in vs. developer experience and scalability

### 2. Frontend: TanStack Start (Not Next.js)
**Rationale**: User preference, Cloudflare-friendly, modern React patterns
**Trade-off**: Smaller ecosystem vs. flexibility and performance

### 3. Agent Runtime: Mastra + Convex Actions (Not Custom Runtime)
**Rationale**: Leverage existing framework, focus on unique value
**Trade-off**: Less control vs. faster development and maintenance

### 4. Security: E2B Sandboxes (Not Docker Containers)
**Rationale**: Managed service, better isolation, easier to use
**Trade-off**: Cost vs. security and developer experience

### 5. Deployment: Cloudflare (Not Self-Hosted)
**Rationale**: Edge performance, scalability, integrated services
**Trade-off**: Platform dependency vs. global reach and simplicity

## Success Metrics

### Technical Metrics
- Agent creation time: < 2 minutes
- Message latency: < 500ms (P95)
- Session load time: < 1 second
- Uptime: > 99.5%

### User Experience Metrics
- Time to first agent: < 5 minutes
- Dashboard load time: < 2 seconds
- Mobile usability score: > 90/100
- Documentation completeness: 100%

### Business Metrics
- GitHub stars: > 1,000 in first month
- npm downloads: > 500/week
- Community contributions: > 10 PRs
- Production deployments: > 50

## Conclusion

AgentForge will combine the best of both worlds: NanoClaw's minimalist philosophy with OpenClaw's enterprise-grade architecture, powered by modern tools (Mastra, Convex, TanStack Start) and designed for Cloudflare deployment. The result will be a framework that is simple to start with, powerful to scale with, and enjoyable to build with.

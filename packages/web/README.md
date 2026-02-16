# AgentForge Web Dashboard

A comprehensive web dashboard for managing AI agents, built with TanStack Start and designed for deployment on Cloudflare Pages.

## Features

### Chat Interface
- Real-time conversation with agents
- Message history and context management
- Support for multiple sessions
- Streaming responses (coming soon)

### Agent Management
- Create, configure, and manage AI agents
- Support for multiple LLM providers (OpenAI, Anthropic, OpenRouter, Google, xAI)
- Agent activation/deactivation
- Model and parameter configuration
- Tool integration

### Session Management
- View active and historical sessions
- Session debugging and monitoring
- Multi-channel support (dashboard, API, webhooks)

### File Management
- Upload and organize files
- Folder structure
- Integration with Cloudflare R2 for storage

### Projects/Workspaces
- Organize agents and conversations by project
- Project-specific settings and configurations

### Skills Marketplace
- Browse and install agent skills
- Enable/disable skills per agent
- Custom skill development

### Cron Jobs
- Schedule recurring agent tasks
- View execution history
- Enable/disable scheduled jobs

### MCP Connections
- Manage Model Context Protocol connections
- Connect to external services and tools
- Monitor connection status

### Usage Dashboard
- Token usage tracking
- Cost estimation per agent and session
- Usage statistics by provider and model
- Historical usage data

### Configuration
- API key management (encrypted)
- Provider configuration
- System settings

## Tech Stack

- **Framework**: TanStack Start
- **Backend**: Convex (real-time database)
- **Agent Engine**: Mastra
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Icons**: Lucide React
- **Deployment**: Cloudflare Pages

## Development

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Setup

1. Install dependencies:
```bash
pnpm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Add your Convex deployment URL and API keys:
```env
CONVEX_URL=https://your-deployment.convex.cloud
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
```

3. Start development server:
```bash
pnpm dev
```

The dashboard will be available at `http://localhost:3000`.

### Building

```bash
pnpm build
```

### Deployment

#### Cloudflare Pages

1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `pnpm build`
3. Set build output directory: `.vinxi/output/public`
4. Add environment variables in Cloudflare dashboard

Or use Wrangler CLI:

```bash
pnpm wrangler pages deploy .vinxi/output/public
```

## Project Structure

```
packages/web/
├── src/
│   ├── routes/              # TanStack Router routes
│   │   ├── __root.tsx       # Root layout
│   │   ├── index.tsx        # Overview page
│   │   ├── chat.tsx         # Chat interface
│   │   ├── agents.tsx       # Agent management
│   │   ├── sessions.tsx     # Session management
│   │   ├── files.tsx        # File browser
│   │   ├── projects.tsx     # Projects/workspaces
│   │   ├── skills.tsx       # Skills marketplace
│   │   ├── cron.tsx         # Cron jobs
│   │   ├── connections.tsx  # MCP connections
│   │   ├── settings.tsx     # Configuration
│   │   └── usage.tsx        # Usage dashboard
│   ├── components/          # React components
│   │   └── DashboardLayout.tsx
│   ├── lib/                 # Utilities
│   │   └── utils.ts
│   ├── hooks/               # Custom React hooks
│   ├── styles/              # Global styles
│   │   └── globals.css
│   ├── app.tsx              # App entry
│   ├── router.tsx           # Router configuration
│   ├── entry-client.tsx     # Client entry point
│   └── entry-server.tsx     # Server entry point
├── app.config.ts            # TanStack Start config
├── tailwind.config.js       # Tailwind configuration
├── tsconfig.json            # TypeScript configuration
└── package.json
```

## Architecture

### Frontend (TanStack Start)
- File-based routing with TanStack Router
- Server-side rendering (SSR) support
- Optimized for Cloudflare Pages deployment
- Type-safe routing and data fetching

### Backend (Convex)
- Real-time database with automatic subscriptions
- Type-safe queries and mutations
- Node.js actions for Mastra integration
- Built-in authentication and authorization

### Agent Engine (Mastra)
- Multi-provider LLM support
- Tool integration
- Workflow orchestration
- Memory management
- MCP support

## Features Roadmap

### Phase 1 (Current)
- ✅ Dashboard layout and navigation
- ✅ Overview page with stats
- ✅ Chat interface
- ✅ Agent management
- ✅ Basic Convex integration

### Phase 2 (In Progress)
- 🚧 Real-time agent execution
- 🚧 Streaming responses
- 🚧 File upload and management
- 🚧 Session history and debugging
- 🚧 Usage tracking and metrics

### Phase 3 (Planned)
- ⏳ Skills marketplace
- ⏳ Cron job management
- ⏳ MCP connections
- ⏳ Advanced configuration
- ⏳ Multi-user support with authentication

### Phase 4 (Future)
- ⏳ Workflow builder (visual)
- ⏳ Agent analytics and insights
- ⏳ Team collaboration features
- ⏳ API documentation
- ⏳ Mobile app

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

Apache-2.0 - See [LICENSE](../../LICENSE) for details.

## Support

- Documentation: https://github.com/Agentic-Engineering-Agency/agentforge
- Issues: https://github.com/Agentic-Engineering-Agency/agentforge/issues
- Discord: Coming soon

## Acknowledgments

- Inspired by [OpenClaw](https://github.com/safeclaw/openclaw)
- Built with [TanStack Start](https://tanstack.com/start)
- Powered by [Mastra](https://mastra.ai)
- Database by [Convex](https://convex.dev)

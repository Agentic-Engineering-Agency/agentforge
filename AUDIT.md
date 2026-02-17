# Dashboard Audit - Placeholders & Mock Data

## Summary
Every dashboard page uses local useState with hardcoded mock data instead of Convex queries/mutations.
The ConvexProvider is wired up in main.tsx but no page actually calls useQuery/useMutation.
The template only ships schema.ts - no Convex function files.

## Pages with Mock Data (ALL pages)

1. **index.tsx (Overview)** - Hardcoded stats (12 agents, 3 sessions, 1402 messages, 256 files), fake activity feed
2. **agents.tsx** - 3 mock agents (Research Assistant, Code Generator, Creative Writer), local CRUD
3. **chat.tsx** - mockSessions, mockAgents, fake message history, no real AI integration
4. **sessions.tsx** - mockSessions array with fake data
5. **skills.tsx** - 6 mock skills (Web Scraper, Sentiment Analysis, etc.), local state only
6. **connections.tsx** - 3 mock connections (Cloudflare MCP, Stripe API, GitHub Webhook)
7. **cron.tsx** - Local state only, no Convex integration
8. **files.tsx** - Local state only, no real file upload/storage
9. **projects.tsx** - Local state only
10. **usage.tsx** - 8 hardcoded usage records with fake token counts
11. **settings.tsx** - Has UI for providers and vault but no backend integration

## Missing from Template

1. **No Convex function files** - Only schema.ts ships. Need: agents.ts, sessions.ts, threads.ts, messages.ts, skills.ts, cronJobs.ts, mcpConnections.ts, files.ts, folders.ts, projects.ts, usage.ts, vault.ts, apiKeys.ts, heartbeat.ts, settings.ts, logs.ts
2. **No real Convex integration in dashboard** - All useQuery/useMutation calls are commented out
3. **No prebuilt skills with real implementations**
4. **No real MCP/integrations marketplace**
5. **No AI provider key management feature**

## What Needs to Be Built

### Phase 1: Convex Backend Functions (for template)
- Copy all convex/*.ts function files into the template
- Wire up every dashboard page to use real Convex queries/mutations

### Phase 2: AI Provider Keys Management
- Dashboard Settings page: real provider key CRUD via Convex apiKeys table
- CLI: `agentforge config provider` already exists but needs vault integration

### Phase 3: Prebuilt Skills
- Ship real skill implementations in the template skills/ directory
- Web Search, Code Executor, File Manager, Calculator, etc.

### Phase 4: Integrations Marketplace
- Real MCP connector configs for popular services
- Easy auth flow (paste API key, test connection)

### Phase 5: Remove All Mock Data
- Replace every useState(mockData) with useQuery(api.xxx.list)
- Replace every local handler with useMutation(api.xxx.create/update/delete)

# SPEC-026: Dashboard Live E2E Test + Fix All Runtime Errors

**Status:** Active  
**Priority:** P1 — Dashboard untested against live backend  
**Scope:** `packages/cli/templates/default/dashboard/`

---

## Problem

The dashboard builds successfully (confirmed), but its 11 routes have never been tested against a live Convex deployment + running daemon. There may be:
- Runtime JS errors when Convex queries return unexpected shapes
- Missing error boundaries causing blank screens
- Broken form submissions (create agent, add key, etc.)
- Routes that crash on empty data

---

## Context

The dashboard is a React + TanStack Router SPA that talks to Convex via the Convex React client and to the daemon via fetch().

**Architecture:**
- Convex deployment: `dev:hallowed-stork-858` at `https://hallowed-stork-858.convex.cloud`
- Daemon: `agentforge start --port 5555` 
- Dashboard: `npx vite dev` in `dashboard/` → `http://localhost:5173`

**Confirmed working (from build test):**
- All Convex API refs match real functions (`api.agents.list`, `api.threads.createThread`, etc.)
- No stale module references (modelFetcher, chat.sendMessage removed)

---

## Required Work

### 1. Browser-drive every route and fix runtime errors

Use Playwright or Puppeteer to test each route. For each:
- Navigate to the route
- Wait for Convex data to load
- Verify no JS errors in console
- Verify the main content renders (not just "loading...")
- Verify key interactions work (create form, delete, toggle)

Routes to test:
- `/` (index/home)
- `/agents` — list, create form, delete, enable/disable
- `/chat` — open thread, send message via daemon HTTP API, receive reply
- `/settings` — add API key (openai), view masked key
- `/projects` — create project, assign agent
- `/files` — upload file, list files
- `/sessions` — list sessions
- `/cron` — create cron job, trigger, delete
- `/connections` — Telegram/Discord/Slack connection forms
- `/skills` — list skills
- `/usage` — usage stats chart

### 2. Fix all errors found

Common expected issues:
- Type errors when Convex returns `null` where component expects array
- `undefined.map()` when data hasn't loaded yet
- Missing `?.` optional chaining on Convex query results
- `/api/chat` response format mismatch (daemon returns `{ reply, threadId }`, dashboard may expect `{ text }`)

### 3. Dashboard → Daemon chat integration

The chat route calls the daemon's `/api/chat`. Verify the full flow:
1. User selects agent in dashboard
2. User types message
3. Dashboard POSTs to `http://localhost:5555/api/chat`
4. Daemon processes via Mastra
5. Reply appears in dashboard

---

## Setup

```bash
cd /tmp/af-e2e-final/final-test

# Ensure Convex is deployed
CONVEX_DEPLOYMENT="dev:hallowed-stork-858" npx convex dev --once

# Start daemon  
agentforge start --port 5555 &

# Start dashboard dev server
cd dashboard && npx vite --port 5173 &

# Run browser test
OPENAI_API_KEY="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"
```

---

## SpecSafe Checklist
- [ ] Dashboard builds: `cd dashboard && npx vite build` — 0 errors
- [ ] All 11 routes load without console errors (use browser devtools / Playwright)
- [ ] `/agents` — renders agent list and create form
- [ ] `/chat` — sends message, receives reply from daemon
- [ ] `/settings` — can add/list API keys
- [ ] `/cron` — can create/list cron jobs
- [ ] `/projects` — can create/list projects
- [ ] `/files` — can list files (empty state renders)
- [ ] `/sessions` — renders (empty or populated)
- [ ] `/connections` — renders channel connection forms
- [ ] `/skills` — renders skills list
- [ ] `/usage` — renders usage stats (empty state OK)

---

## Branch
`fix/spec-026-dashboard-e2e`

## Notes
- All fixes go in `packages/cli/templates/default/dashboard/` (canonical location)
- After fixing, run `scripts/sync-templates.sh` from repo root
- Dashboard talks to daemon at `window.__AGENTFORGE_DAEMON_URL__ ?? "http://localhost:3001"`
- The Vite dev server proxies Convex queries automatically via the convex client
- Check `dashboard/app/routes/chat.tsx` — the daemon URL must match the running port

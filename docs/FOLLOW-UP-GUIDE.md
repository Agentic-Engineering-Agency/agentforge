---
title: "Public Launch Follow-Up Guide"
description: "Detailed next steps after the v0.12.24 security hardening for public open-source launch"
---

# AgentForge — Public Launch Follow-Up Guide

> Written 2026-03-19 after the comprehensive multi-model audit (Claude + Gemini 3 Pro + Codex GPT 5.4) and PR #253 merge.

---

## Immediate Steps (Before Going Public)

### 1. Flip Repository to Public
```bash
# Verify everything is clean first
pnpm test && pnpm typecheck && pnpm audit --audit-level=high

# Flip visibility
gh repo edit Agentic-Engineering-Agency/agentforge --visibility public

# Verify
gh repo view --json isPrivate -q '.isPrivate'  # should return false
```

### 2. Set Branch Protection on `main`
```bash
gh api repos/Agentic-Engineering-Agency/agentforge/branches/main/protection \
  --method PUT \
  -f required_status_checks='{"strict":true,"contexts":["Lint","Build & Test","Security Audit"]}' \
  -f enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1}' \
  -f restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false
```

### 3. Publish v0.12.24 Security Release
```bash
# Bump versions in all 4 package.json files
# root, packages/cli, packages/core, packages/runtime → 0.12.24

# Update CHANGELOG.md with security entries

# Tag and push
git tag v0.12.24
git push origin v0.12.24

# Create GitHub release
gh release create v0.12.24 \
  --title "v0.12.24 — Security Hardening for Public Launch" \
  --notes-file /dev/stdin <<'EOF'
## Security Fixes
- `censorMessage` internalized — no longer leaks secret detection patterns
- `apiKeys.create/update` internalized — plaintext key handling is now internal-only
- HTTP daemon warns when running without authentication
- Dependency vulnerabilities patched: undici ≥7.24.0, hono ≥4.12.7, fast-xml-parser ≥5.5.6
- Hardcoded API key scrubbed from git history

## Community
- Added SECURITY.md with vulnerability disclosure process
- Added GitHub issue and PR templates
- Cleaned up 30+ stale branches

## Install
```
npm install -g @agentforge-ai/cli@latest
agentforge create my-project
```
EOF

# Verify npm publish (triggered by tag)
npm view @agentforge-ai/cli version  # should show 0.12.24
```

---

## Short-Term (Week 1-2 After Public Launch)

### 4. Community Onboarding
- **Pin the Roadmap issue** to the repo for visibility
- **Enable GitHub Discussions** for Q&A and feature requests
- **Write announcement posts:**
  - Twitter/X thread with demo GIF
  - Dev.to article: "We Open-Sourced AgentForge"
  - Reddit: r/typescript, r/artificial, r/selfhosted
  - Hacker News submission
- **Add repository topics** on GitHub: `ai-agents`, `mastra`, `convex`, `typescript`, `cli`, `self-hosted`

### 5. Type Safety Sprint (429 `any` casts)
The CLI commands are the biggest offenders. The pattern to fix:
```typescript
// ❌ Current (repeated across 18 command files)
const result = await client.action('agents:list' as any) as any;

// ✅ Target
import { api } from '../convex/_generated/api';
const result = await client.action(api.agents.list);
// If types don't match, create typed DTOs in packages/core
```

Priority files (most `any` casts):
- `packages/cli/src/commands/agents.ts`
- `packages/cli/src/commands/chat.ts`
- `packages/cli/src/commands/keys.ts`
- `packages/cli/src/commands/models.ts`
- `packages/cli/src/commands/sessions.ts`

### 6. Test Coverage Sprint (81 untested exports)
Priority untested functions:
- `createStandardAgent` — the core agent factory
- `progressiveStream`, `splitMessage`, `formatSSEChunk` — streaming utilities
- `normalizeModelId`, `getModel`, `resolveModel` — model registry
- `sanitizeInput` — security-critical input sanitizer
- `validateEnv` — environment validation

### 7. Silent Catch Blocks (~50)
Add structured debug logging before empty catches:
```typescript
// ❌ Current
.catch(() => {})

// ✅ Target
.catch((err) => {
  logger.debug('Optional operation failed', { error: err.message, context: 'model-fetch' })
})
```

---

## Medium-Term (Month 1-2)

### 8. Structured Logging
Replace `console.log/warn/error` with a structured logger (pino recommended):
- CLI output stays as `console.log` (intentional user-facing)
- Runtime/core operational logs → `pino` with JSON output
- Add `LOG_LEVEL` environment variable support

### 9. Dead Code Audit (72 exports)
Review unreferenced exports from the Codex audit. For each:
- **If public API surface** → document in API reference, add tests
- **If internal-only** → remove export, keep as private function
- **If truly dead** → delete

Priority: `packages/core/src/mastra.ts` has 10 unreferenced exports.

### 10. Dashboard Component Tests
Issue #230 — add component tests for all 7 dashboard routes. Consider:
- Vitest + React Testing Library
- Mock Convex client for data layer
- Test loading states, error states, user interactions

### 11. Fumadocs Migration
The docs/ folder is being reorganized into sections:
```
docs/
├── index.md              # Landing page
├── guides/               # Getting started, deployment
├── reference/            # CLI, tech reference, releasing
├── architecture/         # System design, diagrams, channels
├── features/             # Skills, MCP, A2A, multi-agent
├── examples/             # FinForge demo
└── contributing/         # Development guide, dependencies
```

To complete the fumadocs migration:
1. Add `fumadocs-core` and `fumadocs-ui` to packages/web
2. Create `docs/meta.json` for sidebar navigation order
3. Convert all .md files to .mdx where interactive components are needed
4. Set up `next.config.mjs` with fumadocs plugin

---

## Long-Term (v1.0.0 Roadmap)

### 12. Authentication & Authorization
- Convex-level auth (currently all public functions are accessible to anyone with the deployment URL)
- User sessions for the dashboard
- Role-based access control for API keys and agents

### 13. Cloud Hosting
- Managed AgentForge instances (SaaS model)
- Agent marketplace for sharing configurations
- Usage-based billing

### 14. Advanced Channel Adapters
- WhatsApp (partially implemented in packages/core)
- Slack (partially implemented in packages/core)
- Email channel
- Webhook channel (generic)

### 15. Agent Marketplace
- Publish/discover agent configurations
- Skill marketplace integration
- Template sharing

---

## Monitoring Checklist (Weekly)

```bash
# Security
pnpm audit --audit-level=high     # 0 vulnerabilities
gh api repos/{owner}/{repo}/vulnerability-alerts  # check Dependabot

# Quality
pnpm test                          # all green
pnpm typecheck                     # 0 errors

# Community
gh issue list --state open --label "good first issue"  # keep stocked
gh pr list --state open            # review pending PRs

# npm
npm view @agentforge-ai/cli version  # matches latest release
```

---

## Key Contacts
- **Repo:** github.com/Agentic-Engineering-Agency/agentforge
- **Security:** security@agenticengineering.agency
- **General:** hello@agenticengineering.agency
- **npm:** @agentforge-ai/cli, @agentforge-ai/core, @agentforge-ai/runtime

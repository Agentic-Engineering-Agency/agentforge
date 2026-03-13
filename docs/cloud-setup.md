# Cloud Environment Setup — Claude Code & OpenAI Codex

This guide covers setting up AgentForge for cloud-based AI coding environments.

## Overview

AgentForge supports two cloud coding platforms out of the box:

| Feature | Claude Code (Cloud) | OpenAI Codex |
|---------|-------------------|--------------|
| URL | [claude.ai/code](https://claude.ai/code) | [chatgpt.com/codex](https://chatgpt.com/codex) |
| Instruction file | `CLAUDE.md` | `AGENTS.md` |
| Settings file | `.claude/settings.json` | `.codex/environments/environment.toml` |
| Setup mechanism | SessionStart hook + cloud UI setup script | Setup script in environment.toml + cloud UI |
| Network during setup | Yes | Yes |
| Network during agent | Limited (allowlist) | Off by default |

## Claude Code (Cloud Sessions)

### Prerequisites
- Claude Pro, Max, Team, or Enterprise plan
- GitHub account connected at [claude.ai/code](https://claude.ai/code)
- Claude GitHub App installed on the `Agentic-Engineering-Agency/agentforge` repo

### What's Already Configured

**`CLAUDE.md`** (root) — Project rules, architecture, and non-negotiable constraints. Claude reads this automatically.

**`.claude/settings.json`** — Hooks:
- `SessionStart`: Runs `pnpm install` + `pnpm sync-templates` when a session starts
- `PreToolUse`: Blocks `npm` commands (enforces `pnpm` for this monorepo)
- `PostToolUse`: Auto-runs `pnpm typecheck` after TS file edits; warns about template sync

### Cloud UI Setup Script (Optional)

If dependencies fail to install via the SessionStart hook (e.g., network timing), configure this in the Claude Code cloud environment settings:

```bash
cd "$CLAUDE_PROJECT_DIR"
bash scripts/cloud-setup.sh
```

### Network Allowlist

The default "Limited" network mode allowlists npm registry, GitHub, and common CDNs. This is sufficient for AgentForge. No custom allowlist entries needed.

### Starting a Cloud Session

**From the web:**
1. Go to [claude.ai/code](https://claude.ai/code)
2. Select the `agentforge` repository
3. Choose a branch or create a new one
4. Start coding — `CLAUDE.md` loads automatically

**From the terminal:**
```bash
# Launch a cloud session with a task
claude --remote "Fix the failing test in packages/runtime"

# Pull a cloud session to your terminal
claude --teleport
```

---

## OpenAI Codex (Cloud Tasks)

### Prerequisites
- ChatGPT Plus, Pro, Business, or Enterprise plan
- GitHub account connected at [chatgpt.com/codex](https://chatgpt.com/codex)

### What's Already Configured

**`AGENTS.md`** (root) — Project overview, architecture, team structure, and coding rules. Codex reads this automatically.

**`.codex/environments/environment.toml`** — Setup script that:
1. Installs pnpm (if missing)
2. Runs `pnpm install` (with internet access)
3. Syncs templates
4. Builds all packages
5. Provides Typecheck, Test, Lint, and Full QA actions

### Environment Variables

Configure these in the Codex environment settings (chatgpt.com/codex → Environment):

| Variable | Required | Purpose |
|----------|----------|---------|
| `CONVEX_URL` | For Convex tests | Convex deployment URL |
| `OPENAI_API_KEY` | For LLM tests | OpenAI API key (set as Secret) |

> **Secrets** are only available during the setup phase, not during the agent phase. Use **Environment Variables** for values the agent needs at runtime.

### Starting a Codex Task

1. Go to [chatgpt.com/codex](https://chatgpt.com/codex)
2. Select the `agentforge` repository
3. Describe the task (e.g., "Add retry logic to the HTTP channel adapter")
4. Codex clones the repo, runs the setup script, then works offline
5. Review the diff and create a PR

---

## Shared Setup Script

Both platforms can use `scripts/cloud-setup.sh` which:
1. Detects the environment (Claude Cloud, Codex, Docker Sandbox)
2. Ensures pnpm is available
3. Installs all workspace dependencies
4. Syncs Convex templates (Rule 6)
5. Builds all packages for cross-package imports

---

## Docker Sandbox (Self-Hosted)

For local/self-hosted development with AI agents:

```bash
# Build the agent sandbox image
docker build -f docker/Dockerfile.agent-sandbox -t agentforge/agent-sandbox .

# Run with docker-compose
docker compose -f docker/docker-compose.agent-sandbox.yml up -d

# Detect available agents
docker compose -f docker/docker-compose.agent-sandbox.yml exec sandbox detect-agents
```

See `docker/README.md` for full Docker setup documentation.

---

## Monorepo Tips for Cloud Environments

1. **Always use `pnpm`** — The `PreToolUse` hook blocks `npm` commands automatically
2. **Template sync** — After editing `convex/` files, run `pnpm sync-templates` (Rule 6)
3. **Package boundaries** — Each package has its own `tsconfig.json` and `vitest.config.ts`
4. **Build order** — `core` → `runtime` → `cli` → `web` (handled by `pnpm build`)
5. **Tests** — `pnpm test` runs all workspace tests; `pnpm test --filter @agentforge-ai/runtime` for a single package

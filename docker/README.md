# AgentForge Agent Sandbox — Docker

The Agent Sandbox is a Docker container pre-configured with multiple AI coding agent CLIs for multi-agent orchestration.

## Supported Agent CLIs

| Agent | Command | API Key | Description |
|-------|---------|---------|-------------|
| Codex CLI | `codex` | `OPENAI_API_KEY` | OpenAI's coding assistant |
| Claude Code | `claude` | `ANTHROPIC_API_KEY` | Anthropic's Claude-powered coding |
| Gemini CLI | `gemini` | `GOOGLE_API_KEY` | Google's Gemini-powered coding |
| OpenCode | `opencode` | `OPENROUTER_API_KEY` | Open-source AI coding assistant |
| Aider | `aider` | `OPENAI_API_KEY` | AI pair programming tool |

## Quick Start

```bash
# 1. Copy environment template
cp docker/.env.example docker/.env

# 2. Fill in your API keys
nano docker/.env

# 3. Build and start the sandbox
docker compose -f docker/docker-compose.agent-sandbox.yml up -d

# 4. Check which agents are available
docker compose -f docker/docker-compose.agent-sandbox.yml exec sandbox detect-agents

# 5. Run an agent
docker compose -f docker/docker-compose.agent-sandbox.yml exec sandbox run-agent codex "Fix the auth bug"
```

## Building the Image

```bash
docker build -f docker/Dockerfile.agent-sandbox -t agentforge/agent-sandbox .
```

## Running Standalone

```bash
docker run -it --rm \
  -e OPENAI_API_KEY=sk-... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v $(pwd):/workspace \
  agentforge/agent-sandbox
```

## Scripts

### `detect-agents`

Scans the container for installed agent CLIs and reports their status.

```bash
# Human-readable output
detect-agents

# JSON output (for programmatic use)
detect-agents --json
```

### `run-agent`

Runs a specific agent CLI with a prompt.

```bash
run-agent <agent-name> <prompt> [extra-args...]

# Examples
run-agent codex "Fix the bug in auth.ts"
run-agent claude-code "Refactor the database layer"
run-agent aider "Add unit tests for the API"
```

### `healthcheck`

Container health check verifying Node.js, Git, workspace access, and agent availability.

## Architecture

The sandbox is designed to be used by the AgentForge `SwarmOrchestrator` for parallel multi-agent dispatch. Each agent runs in the same container with shared workspace access, enabling:

1. **Task decomposition** — Break complex tasks into sub-tasks
2. **Agent selection** — Choose the best agent for each sub-task
3. **Parallel execution** — Run multiple agents simultaneously
4. **Result aggregation** — Combine outputs from all agents

## Resource Limits

Default resource limits (configurable in docker-compose):

- **Memory**: 8 GB (2 GB reserved)
- **CPU**: 4 cores (1 core reserved)
- **Workspace**: Mounted from host (read-write)

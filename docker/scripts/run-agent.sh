#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# run-agent.sh — Run a specific agent CLI with a prompt
# ─────────────────────────────────────────────────────────────────────────
#
# Usage:
#   run-agent <agent-name> <prompt> [options]
#
# Examples:
#   run-agent codex "Fix the bug in auth.ts"
#   run-agent claude-code "Refactor the database layer"
#   run-agent aider "Add unit tests for the API"
#
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

AGENT_NAME="${1:-}"
PROMPT="${2:-}"

if [[ -z "$AGENT_NAME" || -z "$PROMPT" ]]; then
  echo "Usage: run-agent <agent-name> <prompt> [options]"
  echo ""
  echo "Available agents:"
  echo "  codex        - OpenAI Codex CLI"
  echo "  claude-code  - Anthropic Claude Code"
  echo "  gemini       - Google Gemini CLI"
  echo "  opencode     - OpenCode AI"
  echo "  aider        - Aider AI pair programming"
  exit 1
fi

shift 2
EXTRA_ARGS=("$@")

# Map agent name to command and default args
case "$AGENT_NAME" in
  codex)
    CMD="codex"
    DEFAULT_ARGS=("--quiet")
    ;;
  claude-code|claude)
    CMD="claude"
    DEFAULT_ARGS=("--print")
    ;;
  gemini)
    CMD="gemini"
    DEFAULT_ARGS=()
    ;;
  opencode)
    CMD="opencode"
    DEFAULT_ARGS=()
    ;;
  aider)
    CMD="aider"
    DEFAULT_ARGS=("--yes" "--no-auto-commits")
    ;;
  *)
    echo "Error: Unknown agent '$AGENT_NAME'"
    echo "Run 'detect-agents' to see available agents."
    exit 1
    ;;
esac

# Check if the command exists
if ! command -v "$CMD" &>/dev/null; then
  echo "Error: Agent '$AGENT_NAME' is not installed."
  echo "Run 'detect-agents' to check installation status."
  exit 1
fi

# Execute the agent
echo "[AgentForge] Running $AGENT_NAME with prompt: $PROMPT"
echo "[AgentForge] Working directory: $(pwd)"
echo "---"

exec "$CMD" "${DEFAULT_ARGS[@]}" "${EXTRA_ARGS[@]}" "$PROMPT"

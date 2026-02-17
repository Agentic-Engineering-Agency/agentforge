#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# healthcheck.sh — Container health check for agent sandbox
# ─────────────────────────────────────────────────────────────────────────
#
# Checks:
#   1. Node.js is available
#   2. Git is available
#   3. At least one agent CLI is installed
#   4. Workspace directory is writable
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Check Node.js
node --version > /dev/null 2>&1 || exit 1

# Check Git
git --version > /dev/null 2>&1 || exit 1

# Check workspace is writable
WORKSPACE="${AGENTFORGE_WORKSPACE:-/workspace}"
touch "$WORKSPACE/.healthcheck" 2>/dev/null && rm -f "$WORKSPACE/.healthcheck" || exit 1

# Check at least one agent is installed
AGENTS=("codex" "claude" "gemini" "opencode" "aider")
found=false
for agent in "${AGENTS[@]}"; do
  if command -v "$agent" &>/dev/null; then
    found=true
    break
  fi
done

if [[ "$found" == "false" ]]; then
  # Not a hard failure — container works but no agents installed
  echo "Warning: No agent CLIs detected"
fi

exit 0

#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# AgentForge Cloud Environment Setup
# ─────────────────────────────────────────────────────────────────────────
# Shared setup script for cloud coding environments (Claude Code, Codex).
# Called by SessionStart hooks (.claude/settings.json) or Codex setup scripts.
#
# Usage:
#   bash scripts/cloud-setup.sh
# ─────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "=== AgentForge Cloud Setup ==="
echo "Node: $(node -v 2>/dev/null || echo 'not found')"
echo "Platform: ${CLAUDE_CODE_REMOTE:+Claude Code Cloud}${CODEX_SANDBOX:+Codex Cloud}${AGENTFORGE_SANDBOX:+Docker Sandbox}"

# 1. Ensure pnpm is available
if ! command -v pnpm &>/dev/null; then
  echo "Installing pnpm..."
  corepack enable 2>/dev/null || npm install -g pnpm
  corepack prepare pnpm@latest --activate 2>/dev/null || true
fi

echo "pnpm: $(pnpm -v)"

# 2. Install dependencies
echo "Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 3. Sync templates (CLAUDE.md Rule 6)
echo "Syncing templates..."
pnpm sync-templates 2>/dev/null || true

# 4. Build packages (needed for cross-package imports)
echo "Building packages..."
pnpm build 2>/dev/null || true

echo "=== Setup Complete ==="

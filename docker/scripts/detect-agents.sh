#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# detect-agents.sh — Detect and report available agent CLIs
# ─────────────────────────────────────────────────────────────────────────
#
# Scans the container for installed agent CLIs and reports their status.
# Used by AgentForge to determine which agents are available for dispatch.
#
# Output format: JSON array of agent objects
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Agent definitions: name|command|version_flag|api_key_env
AGENTS=(
  "codex|codex|--version|OPENAI_API_KEY"
  "claude-code|claude|--version|ANTHROPIC_API_KEY"
  "gemini|gemini|--version|GOOGLE_API_KEY"
  "opencode|opencode|--version|OPENROUTER_API_KEY"
  "aider|aider|--version|OPENAI_API_KEY"
)

# JSON output mode
JSON_MODE=false
if [[ "${1:-}" == "--json" ]]; then
  JSON_MODE=true
fi

if [[ "$JSON_MODE" == "false" ]]; then
  echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║     AgentForge Agent Sandbox — CLI Detection     ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
fi

json_agents=()
available_count=0
total_count=${#AGENTS[@]}

for agent_def in "${AGENTS[@]}"; do
  IFS='|' read -r name command version_flag api_key_env <<< "$agent_def"

  # Check if command exists
  installed=false
  version="unknown"
  if command -v "$command" &>/dev/null; then
    installed=true
    version=$($command $version_flag 2>/dev/null | head -1 || echo "unknown")
  fi

  # Check if API key is configured
  api_configured=false
  if [[ -n "${!api_key_env:-}" ]]; then
    api_configured=true
  fi

  # Determine overall status
  if [[ "$installed" == "true" && "$api_configured" == "true" ]]; then
    status="ready"
    ((available_count++))
    status_icon="${GREEN}✓ READY${NC}"
  elif [[ "$installed" == "true" ]]; then
    status="installed"
    status_icon="${YELLOW}⚠ NO API KEY${NC}"
  else
    status="missing"
    status_icon="${RED}✗ NOT INSTALLED${NC}"
  fi

  if [[ "$JSON_MODE" == "false" ]]; then
    printf "  %-15s %b  (version: %s, key: %s)\n" "$name" "$status_icon" "$version" "$api_key_env"
  fi

  # Build JSON object
  json_agents+=("{\"name\":\"$name\",\"command\":\"$command\",\"installed\":$installed,\"version\":\"$version\",\"apiKeyEnv\":\"$api_key_env\",\"apiConfigured\":$api_configured,\"status\":\"$status\"}")
done

if [[ "$JSON_MODE" == "false" ]]; then
  echo ""
  echo -e "  ${BLUE}Summary:${NC} $available_count/$total_count agents ready"
  echo ""

  if [[ $available_count -eq 0 ]]; then
    echo -e "  ${YELLOW}Tip:${NC} Set API keys to enable agents:"
    echo "    export OPENAI_API_KEY=sk-..."
    echo "    export ANTHROPIC_API_KEY=sk-ant-..."
    echo "    export GOOGLE_API_KEY=..."
    echo ""
  fi
else
  # Output JSON
  echo -n "["
  for i in "${!json_agents[@]}"; do
    if [[ $i -gt 0 ]]; then echo -n ","; fi
    echo -n "${json_agents[$i]}"
  done
  echo "]"
fi

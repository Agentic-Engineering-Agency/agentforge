#!/usr/bin/env bash
# Check for drift between the canonical dashboard template and sync targets.
# Canonical source: packages/cli/templates/default/dashboard/
# Targets:          packages/cli/dist/default/dashboard/
#                   packages/web/ (shared surface only)
#
# Exit 0 if in sync, exit 1 if drift detected.
# Run in CI or locally: bash scripts/check-dashboard-drift.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CANONICAL="$PROJECT_ROOT/packages/cli/templates/default/dashboard"
DIST_TARGET="$PROJECT_ROOT/packages/cli/dist/default/dashboard"
WEB_TARGET="$PROJECT_ROOT/packages/web"

DRIFT_FOUND=0

echo "Checking dashboard drift..."
echo "  Canonical: $CANONICAL"
echo ""

# ---------- Helper ----------
check_drift() {
  local label="$1"
  local dir_a="$2"
  local dir_b="$3"
  shift 3
  # remaining args are --exclude flags for diff

  if [ ! -d "$dir_a" ]; then
    echo "  FAIL $label (source missing: $dir_a)"
    DRIFT_FOUND=1
    return
  fi
  if [ ! -d "$dir_b" ]; then
    echo "  FAIL $label (target missing: $dir_b)"
    DRIFT_FOUND=1
    return
  fi

  local diff_output
  # Use git diff --no-index for cross-platform compatibility (works on both GNU/Linux and macOS/BSD)
  diff_output=$(git diff --no-index --stat \
    -- "$dir_a" "$dir_b" 2>&1 | grep -v 'node_modules\|\.DS_Store\|routeTree\.gen\.ts') || true

  if [ -n "$diff_output" ]; then
    echo "  DRIFT in $label:"
    echo "$diff_output" | sed 's/^/    /'
    echo ""
    DRIFT_FOUND=1
  else
    echo "  OK $label"
  fi
}

# ---------- Check 1: canonical vs dist ----------
echo "[1/2] Canonical vs dist/default/dashboard"
check_drift "dist" "$CANONICAL" "$DIST_TARGET"

# ---------- Check 2: canonical vs packages/web (shared surface only) ----------
# We compare only the shared directories: app/routes, app/components, app/lib
# We exclude web-specific root files (README.md, wrangler.toml, .gitignore, public/, packages/)
echo "[2/2] Canonical vs packages/web (shared surface)"

for subdir in "app/routes" "app/components" "app/lib"; do
  if [ -d "$CANONICAL/$subdir" ]; then
    check_drift "web/$subdir" "$CANONICAL/$subdir" "$WEB_TARGET/$subdir"
  fi
done

# ---------- Summary ----------
echo ""
if [ "$DRIFT_FOUND" -eq 1 ]; then
  echo "FAILED: Dashboard drift detected. Run 'pnpm sync-templates' to fix."
  exit 1
else
  echo "PASSED: All dashboard targets are in sync with canonical source."
  exit 0
fi

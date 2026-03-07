#!/usr/bin/env bash
# Sync canonical template files to all derived locations
# Single source of truth: packages/cli/templates/default/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$PROJECT_ROOT/packages/cli/templates/default/convex"
DASHBOARD_SRC="$PROJECT_ROOT/packages/cli/templates/default/dashboard"

echo "🔄 Syncing Convex templates from: $SRC"

# Sync to 3 other locations
for dest in \
    "$PROJECT_ROOT/packages/cli/dist/default/convex" \
    "$PROJECT_ROOT/templates/default/convex" \
    "$PROJECT_ROOT/convex"
do
    echo "  → $dest"
    mkdir -p "$dest"
    rsync -av --delete "$SRC/" "$dest/" --exclude='_generated' --exclude='node_modules'
done

echo "🔄 Syncing dashboard templates from: $DASHBOARD_SRC"

for dest in \
    "$PROJECT_ROOT/packages/cli/dist/default/dashboard"
do
    echo "  → $dest"
    mkdir -p "$dest"
    rsync -av --delete "$DASHBOARD_SRC/" "$dest/" --exclude='node_modules'
done

WEB_DEST="$PROJECT_ROOT/packages/web"
echo "  → $WEB_DEST"
mkdir -p "$WEB_DEST"
# packages/web is a derived dogfooding app. Preserve repo-only glue while
# copying the canonical dashboard sources over the shared surface area.
rsync -av "$DASHBOARD_SRC/" "$WEB_DEST/" \
  --exclude='node_modules' \
  --exclude='README.md' \
  --exclude='.gitignore' \
  --exclude='wrangler.toml' \
  --exclude='packages' \
  --exclude='public'

echo "✅ Templates synced successfully"

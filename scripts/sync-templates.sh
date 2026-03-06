#!/bin/bash
# Sync convex template files to all 4 locations
# Single source of truth: packages/cli/templates/default/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$PROJECT_ROOT/packages/cli/templates/default/convex"

echo "🔄 Syncing Convex templates from: $SRC"

# Sync to 3 other locations
for dest in \
    "$PROJECT_ROOT/packages/cli/dist/default/convex" \
    "$PROJECT_ROOT/templates/default/convex" \
    "$PROJECT_ROOT/convex"
do
    echo "  → $dest"
    mkdir -p "$dest"
    rsync -av --delete "$SRC/" "$dest/" --exclude='*_generated' --exclude='node_modules'
done

echo "✅ Templates synced successfully"

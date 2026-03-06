#!/usr/bin/env bash
# Sync canonical template source to all 4 locations
set -e
SRC="packages/cli/templates/default"
echo "Syncing from $SRC..."
for dest in "packages/cli/dist/default" "templates/default" "convex"; do
  rsync -av --delete --exclude="node_modules" "$SRC/convex/" "$dest/convex/" 2>/dev/null || true
done
echo "✅ Templates synced"

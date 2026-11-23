#!/bin/bash
set -euo pipefail

# Preserve optional sibling links without exposing host node_modules.
mkdir -p "$HOME/chords-workspace"
# Carry shipped native artifacts: the guest JS build uses CHORD_SKIP_NATIVE=1.
rsync -a --delete --exclude=node_modules --exclude=.git --exclude=.jj --exclude=.build --exclude=.chord-testing '/Volumes/My Shared Files/chords-sources/' "$HOME/chords-workspace/"
cd "$HOME/chords-workspace"
if grep -q 'link:../config' pnpm-lock.yaml; then
  config_share='/Volumes/My Shared Files/chords-config'
  if [ ! -f "$config_share/package.json" ]; then
    echo 'The lockfile links ../config. The guest needs that sibling checkout.' >&2
    exit 1
  fi
  mkdir -p "$HOME/config"
  rsync -a --delete --exclude=node_modules --exclude=.git --exclude=.jj "$config_share/" "$HOME/config/"
  ln -sfn "$HOME/chords-workspace" "$HOME/chords"
  vp install --frozen-lockfile --ignore-scripts
  (cd "$HOME/config" && vp install --frozen-lockfile && vp pack)
  vp run workflows:build
else
  vp install --frozen-lockfile
fi

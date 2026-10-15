#!/bin/bash
set -euo pipefail

# Preserve the workspace's sibling links without exposing host node_modules.
mkdir -p "$HOME/chords-workspace" "$HOME/config"
# Carry shipped native artifacts: the guest JS build uses CHORD_SKIP_NATIVE=1.
rsync -a --delete --exclude=node_modules --exclude=.git --exclude=.jj --exclude=.build --exclude=.chord-testing '/Volumes/My Shared Files/chords-sources/' "$HOME/chords-workspace/"
rsync -a --delete --exclude=node_modules --exclude=.git --exclude=.jj '/Volumes/My Shared Files/chords-config/' "$HOME/config/"
ln -sfn "$HOME/chords-workspace" "$HOME/chords"

cd "$HOME/chords-workspace"
# The root postinstall loads @keychord/config before its sibling dependencies
# exist in a fresh VM. Install both dependency trees before running that hook.
vp install --frozen-lockfile --ignore-scripts
cd "$HOME/config"
vp install --frozen-lockfile
vp pack
cd "$HOME/chords-workspace"
vp run workflows:build

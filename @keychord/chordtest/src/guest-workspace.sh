#!/bin/bash
set -euo pipefail

# Preserve the workspace's sibling links without exposing host node_modules.
mkdir -p "$HOME/chords-workspace" "$HOME/config"
rsync -a --delete --exclude=node_modules --exclude=.git --exclude=.jj --exclude=.build --exclude=.chord-testing --exclude=target '/Volumes/My Shared Files/chords-sources/' "$HOME/chords-workspace/"
rsync -a --delete --exclude=node_modules --exclude=.git --exclude=.jj '/Volumes/My Shared Files/chords-config/' "$HOME/config/"
ln -sfn "$HOME/chords-workspace" "$HOME/chords"

cd "$HOME/chords-workspace"
vp install --frozen-lockfile
cd "$HOME/config"
vp install --frozen-lockfile
vp pack

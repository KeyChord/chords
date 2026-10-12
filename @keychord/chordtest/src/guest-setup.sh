#!/bin/bash
set -euo pipefail
case "$(/usr/sbin/sysctl -n hw.model)" in
  VirtualMac*) ;;
  *) echo "Refusing to provision UI permissions on the host Mac" >&2; exit 1 ;;
esac
export PATH="$HOME/.bun/bin:$HOME/.vite-plus/bin:$HOME/.vite-plus/0.1.15/bin:$HOME/.vite-plus/0.1.15:/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

if ! command -v bun >/dev/null; then
  curl -fsSL https://bun.com/install -o /tmp/chords-install-bun.sh
  bash /tmp/chords-install-bun.sh
fi
if ! command -v vp >/dev/null; then
  curl -fsSL https://vite.plus -o /tmp/chords-install-vp.sh
  VP_HOME="$HOME/.vite-plus" VP_VERSION=0.1.15 bash /tmp/chords-install-vp.sh
fi
swift --version

# Only the disposable guest's database is modified. Grant stable tool paths for native UI tests.
# Cirrus Labs base images provision their guest agent for UI automation.
chords_tcc="$HOME/Library/Application Support/com.apple.TCC/TCC.db"
for chords_binary in "$HOME/.bun/bin/bun"; do
  sqlite3 "$chords_tcc" "INSERT OR REPLACE INTO access (service, client, client_type, auth_value, auth_reason, auth_version, csreq, policy_id, indirect_object_identifier_type, indirect_object_identifier, indirect_object_code_identity, flags, last_modified) VALUES ('kTCCServiceAccessibility', '$chords_binary', 1, 2, 4, 1, NULL, NULL, 0, 'UNUSED', NULL, 0, strftime('%s','now'));"
done

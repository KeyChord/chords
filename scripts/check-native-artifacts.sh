#!/usr/bin/env bash
# Fails if the committed native artifacts under packages/*/target/ are out of
# date with src/swift/. CI syncs these prebuilt .node files straight to the
# mirrors without building them, so a stale artifact would ship silently.
#
# NOTE: Mach-O output is NOT byte-reproducible. The linker mints a fresh LC_UUID
# on every run, and that UUID feeds the adhoc code-signature identifier, so two
# builds of identical sources differ by ~64 bytes. We therefore compare
# disassembled machine code (`otool -tV`), not file hashes.
#
# moon decides whether a rebuild is needed at all (it hashes src/swift/** and
# tracks target/ as outputs), so this is a fast no-op when nothing changed.
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
	echo "[native-check] not macOS, skipping native artifact check"
	exit 0
fi

# Snapshot the committed code of every tracked addon before rebuilding.
declare -a ADDONS=()
while IFS= read -r addon; do ADDONS+=("$addon"); done < <(git ls-files -- '*.node')

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

code_of() { otool -tV "$1" 2>/dev/null | tail -n +2; }

for addon in "${ADDONS[@]}"; do
	git show "HEAD:$addon" > "$TMP/committed.node" 2>/dev/null || continue
	code_of "$TMP/committed.node" > "$TMP/$(echo "$addon" | tr / _).before"
done

moon run ':build-native'

STALE=()
for addon in "${ADDONS[@]}"; do
	before="$TMP/$(echo "$addon" | tr / _).before"
	[[ -f "$before" ]] || continue
	if ! diff -q "$before" <(code_of "$addon") >/dev/null 2>&1; then
		STALE+=("$addon")
	fi
done

if [[ ${#STALE[@]} -gt 0 ]]; then
	echo "::error::Committed native artifacts are out of date with src/swift/."
	echo "Rebuilding produced different machine code for:"
	printf '  %s\n' "${STALE[@]}"
	echo
	echo "Stage the rebuilt artifacts and commit again:"
	echo "    git add packages/*/target"
	exit 1
fi

# Code matches, so any remaining byte diff is just UUID/signature churn from the
# rebuild. Restore the committed bytes to keep the commit free of no-op noise.
git checkout -- '*/target/*' 2>/dev/null || true

echo "[native-check] native artifacts are up to date"

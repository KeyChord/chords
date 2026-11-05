A monorepo of all the conventional chord packages.

> [!NOTE]
> This section is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Chord packages live in `@keychord/`; workspace tooling and third-party wrappers
live in `packages/`.

## Installing packages

These packages run in [Chord](https://github.com/KeyChord/Chord). Download
`Chord-aarch64.dmg` (Apple silicon) or `Chord-x86_64.dmg` (Intel) from the
[latest release](https://github.com/KeyChord/Chord/releases/latest), grant Accessibility
access on first launch, then press Caps Lock + Space (the activation shortcut) to start a
chord. Packages with native add-ons are built for Apple silicon only so far.

On first launch Chord installs a few default packages at pinned revisions, including
`@keychord/chords-chord`, `@keychord/chords-menu` and `@keychord/chords-com.apple`.

In the current monorepo, Apple app bindings live in packages named after their
exact bundle IDs: `chords-com.apple.AccessibilityInspector`,
`chords-com.apple.ActivityMonitor`, `chords-com.apple.Safari`,
`chords-com.apple.ScreenContinuity`, `chords-com.apple.systempreferences`, and
`chords-com.apple.finder` (formerly `chords-finder`). Terminal's chords live in
`chords-terminal`, alongside other basic terminals; Warp has its own `chords-warp`.
`chords-com.apple` retains the empty app stubs. Enable the individual app packages
when using the current monorepo; Chord's pinned default packages still contain the
combined package.

To install any other package from this repo:

1. Open Settings → Chords → **Chord Monorepos** and use **Add Monorepo** with `KeyChord/chords`.
2. Under **Packages to use**, tick the packages you want. Chord reloads as soon as
   you tick one.

Use **Sync Latest** on the monorepo to update it later. Settings → Browse also
offers one-click **Install** for a few curated packages (`chords-chromium`,
`chords-vscode`, `chords-jetbrains`, `chords-terminal`, `chords-warp`, `chords-aerospace`). Those
install the package's [mirror repository](#repository-mirrors), which can lag behind
this monorepo, so add the monorepo instead when you want the current version.

When two sources provide the same package, local sources win over GitHub ones
(Settings → Chords → Local Folders, a repo's **Link Local Folder**, or a linked local
monorepo). Between GitHub repos, the pinned default `KeyChord/chords-menu` and
`KeyChord/chords-com.apple` repos take precedence over the monorepo's copies, so
remove them under **Chord Repos** if you want the monorepo's versions of those two
packages.

To change one of the default chords (for example `/b`, which opens Safari from
`@keychord/chords-com.apple.Safari` in the current monorepo), override the package that defines it with a local
copy, using **Link Local Folder** on its repo, and edit the chord there. Binding the
same sequence in a different package isn't a reliable override: when two packages
define the same chord, Chord doesn't consistently pick the same one.

## Usage

You can use these Chord Packages as templates for creating your own chords. See [create-chord-package](https://github.com/KeyChord/create-chord-package) and Chord's [scripting.md](https://github.com/KeyChord/Chord/blob/dev/scripting.md) for detailed instructions. When defining your own chords, it's recommended to follow the conventions below.

## Default Global Keys

In the default chord package, these are the categories assigned to the global chords (which must start with a non-alphanumeric character). If you want to define your own custom global chord which doesn't fit into any of the following categories, you should prefer the `,` prefix.

`,` User-Defined Global Chords\
`/` Global General-Purpose/Custom Commands\
`=` Menu / Tray / System Shortcuts\
`.` Mouse / Keyboard (e.g. modifiers)\
`;` Web\
`[`, `]` Global Navigation

> `'` is reserved for pass-through input (can appear anywhere in a chord)\
> `\` is reserved for escape characters (can appear anywhere in a chord)\
> `` ` `` isn't reserved, but is conventionally used for "config" (e.g. ``3`d2,i1`/w]`` waits 200 ms, then runs `/w]` (next window) three times, 100 ms apart)

> [!NOTE]
> This section is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Define global chords and their hints in the package's root `chords/macos.toml`
(for example, `@keychord/chords-betterdisplay/chords/macos.toml`), with any
handlers they use. Keep application-specific alphanumeric chords in nested
application/bundle-ID folders. Package builds reject global chords outside the
root file.

## Conventions

`l` Left\
`r` Right\
`u` Up\
`d` Down

`n` North / New\
`e` East / End\
`s` South / Start\
`w` West

> We typically assign the cardinal directions to distinguish between actions with a "move" equivalent. For example, "move pane left" would typically be assigned `pl` (pane left) while "focus pane left" would be assigned `pw` (pane west).

`t` Top\
`m` Middle\
`c` Center\
`b` Bottom

`f` Front / Forward\
`k` Back / Backward\
`a` First\
`z` Last

`g` Go to\
`q` Quit\
`p` Play\
`h` Halt (i.e. pause)\
`i` In / Inner / Inside\
`o` Out / Outer / Outside

`v` Vary (i.e. toggle, on/off)\
`x` No\
`y` Yes\
`j` Just (filler character for one-word actions, e.g. `sj` = "Search: Just Search")

`[` Previous\
`]` Next\
`-` Decrease\
`=` Increase\
`,` Settings\
`.` Left Click\
`.,` Right Click\
`..` Double Click\
`.;` Middle Click (Rare)\
`/` Search

> [!NOTE]
> This section is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Always single-quote binding keys in TOML `[chords]` tables, even when quotes are
optional (for example, `'fr' = { name = 'Find and Replace' }`). `vp fmt` preserves
these quotes.

In TOML chord keys, only parenthesized sections use regex syntax; all surrounding keys are literal. Write `hs.(\d+)` to match `hs.12` and pass `12` as `$1`. Dots outside parentheses need no backslash; dots inside a regex section still use `\.` when they must match literally. Chord patterns match the complete entered sequence automatically.

## Development

> [!NOTE]
> This section is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

### Setup

You need macOS on Apple Silicon, [Vite+](https://viteplus.dev/) (the global `vp`
CLI, which drives pnpm for this workspace), [Bun](https://bun.sh/) for tests, and a
Swift 6.2+ toolchain (Xcode) to rebuild native add-ons. Chord runs handlers under Bun, so
package tests do too.

Until the updated `@keychord/config` is published, `pnpm-workspace.yaml` links it to a
sibling checkout at `../config`, which has to be built before `vp install` here can
load the package configs:

```sh
git clone https://github.com/KeyChord/config
git clone https://github.com/KeyChord/chords
(cd config && vp install && vp pack)
cd chords && vp install
```

Run `vp pack` in `../config` again after changing the shared config.

- `vp check` runs format, lint and type checks.
- `vp run test` runs every package's Bun tests (`bun test --isolate`);
  `vp run --filter @keychord/chords-click test` runs one package. Don't use
  `vp test`, which runs Vitest under Node.
- `vp pack` in a package directory builds its `js/` output and native add-ons;
  `vp run build` from the root builds every package.

To try a local checkout in Chord, link it under Settings → Chords → **Chord
Monorepos** → Local monorepos and tick the packages you're working on. Reload
with `0,r` after rebuilding.

Chord packages normally use `export default config()` from `@keychord/config` in
`vite.config.ts`. Tests and their fixtures live in each package's `__tests__/`
directory.

All chord packages have a macOS VM smoke test. Run `vp run test:macos:setup`
once, then `vp run test:macos` for the full suite or
`vp run test:macos -- @keychord/chords-click` for one package. Each run uses a fresh
Tart clone of a pinned, prepared macOS image. Shared helpers and fixture apps are
exported by [`@keychord/chordtest`](./@keychord/chordtest/readme.md).

### Version control

This repository uses colocated Jujutsu (`jj`) and Git, following Haniverse's
workflow with `main` as the integration branch. The checked-in `.jj.toml` provides
repository-specific aliases, overriding any global aliases that target `trunk`.

To enable the same setup in a fresh Git checkout:

```sh
jj --config-file .jj.toml git init --colocate
cp .jj.toml "$(jj config path --repo)"
jj bookmark track main --remote origin
```

The config allows new files up to 10 MB, matching Haniverse and accommodating the
native addons and generated bundles committed here. Re-run the `cp` command after
changing `.jj.toml` to update the active local config.

```sh
jj --no-pager status
jj --no-pager diff --git
jj --no-pager log
jj gf                              # fetch without rebasing
jj describe -m "Describe the change"
jj push                            # advance main and push to origin
```

`jj push` selects the latest described, non-empty commit in the current working
copy's ancestry and leaves working files in place. It forwards arguments to
`jj git push`; `jj push --dry-run` previews the remote update but still advances
the local `main` bookmark.

`jj pull` fetches `origin`, resets the local `main` bookmark to `main@origin`, and
rebases current work onto it. Coordinate before running it in a shared checkout.
Describing and pushing the current working copy includes all edits in that
revision, so review them first. Jujutsu does not run Git hooks; run `vp check` and
`vp run test` (Bun tests in every package) before pushing.

A pre-commit hook formats staged JS, TS, TSX, JSON, and TOML files. To enable the
hooks in a fresh Git clone:

```sh
vp config --hooks-dir .vite-hooks
```

### Native add-ons

Packages with a `Package.swift` at their root ship
[NodeSwift](https://github.com/kabiroberai/node-swift) add-ons built from their Swift
sources (usually `Sources/`). `vp pack` in such a package compiles them through
`@keychord/config`, stages them in `target/<triple>/`, and bundles hashed copies with
their runtime libraries under `js/native/`. They can only be compiled on macOS, so
the built files are committed. Mirrors copy all committed files, including JS and
native artifacts, as-is. Build and commit generated handlers before pushing changes
to their source.

With [moon](https://moonrepo.dev/) installed, `moon run ':build-native'` rebuilds
the packages listed in `.moon/workspace.yml`.
Native artifact checks are manual because rebuilding addons can be slow:
`vp run native:check` checks that Swift module names are unique across packages,
rebuilds with moon, and fails if any committed `.node` file's machine code differs
from the rebuild. Commit the rebuilt `target/` and `js/` files when it does.

> Mach-O output is not byte-reproducible -- the linker mints a fresh `LC_UUID`
> each run -- so the check compares disassembled machine code rather than file
> hashes, and every genuine rebuild rewrites the binaries.

### Repository mirrors

The Sync workflow mirrors every directory `@keychord/<name>` to
`https://github.com/KeyChord/<name>`, including private workspace packages such as
`chordtest`. No list or manifest opt-in is required, and `repository.url` does not
control mirroring. Missing repositories are created as public repositories. Not
every package has a mirror at the moment; install those through the monorepo (see
[Installing packages](#installing-packages)).

`KeyChord/chords` is the source of truth. The Sync workflow force-replaces each
mirror's `main` with an independent snapshot of the committed package directory;
mirror-only commits and files are discarded. Uncommitted files, local build
outputs and `node_modules` never enter a snapshot. Committed executable modes
and symlinks are preserved. Replaying the same source produces the same commit.
Tags on the source commit named `<name>-js-v<version>` are force-synced as
`v<version>` even on a repeat run. Older mirror release tags are retained.

Mirrors are read-only distribution repositories: contribute changes here.
The workflow sets their description and homepage to point here and disables
issues, projects, discussions and wikis. It runs on every push to `main`, hourly
to repair drift, and through manual dispatch. Runs are serialized and always
check out the latest `main`. There is no sync from a mirror back into this repo.

The existing `ORG_KEYCHORD_BOT_PAT` Actions secret must have permission to create
public repositories in the KeyChord organization, push (including force pushes)
to all mirrors, and update repository settings. A classic PAT needs `public_repo`
(or `repo`); organization policies must also permit repository creation and force
pushes. Newly created mirrors must be accessible to the same token.

Mirror tooling lives in two private workspace packages under
`packages/dev/improve/chords/configs/mirrors`:

- `@chord/dev.improve.chords.configs.mirrors.list` in `list/` discovers destinations
  and provides the `_list-mirrors` command. Run `vp run mirrors:list` from the
  repository root to inspect destinations.
- `@chord/dev.improve.chords.configs.mirrors.sync` in `sync/` depends on the list
  package and provides the `_sync-mirrors` command. The Sync workflow calls it
  through the root `mirrors:sync` script. With `CI` unset, it creates temporary
  local snapshots without contacting GitHub or changing package directories:

  ```sh
  env -u CI BUILD_BASE="$PWD/@keychord" GITHUB_REF=refs/heads/main GITHUB_SHA=HEAD vp run mirrors:sync
  ```

The workflow is authored in
`packages/dev/improve/chords/configs/mirrors/sync/sync.wac.ts`, using
`github-actions-workflow-ts` as in Haniverse. Run `vp run workflows:build` after
editing it and commit the generated `.github/workflows/sync.yml`. `vp install`
also regenerates workflows through the root postinstall. Do not edit generated
YAML directly; the workflow checks that regeneration leaves it unchanged.

The native artifact checker lives in `packages/dev/improve/chords/configs/native`.
All three tooling packages run TypeScript directly on Node.js 22.18 or newer.
Third-party runtime helpers are accessed through wrappers in
`packages/com/npmjs/`; scoped names use `scope__name` directory names.

A monorepo of all the conventional chord packages.

Chord packages live in `@keychord/`; workspace tooling and third-party wrappers
live in `packages/`.

## Version control

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
`vp test` before pushing.

## Usage

You can re-define these defaults in _Chord_ by simply adding a Chord Package with a new definition for one of these sequences (e.g. if you don't use Safari which is defined as `/b` in these defaults, you can simply a new chord to `/b` and it will be used instead.

You can also use this Chord Package as a template for creating your own chords. See [development.md](./development.md) for detailed instructions. When defining your own chords, it's recommended to follow the conventions below.

## Default Global Keys

Define global chords and their hints in the package's root `chords/macos.toml`
(for example, `@keychord/chords-betterdisplay/chords/macos.toml`), with any
handlers they use. Keep application-specific alphanumeric chords in nested
application/bundle-ID folders. Package builds reject global chords outside the
root file.

In the default chord package, these are the categories assigned to the global chords (which must start with a non-alphanumeric character). If you want to define your own custom global chord which doesn't fit into any of the following categories, you should prefer the `,` prefix.

`,` User-Defined Global Chords\
`/` Global General-Purpose/Custom Commands\
`=` Menu / Tray / System Shortcuts\
`.` Mouse / Keyboard (e.g. modifiers)\
`;` Web\
`[`, `]` Global Navigation

> `'` is reserved for pass-through input (can appear anywhere in a chord)\
> `\` is reserved for escape characters (can appear anywhere in a chord)\
> `` ` `` isn't reserved, but is conventionally used for "config" (e.g. `` 3`d=1`/w] ``)

## Conventions

In TOML chord keys, only parenthesized sections use regex syntax; all surrounding keys are literal. Write `hs.(\d+)` to match `hs.12` and pass `12` as `$1`. Dots outside parentheses need no backslash; dots inside a regex section still use `\.` when they must match literally. Chord patterns match the complete entered sequence automatically.

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

## Native addons

Some packages (`chords-menu`, `chords-web`, `chords-com.apple`)
ship NodeSwift addons built from `src/swift/`. They can only be compiled on
macOS, so the built `.node` files are committed. Mirrors copy all committed
files, including JS and native artifacts, as-is. Build and commit generated
handlers before pushing changes to their source.

A pre-commit hook formats staged JS, TS, TSX, and JSON files. Native artifact
checks are manual because rebuilding addons can be slow. To enable the hooks
in a fresh clone:

```sh
vp config --hooks-dir .vite-hooks
```

Rebuild the artifacts yourself with `moon run ':build-native'`, then
`git add @keychord/*/target`.

To check native artifacts manually, run `vp run native:check`.

> Mach-O output is not byte-reproducible -- the linker mints a fresh `LC_UUID`
> each run -- so the check compares disassembled machine code rather than file
> hashes, and every genuine rebuild rewrites the binaries.

## Repository mirrors

Every directory `@keychord/<name>` automatically mirrors to
`https://github.com/KeyChord/<name>`, including private workspace packages such as
`chordtest`. No list or manifest opt-in is required, and `repository.url` does not
control mirroring. Missing repositories are created as public repositories.

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

Tests and their fixtures live in each package's `__tests__/` directory.

Chord packages normally use `export default config()` from `@keychord/config` in
`vite.config.ts`. This includes the shared Chord test runtime automatically.
Until the updated config and test runtime are published, the root
`pnpm-workspace.yaml` links `@keychord/config` to `../config`, whose workspace
override links back to the local `@keychord/chordtest` package. Run `vp install`
in both workspaces and `vp pack` in `../config` after changing the shared config.

All chord packages have a macOS VM smoke test. Run `vp run test:macos:setup`
once, then `vp run test:macos` for the full suite or
`vp run test:macos -- @keychord/chords-click` for one package. Each run uses a fresh
Tart clone of a pinned, prepared macOS image. Shared helpers and fixture apps are
exported by [`@keychord/chordtest`](./@keychord/chordtest/readme.md).

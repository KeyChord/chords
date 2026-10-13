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

In the default chord package, these are the categories assigned to the global chords (which must start with a non-alphanumeric character). If you want to define your own custom global chord which doesn't fit into any of the following categories, it's recommended to use one of the remaining symbols (`` ` ``, `[`, `]`, but NOT `'` or `\` since they're reserved).

`,` Free
`/` Global General-Purpose/Custom Commands\
`-` Menu Bar/Menus\
`=` Tray / System Shortcuts\
`.` Click\
`;` Web

> `'` is reserved for pass-through input\
> `\` is reserved for escape characters

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
`,` Settings / Left Click\
`.` Right Click\
`;` Middle Click (Rare)\
`/` Search

## Native addons

Some packages (`chords-menu`, `chords-web`, `chords-tray`, `chords-com.apple`)
ship NodeSwift addons built from `src/swift/`. They can only be compiled on
macOS, so the built `.node` files are committed and CI syncs them to the
mirrors as-is; CI builds the JS only, via `CHORD_SKIP_NATIVE=1`.

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

Each `@keychord/*/package.json` declares its mirror destination using
`repository.url`:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/KeyChord/chords-menu"
  }
}
```

The Sync workflow discovers these manifests and mirrors each package directory
to its declared GitHub repository. URLs may end in `.git`. Packages without
`repository.url` are skipped; invalid URLs fail the sync. Adding a package only
requires setting its URL, with no separate mirror list to maintain.

Mirror tooling lives in two private workspace packages under
`packages/dev/improve/chords/configs/mirrors`:

- `@chord/dev.improve.chords.configs.mirrors.list` in `list/` discovers destinations
  and provides the `_list-mirrors` command. Run `vp run mirrors:list` from the
  repository root to inspect destinations.
- `@chord/dev.improve.chords.configs.mirrors.sync` in `sync/` depends on the list
  package and provides the `_sync-mirrors` command. The Sync workflow calls it
  through the root `mirrors:sync` script.

The native artifact checker lives in `packages/dev/improve/chords/configs/native`.
All three tooling packages run TypeScript directly on Node.js 22.18 or newer.
Third-party runtime helpers are accessed through wrappers in
`packages/com/npmjs/`; scoped names use `scope__name` directory names.

Tests and their fixtures live in each package's `__tests__/` directory.

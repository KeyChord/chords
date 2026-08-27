A monorepo of all the conventional chord packages.

## Usage

You can re-define these defaults in _Chord_ by simply adding a Chord Package with a new definition for one of these sequences (e.g. if you don't use Safari which is defined as `/b` in these defaults, you can simply a new chord to `/b` and it will be used instead.

You can also use this Chord Package as a template for creating your own chords. See [development.md](./development.md) for detailed instructions. When defining your own chords, it's recommended to follow the conventions below.

## Default Global Keys

In the default chord package, these are the categories assigned to the global chords (which must start with a non-alphanumeric character). If you want to define your own custom global chord which doesn't fit into any of the following categories, it's recommended to use one of the remaining symbols (`` ` ``, `[`, `]`, but NOT `'` or `\` since they're reserved).

`,` Universal Commands (`,<key>` maps to `cmd+<key>`)\
`/` Global Shortcuts / Applications\
`-` Menu Bar\
`=` Tray / System Shortcuts\
`.` Dock / Window Management\
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

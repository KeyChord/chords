# @keychord/chords-com.apple

Chord package for pre-installed macOS apps.

## Apps

- [Finder](./chords/com/apple/finder/macos.toml) (`com.apple.finder`)
- [Safari](./chords/com/apple/safari/macos.toml) (`com.apple.safari`)
- [Terminal](./chords/com/apple/Terminal/macos.toml) (`com.apple.Terminal`)
- [Activity Monitor](./chords/com/apple/ActivityMonitor/macos.toml) (`com.apple.ActivityMonitor`)

## Usage

You can re-define these defaults in _Chord_ by simply adding a Chord Package with a new definition for one of these sequences (e.g. if you don't use Safari which is defined as `/b` in these defaults, you can simply a new chord to `/b` and it will be used instead.

You can also use this Chord Package as a template for creating your own chords. See [development.md](./development.md) for detailed instructions. When defining your own chords, it's recommended to follow the conventions below.

## Default Global Keys

In the default chord package, these are the categories assigned to the global chords (which must start with a non-alphanumeric character). If you want to define your own custom global chord which doesn't fit into any of the following categories, it's recommended to use one of the remaining symbols (`` ` ``, `[`, `]`, `;`, but NOT `'` since it's reserved).

`,` Universal Commands (`,<key>` maps to `cmd+<key>`)\
`\` System Shortcuts\
`/` Global Shortcuts / Applications\
`-` Menu Bar\
`=` Tray\
`.` Dock / Window Management

> `'` is reserved for pass-through input during Chord Sentences.

## Conventions

`l` Left\
`r` Right\
`u` Up\
`d` Down

`n` North / New\
`e` East / End\
`s` South / Start\
`w` West / Forward

> We typically assign the cardinal directions to distinguish between actions with a "move" equivalent. For example, "move pane left" would typically be assigned `pl` (pane left) while "focus pane left" would be assigned `pw` (pane west).

`t` Top\
`m` Middle\
`c` Center\
`b` Bottom

`f` Front\
`k` Back\
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

## Menu

The built-in menu navigation chord handler uses the prefix `-` and is dynamic based on what you type afterwards:

### `\d+`

Typing a number `n` will click the `n`th menu in the menu bar of the currently focused application.

### `([a-z])\1`

Typing a sequence of repeating letters will match the `.length`-th menu that starts with that letter. For example, given the following menu bar:

```
File | Edit | View | History | Window | Help
```

Typing `-h` will match History, but typing `-hh` will match Help.

### `[a-z-]+\d+?`

Typing a sequence of non-repeating letters optionally followed by a number `n` will match the `n`th menu _item_ (`1st` if unspecified) that starts with those letters. Only works when a menu is expanded. A `-` may be used to match "spaces" so you can match by abbreviation instead of prefix.

For example, given the following menu items:

```
Zoom in
Zoom out
```

Typing `z` or `zo` will match Zoom In, but typing `z-o` or `z2` will match Zoom Out.

## Tray

The built-in tray chord handler uses the prefix `=` and is dynamic based on what you type afterwards:

### `\d+`

Typing a number `n` will left click the `n`th tray item. Typing `0` will click the Notch area.

### `\d+/`

Typing a number `n` followed by a `/` will right click the `n`th tray item. Typing `0` will right click the Notch area.

### `-\d+`

Typing a negative number `n` will left click the `n`th item from the end of the tray. For example, `-1` will always click the last tray item.

### `-\d+/`

Typing a negative number `n` followed by a `/` will right click the `n`th item from the end of the tray.

### `b/?`

Clicks the battery tray item. `/` for right click.

### `w/?`

Clicks the Wi-Fi tray item. `/` for right click.

### `c/?`

Clicks the Control Center tray item. `/` for right click.

### `t/?`

Clicks the Time & Date tray item. `/` for right click.

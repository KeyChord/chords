# @keychord/chords-modifiers

Execute modifier shortcuts using `.` followed by one modifier letter, one regular
key, and optional additional modifier letters:

```text
.mv         Command+V
.mvs        Command+Shift+V
.mcsa       Command+Shift+Alt+C
.mcas       Command+Shift+Alt+C
.ms         Command+S
.a[         Alt+[
```

Modifier letters are `a` (Alt/Option), `c` (Control), `f` (Fn), `m` (Meta/Command),
and `s` (Shift). The first modifier determines the entry point; the next character
is always the regular key, even when it is also a modifier letter. Additional
modifiers can follow in any order, and repeated modifiers are applied only once.
All 31 nonempty modifier combinations are supported from any included modifier's
entry point. No separator is needed: `.m-` sends Command+Minus.

This replaces the former modifier-first `-` syntax. Use separate chords for
separate shortcuts, such as `.mc` for Command+C and `.mv` for Command+V.

The sequence runs when you execute the chord. The native `chord.tap` helper presses
and releases each shortcut, including its modifiers. Unmodified-key chords are
omitted. Click sequences use the separate `.b`, `.t`, `.l`, and `.r` entry points
provided by `@keychord/chords-click`.

Run `vp test @keychord/chords-modifiers` from the workspace root. Run
`vp run test:macos -- @keychord/chords-modifiers` to verify the production package
loads in the isolated macOS VM.

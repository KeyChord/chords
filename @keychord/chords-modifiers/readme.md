# @keychord/chords-modifiers

Execute modifier shortcuts using `.` followed by modifier letters, `-`, and the
regular keys to send. Each regular key becomes a separate shortcut with the same
modifiers, in order:

```text
.m-cv       Command+C, then Command+V
.cms-cv     Control+Command+Shift+C, then Control+Command+Shift+V
.a-[]       Alt+[, then Alt+]
```

Modifier letters are `a` (Alt/Option), `c` (Control), `f` (Fn), `m` (Meta/Command),
and `s` (Shift). Put modifiers in that order, as in the former `chords-commands`
package. The first modifier determines the entry point; all 31 nonempty modifier
combinations are supported. `-` separates modifiers from regular keys; later `-`
characters are literal minus keys. An empty suffix taps only the selected modifiers.

The sequence runs when you execute the chord. The native `chord.tap` helper presses
and releases each shortcut, including its modifiers. Unmodified-key chords are
omitted. Click sequences use the separate `.b`, `.t`, `.l`, and `.r` entry points
provided by `@keychord/chords-click`.

Run `vp test @keychord/chords-modifiers` from the workspace root. Run
`vp run test:macos -- @keychord/chords-modifiers` to verify the production package
loads in the isolated macOS VM.

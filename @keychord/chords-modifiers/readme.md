# @keychord/chords-modifiers

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Global chords that press a keyboard shortcut in whichever app is focused. To install, in
[Chord](https://github.com/KeyChord/Chord) open Settings → Chords → **Chord Monorepos** →
**Add Monorepo**, enter `KeyChord/chords`, then tick `@keychord/chords-modifiers` under
**Packages to use**.

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

Each chord sends one shortcut. Use separate chords for separate shortcuts, such as
`.mc` for Command+C and `.mv` for Command+V.

The sequence runs when you execute the chord. The native `chord.tap` helper presses
and releases each shortcut, including its modifiers. Unmodified-key chords are
omitted. The other `.` chords (digits and `.`, `,`, `;`, `-`, `=`, `/` after the dot) are
mouse clicks, drags and moves provided by
[`@keychord/chords-click`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-click).

Run the unit tests with `vp run test` (`bun test --isolate`) in this directory. Run
`vp run test:macos -- @keychord/chords-modifiers` from the monorepo root to verify the
production package loads in the isolated macOS VM.

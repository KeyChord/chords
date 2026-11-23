# @keychord/chords-modifiers

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Global chords that press a keyboard shortcut in whichever app is focused. To install, in
[Chord](https://github.com/KeyChord/Chord) open Settings → Chords → **Chord Monorepos** →
**Add Monorepo**, enter `KeyChord/chords`, then tick `@keychord/chords-modifiers` under
**Packages to use**.

Every chord starts with the package's `<>` prefix, `;k` by default. To reach them with fewer
keys, choose another prefix under Settings → Chords → **Placeholders**. The examples
below use the default.

Execute modifier shortcuts using `;k` followed by one modifier letter, one regular
key, and optional additional modifier letters:

```text
;kmv         Command+V
;kmvs        Command+Shift+V
;kmcsa       Command+Shift+Alt+C
;kmcas       Command+Shift+Alt+C
;kms         Command+S
;ka[         Alt+[
```

Modifier letters are `a` (Alt/Option), `c` (Control), `m` (Meta), and `s` (Shift).
Meta sends Command on macOS, Super on Linux, and the Windows key on Windows.
macOS also supports `f` (Fn). The first modifier determines the entry point. The
next character is always the regular key, even when it is also a modifier letter.
Additional modifiers can follow in any order, and repeated modifiers are applied
only once. For example, `;km-` sends Meta+Minus.

Each chord sends one shortcut. Use separate chords for separate shortcuts, such as
`;kmc` for Command+C and `;kmv` for Command+V.

The sequence runs when you execute the chord. The native `chord.tap` helper presses
and releases each shortcut, including its modifiers. Unmodified-key chords are
omitted. Mouse chords are available under `;c` in `@keychord/chords-click`.

Run the unit tests with `vp run test` (`bun test --isolate`) in this directory. Run
`vp run test:macos -- @keychord/chords-modifiers` from the monorepo root to verify the
production package loads in the isolated macOS VM.

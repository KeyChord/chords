# @keychord/chords-com.apple.finder

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Chord package for Finder, GNOME Files, and Windows File Explorer. To install it, add the
`KeyChord/chords` monorepo under Settings → Chords → Chord Monorepos and tick
`@keychord/chords-com.apple.finder`.

## macOS

The global chord `/f` opens Finder. While Finder or a file open/save dialog is
focused, the
[Finder chords](./chords/com/apple/finder/macos.toml) use `g` for navigation, `d`
for directories, `f` for files, `a` for view modes, `s` for sorting, `c` for
cleanup, and `t` for toggles and emptying the Trash. Most of them send Finder's own
keyboard shortcuts.

## Linux X11 and Windows

With Chord 0.3.4 or later, `/f` opens the platform file manager. Linux requires GNOME
Files (Nautilus) and `gtk-launch`. Windows targets File Explorer's window classes.

While the file manager is focused, `g` navigates and searches, `d` works with folders,
`f` works with files and selection, `a` changes the view, and `t` controls tabs.
The tab shortcuts in File Explorer require Windows 11. These bindings use the file
manager's default keyboard shortcuts, so the effect depends on which control has focus.

- [GNOME Files shortcut definitions](https://github.com/GNOME/nautilus/blob/main/src/nautilus-window-slot.c)
- [Windows File Explorer keyboard shortcuts](https://support.microsoft.com/en-us/accessibility/windows/keyboard-shortcuts-in-windows#bkmk_fileexplorer)

Build with `vp pack` in this directory. Run the package smoke test from the
monorepo root with `vp run test:macos -- @keychord/chords-com.apple.finder`.

# @keychord/chords-dock

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Chord package for the macOS Dock, GNOME Dash, and Windows taskbar. To install it, add the `KeyChord/chords` monorepo
under Settings → Chords → Chord Monorepos and tick `@keychord/chords-dock`.

Every chord starts with the package's `<>` prefix. The default is `;d` on macOS and `;t` on Linux and Windows. To reach them with fewer
keys, choose another prefix under Settings → Chords → **Placeholders**. The examples
below use the default.

## macOS

| Chord          | Result                                       |
| -------------- | -------------------------------------------- |
| `;dv`          | Move keyboard focus to the Dock (Control-F3) |
| `;dw]`         | Focus the next app                           |
| `;dw[`         | Focus the previous app                       |
| `;d<number>`   | Focus the numbered Dock item                 |
| `;d.<number>.` | Open the numbered Dock item                  |
| `;d.,<number>` | Show the item's context menu                 |

`;dv` uses macOS's Control-F3 shortcut. Enable "Move focus to the Dock" under
System Settings → Keyboard → Keyboard Shortcuts → Keyboard. Numbered chords
use Accessibility and start at the first Dock item.

`;dw]` and `;dw[` cycle through running Dock applications in both directions,
wrapping around. They use native macOS application activation independently of
the Command-Tab shortcut, including hidden apps and apps on other Spaces. The
initial order comes from window stacking, followed by apps without windows;
subsequent app activations update the recent-app order. Repeated chord switches
retain a stable cycle so every app remains reachable. Background helpers are skipped.

Window commands (including `;bwh`, `;bwm` and `;bwq`) live in `@keychord/chords-menu` and
[`@keychord/chords-windows`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-windows),
monitor focusing in
[`@keychord/chords-monitors`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-monitors),
and Space navigation in
[`@keychord/chords-spaces`](https://github.com/KeyChord/chords/tree/main/@keychord/chords-spaces).

## Linux X11 and Windows

The Linux bindings use GNOME Shell's default keyboard shortcuts. The Windows bindings use the
standard taskbar shortcuts on Windows 10 and 11. Pin apps to the GNOME Dash or Windows taskbar in
the order you want the numbered chords to use. The shortcuts follow any changes to that order.

| Chord                 | GNOME X11                                              | Windows                                                   |
| --------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| `;tv`                 | Open Activities with the Dash                          | Focus the taskbar                                         |
| `;tw[` / `;tw]`       | Switch to the previous or next app in GNOME's switcher | Move focus to the previous or next taskbar item           |
| `;t1` through `;t9`   | Open or switch to the numbered favorite                | Open or switch to the app in that taskbar position        |
| `;tn1` through `;tn9` | Open a new window of the numbered favorite             | Open another instance of the app in that taskbar position |
| `;tj1` through `;tj9` |                                                        | Open the app's Jump List                                  |

On Windows, use `0` for the tenth position, for example `;tj0`. The Linux app switcher and
Windows taskbar use their desktop's own item order.

[GNOME Shell's shortcut defaults](https://github.com/GNOME/gnome-shell/blob/main/data/org.gnome.shell.gschema.xml.in)
[Windows taskbar shortcut reference](https://support.microsoft.com/en-us/accessibility/windows/keyboard-shortcuts-in-windows#bkmk_taskbar)

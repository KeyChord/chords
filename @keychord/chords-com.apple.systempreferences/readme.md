# @keychord/chords-com.apple.systempreferences

Open system settings panels on macOS, GNOME on Linux, and Windows. Install through
the `KeyChord/chords` monorepo and enable this package under Settings → Chords.

[App bindings](./chords/com/apple/systempreferences/macos.toml) and [global bindings](./chords/macos.toml).

Build with `vp pack`. Run `vp run test` for Bun tests or
`vp run test:macos -- @keychord/chords-com.apple.systempreferences` from the monorepo root for VM tests.

The `g` chords open their named settings panes directly using macOS's
`x-apple.systempreferences` URLs, including the iCloud scene. Some panes require
compatible hardware or an Apple Account.

`apa`, `apd`, and `apl` apply Auto, Dark, and Light system appearance respectively.
The Bun handler calls SkyLight in-process and disables automatic switching when
selecting Light or Dark. These private macOS APIs are resolved before applying a
change; an unavailable API reports an error.

## GNOME and Windows

On Chord 0.3.4 or newer, `/,` opens GNOME Settings on Linux X11 or Windows Settings.
The prefix can be changed in the package's settings. With Settings focused, use
`g` to browse the available destinations, or enter a chord such as `gdi` for Display,
`gso` for Sound, or `gwi` for Wi-Fi.

- [GNOME bindings](./chords/org/gnome/Settings/linux.toml) require
  `gnome-control-center` on PATH in a GNOME session. Panels depend on the installed
  GNOME version and hardware. [GNOME panel reference](https://github.com/GNOME/gnome-control-center/blob/main/man/gnome-control-center.xml)
- [Windows bindings](./chords/com/microsoft/WindowsSettings/windows.toml)
  use Windows 10 and 11 Settings URIs. Available pages depend on the Windows version,
  hardware, and policy. [Microsoft Settings URI reference](https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-settings)

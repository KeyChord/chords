# @keychord/chords-com.apple.screencaptureui

> [!WARNING]
> **EXPERIMENTAL**
>
> This package was largely created with AI and will be reviewed by a human later.

Chords for Screenshot (`com.apple.screencaptureui`) while editing a captured screenshot in Markup. Install through the
`KeyChord/chords` monorepo and enable this package under Settings → Chords.

[macOS app bindings](./chords/com/apple/screencaptureui/macos.toml)

[Windows app bindings](./chords/com/microsoft/SnippingTool/windows.toml) use `fs` to
save and `fc` to copy a captured snip in the Snipping Tool editor (`SnippingTool.exe`).
Copy leaves the editor open. [Snipping Tool keyboard shortcuts](https://support.microsoft.com/en-us/windows/apps/use-snipping-tool-to-capture-screenshots)

On GNOME, the screenshot tool saves each capture in `Pictures/Screenshots` and
copies it to the clipboard automatically. Open the screenshot tool with `Print Screen`.
[GNOME screenshot documentation](https://help.gnome.org/gnome-help/screen-shot-record.html)

Build with `vp pack`. Run `vp run test` for Bun tests or
`vp run test:macos -- @keychord/chords-com.apple.screencaptureui` from the monorepo root for VM tests.

# @keychord/chords-whatsapp

Chord package for the native macOS WhatsApp app (`net.whatsapp.WhatsApp`), moved
from [leonsilicon/chords](https://github.com/leonsilicon/chords).

Includes the existing chat, chat switching, view, call, input, and zoom chords.
Menu actions use the vendored `@keychord/chords-menu` handler and native addon.
The build copies them to `js/menu.js` and `target/` so this package can itself be
vendored by another chord package.
The `cb` chord opens the Chat menu and selects its enabled `Block…` item by
prefix, allowing the contact name in the title to vary. Menu titles are English.

Build from this directory with `vp pack`.

# @keychord/chords-whatsapp

Chord package for the native macOS WhatsApp app (`net.whatsapp.WhatsApp`), moved
from [leonsilicon/chords](https://github.com/leonsilicon/chords).

Includes all 79 chat, Contact Info, theme, chat switching, view, call, input,
and zoom bindings. All chords call `src/js/whatsapp.ts`, backed by the Swift addon in
`Sources/KeychordChordsWhatsAppNativeWhatsapp`. Each action targets
`net.whatsapp.WhatsApp`, launching and bringing it forward before acting. Actions
run in order; a failed action does not prevent subsequent chords from working.

Menu actions press WhatsApp's accessibility identifiers rather than sending
keyboard shortcuts. This handles changing titles such as Pin/Unpin and
Contact Info/Group Info. Archived and Starred use sidebar identifiers instead
of version-dependent numbered view shortcuts. GIF and Sticker target distinct
menu items. Missing, disabled, or ambiguous controls report an error.

Controls without an accessibility press action use Chord's window-targeted click
API, with the element's accessibility bounds and a fresh matching app window.
If the window moves or cannot be matched uniquely, the action fails.

Numbered chat switching presses the numbered loaded row in the main chat list.
Scroll the desired rows into view first; filter and archive controls do not
count as chats. Mute opens Chat Info and presses its Mute button. Profile opens
Settings and presses the profile cell. No action sends keyboard shortcuts.
Contact Info child chords open the necessary parent pages, including when a
prefix chord has already opened Info, Theme, Bubble, or Wallpaper. `citb0`
opens the bubble reset menu. `citb23` / `citb2,3` and `citw23` / `citw2,3`
select row 2, column 3 in the respective palette. Rows and columns start at 1
and follow the current accessibility layout. Out-of-range positions fail.

Most menu and sidebar actions use IDs. Contact Info rows, theme navigation,
palette descriptions, and the dynamic `Block…` menu item use English labels.
Save to Downloads opens its “More options” menu. Child chords open or invoke
their named control; any confirmation or further selection belongs to WhatsApp.

Requires macOS 14+ and Chord's Accessibility permission. Control identifiers
were inspected in WhatsApp 26.38.74. Chat actions still require a selected chat,
and call controls require an active call; bringing WhatsApp forward does not
make unavailable actions valid. Ambiguous controls across multiple windows fail.
Contact Info rows must be exposed in the accessibility tree; scroll them into
view if needed. Advanced chat privacy, Encryption, and Contact details were not
present in the inspected chat on that version; those bindings report unavailable
unless the corresponding control exists in the current context/version.

Build from this directory with `vp pack`. Run `vp test` for handler tests and
`vp run test:macos -- @keychord/chords-whatsapp` from the workspace root for
native checks in the disposable macOS VM.
The native suite exercises every binding against an AppKit fixture through the
production addon and Chord host, including a covering app, UI text clicks,
palette geometry, toggle states, nested navigation, and unavailable controls.
It does not place calls or modify real chats.

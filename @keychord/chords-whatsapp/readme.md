# @keychord/chords-whatsapp

Chord package for the native macOS WhatsApp app (`net.whatsapp.WhatsApp`), moved
from [leonsilicon/chords](https://github.com/leonsilicon/chords).

Includes chat, Info, groups, themes, chat switching, views, calls, settings,
and zoom bindings. The Input bindings are commented out to leave `i` for Info.
All active chords call `src/js/whatsapp.ts`, backed by the Swift addon in
`Sources/KeychordChordsWhatsAppNativeWhatsapp`. Each action targets
`net.whatsapp.WhatsApp`, launching and bringing it forward before acting. Actions
run in order; a failed action does not prevent subsequent chords from working.

Menu actions press WhatsApp's accessibility identifiers rather than sending
keyboard shortcuts. This handles changing titles such as Pin/Unpin and
Contact Info/Group Info. Archived and Starred use sidebar identifiers instead
of version-dependent numbered view shortcuts. Missing, disabled, or ambiguous
controls report an error.

Controls without an accessibility press action use Chord's window-targeted click
API, with the element's accessibility bounds and a fresh matching app window.
If the window moves or cannot be matched uniquely, the action fails.

`co` opens the current chat in a separate window through its toolbar's More
menu. The menu item has a dynamic identifier, so it uses the English label
“Open in new window”. A chat must already be open.

Voice call controls use `vv` for video/camera toggle, `vm` for mic toggle,
`vr` for the reaction tray, `vs` for screenshare, `va` to add people,
`vc` for the chat toggle, `vx` to end the call, and `vy` to accept an incoming call.
`vv2`, `vm2`, and `vs2`
select the second camera, microphone, and speaker in the device menus;
`vr12` sends the twelfth reaction, and the following position opens the custom
reaction picker. Choices start at 1 and follow accessibility
order within each section/tray. The reaction tray is reused when already open;
switching device menus dismisses the previous device popover first. Add people
and screenshare open WhatsApp's own picker for further selection.

`c(\d+)` switches to any positive numbered loaded row in the main chat list,
including positions beyond 9 (for example, `c12`). `ci` and `gi` open the current
chat's Info. `ci12` selects chat 12, then opens its Info. Numbering starts at 1.
Scroll the desired rows into view first; filter and archive controls do not
count as chats. Mute opens Chat Info and presses its Mute button. Profile opens
Settings and presses the profile cell. No action sends keyboard shortcuts.
Contact Info child chords open the necessary parent pages, including when a
prefix chord has already opened Info, Theme, Bubble, or Wallpaper. `itb0`
opens the bubble reset menu. `itb23` / `itb2,3` and `itw23` / `itw2,3`
select row 2, column 3 in the respective palette. Rows and columns start at 1
and follow the current accessibility layout. Out-of-range positions fail.

`cgc` opens New group. `cgc.12` toggles the twelfth loaded member row, counting
each contact once and excluding headings and selected-contact chips. It reuses
an open picker. The global `]]` presses Next and `[[` presses Back from group setup.

Navigation belongs to [@keychord/chords-navigation](../chords-navigation/readme.md):
`[[` goes back or dismisses, `]]` continues, `[x` closes a dialog completely, and
`]12` selects its twelfth visible option. These global bindings work in the group
picker and wallpaper preview, replacing the WhatsApp-only `g[` / `g]` and
`cgc[` / `cgc]` bindings.

The `ig` children operate on Group Info: `iga` adds members, `igd` edits the
description, `igm` jumps to members, `igmc` opens member changes, `ige` opens
Exit, `igr` opens Report, `igcs` creates a similar group, `igp` opens permissions,
`ign` opens Notify for, and `igq` opens the invite link/QR page. The contact's
“Add to group” action uses `igat`, keeping it distinct from `iga`.

`gca`, `gcu`, `gcf`, and `gcg` select All, Unread, Favourites, and Groups in the
chat list. `gs`, `ga`, `gm`, and `gms` open Communities, Meta AI, Media, and
Starred. The `p` children open their named Settings destination; group and
settings rows scroll into view automatically when necessary.

Append a positive chat number to `gc`, `gch`, `gca`, `gcu`, `gcf`, or `gcg`
to open that position after selecting its view. For example, `gcg1` opens the
first group, `gch2` opens the second archived chat, and `gcu12` opens the twelfth
unread chat. Numbering starts at 1 within the selected list, excluding filter
and archive controls. The row must be loaded; unavailable positions report an error.

`ib` opens the contact's Block dialog and presses **Block**. `ibr` presses
**Block and report** in that dialog, including when it is already open.
`iu` presses Unblock and confirms a follow-up Unblock dialog if one appears.
These bindings perform the named action, including report submission for `ibr`.

Most menu and sidebar actions use IDs. Contact Info rows, theme navigation,
palette descriptions, and the dynamic `Block…` menu item use English labels.
Save to Downloads opens its “More options” menu. Child chords open or invoke
their named control; confirmations and further selection use WhatsApp's UI,
with `ib`, `ibr`, `iu`, and global `]]` able to invoke their confirmation buttons.

Requires macOS 14+ and Chord's Accessibility permission. Control identifiers
were inspected in WhatsApp 26.38.74. Chat actions still require a selected chat,
and call controls require an active call; bringing WhatsApp forward does not
make unavailable actions valid. Ambiguous controls across multiple windows fail.
WhatsApp can display rows that it omits from its accessibility tree, including
Group permissions, Advanced chat privacy, and Encryption. `igp` first targets the
accessible permissions button. When it is missing, it locates the next row after
Disappearing messages using the current Mute/Notify row spacing, within the
Group Info section above Create a similar group. It checks the layout, uses a
window-targeted click, and verifies the Group permissions heading afterward.
An unexpected layout or destination reports an error. Other Info rows currently
require an accessible control; scroll them into view if needed. Contact details
also depends on the selected contact and app version.

Build from this directory with `vp pack`. Run `vp run test` for handler tests and
`vp run test:macos -- @keychord/chords-whatsapp` from the workspace root for
native checks in the disposable macOS VM.
To check global navigation against WhatsApp's dialogs, select
`@keychord/chords-navigation` with `test:macos`.
The native suite exercises every binding against an AppKit fixture through the
production addon and Chord host, including a covering app, UI text clicks,
palette geometry, toggle states, nested navigation, numbered chat info, group
member selection, scrolling, dialog navigation and defaults, Block/Report/Unblock
confirmations, and unavailable controls. It does not place calls, modify real
chats, or submit real reports.

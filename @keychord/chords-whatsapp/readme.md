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
keyboard shortcuts; only `co` and numbered filter positions use WhatsApp's
shortcuts (see below). This handles changing titles such as Pin/Unpin and
Contact Info/Group Info. Archived and Starred use sidebar identifiers instead
of version-dependent numbered view shortcuts. Missing, disabled, or ambiguous
controls report an error.

Controls without an accessibility press action use Chord's window-targeted click
API, with the element's accessibility bounds and a fresh matching app window.
If the window moves or cannot be matched uniquely, the action fails.

`co` opens the current chat in a separate window with WhatsApp's “Open in new
window” shortcut (⌥⌘O), posted to WhatsApp's process rather than the focused
app. WhatsApp 26.38.74 has no menu bar item for it, and the toolbar's More menu
that offers it is hidden while the chat's search bar is open. A chat must
already be open; otherwise WhatsApp ignores the shortcut.

`c/` and `i/` open the chat's search bar and return once its field has focus.
Chat › Search Chat opens the bar with the field focused; it toggles, so it is not
pressed when the bar is already open. Info is modal and disables that menu, so
with Info open they press Info's own Search button, which closes Info and focuses
the field once Info has animated away. Closing Info can hand focus back to the
composer, so if focus lands on another control the field is pressed again. While
the bar is opening or Info is closing, focus on the window only means WhatsApp
has not finished. When the bar is already open and focus is elsewhere, even on
the window, nothing is transitioning, so the field is focused at once.

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

Chat list and view chords act in WhatsApp's main window:

- `c12`, `ci12`, `c[`, `c]`
- `gc`, `gch`, `gca`, `gcu`, `gcf`, `gcg` and their numbered forms
- `gu`, `gp`, `gs`, `ga`, `gm`, `gms`

With a chat open in its own window in front, they first press WhatsApp's open
main window command and wait until accessibility reports a window other than a
chat window as focused. A chat window's content root has the identifier
`Chat_Window`. They then act, so a row press or chat shortcut never races the
window switch.

`c(\d+)` switches to any positive numbered loaded row in the main chat list,
including positions beyond 9 (for example, `c12`). `ci` and `gi` open the current
chat's Info. `ci12` selects chat 12, then opens its Info. Numbering starts at 1.
Scroll the desired rows into view first; filter and archive controls do not
count as chats. Mute opens Chat Info and presses its Mute button. Profile opens
Settings and presses the profile cell.
Contact Info child chords open the necessary parent pages, including when a
prefix chord has already opened Info, Theme, Bubble, or Wallpaper. Info rows
work wherever Info is scrolled: WhatsApp exposes only on-screen rows, so the
action moves to the top and then pages down until the row appears. It then
scrolls the control fully into view and checks that a tap at its activation
point reaches it before pressing, since WhatsApp ignores presses on off-screen
or covered controls. `itb0`
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

`igm.12` presses the twelfth member in Group Info to show its options, paging
the member list as needed. Members are numbered in displayed order starting
with You (`igm.1`, which has no options and reports an error). The Add members,
Invite via link and View all rows are not counted. Only members that Group Info
lists can be selected; a position past them reports an error. `igm.N` closes
another member's open options first. In the open options, `igmi` presses Info,
`igma` presses Make group admin (or Dismiss as admin), and `igmr` presses Remove
from group and then confirms **Remove**. `igmr12` does all of this for the
twelfth member: it selects the member as `igm.12` does, then removes them and
confirms. It is numbered and checked in the same way, so `igmr1` (You) and
positions past the listed members report an error without removing anyone.

`gca`, `gcu`, `gcf`, and `gcg` select All, Unread, Favourites, and Groups in the
chat list and wait until WhatsApp shows the filter as selected. An already
selected filter is left alone, since pressing its chip again deselects it. A
chip partly under the sidebar is clicked where it is uncovered. WhatsApp ignores
a filter pressed while its list is still reloading from the previous one; that
reports an error. `gs`, `ga`, `gm`, and `gms` open Communities, Meta AI, Media, and
Starred. The `p` children open their named Settings destination; group and
settings rows scroll into view automatically when necessary.

Append a positive chat number to `gc`, `gch`, `gca`, `gcu`, `gcf`, or `gcg`
to open that position after selecting its view. For example, `gcg1` opens the
first group, `gch2` opens the second archived chat, and `gcu12` opens the twelfth
unread chat. Numbering starts at 1 within the selected list, excluding filter
and archive controls. For `gc` and `gch` the row must be loaded; unavailable
positions report an error.

`gca`, `gcu`, `gcf`, and `gcg` positions open through WhatsApp's own chat
shortcuts instead of the list's rows: ⌘1–⌘9 (“Select recent chats”) for the
first nine, then Next Chat (⇧⌘]) for each further position. WhatsApp applies a
filter about 75 ms after its chip is pressed and exposes the new rows only after
layout, and it ignores row taps while the filter's reload animates. The
shortcuts select from WhatsApp's filtered list itself, so they are sent once
the chip shows as selected, which WhatsApp sets in the same step that switches
the list. The keys are posted to WhatsApp's process, never to the focused app.
Positions need not be on screen. When the whole list fits on screen, a
position past its end reports an error; otherwise WhatsApp ignores it. Under
All, WhatsApp can show a Channels row among the chats: ⌘1–⌘9 count it (and open
Channels on it), while Next Chat skips it. ⌘1–⌘9 depend on a WhatsApp server
setting that was enabled in 26.38.74; without it, these positions do nothing.
Unread can switch its list one main-queue turn after the chip, so its positions
rely on WhatsApp handling that turn before the shortcut.

Chat › Block _name_ and Chat › Unblock _name_ are one toggle that acts on the
contact's current state, whichever title it shows: for a blocked contact it
unblocks at once, without a confirmation, and otherwise it opens the block
dialog. WhatsApp retitles the item only when it rebuilds its menus, on a chat
switch, so right after a block or unblock the title is stale. The chords read the
state from the chat instead, whose composer a blocked contact's chat replaces
with **Delete chat** and **Unblock**.

`cb` blocks the chat's contact the fastest way: the toggle opens the block
dialog without Info, and the dialog's **Block** confirms (about 0.35 s, most of
it WhatsApp presenting the dialog). Info disables the menu, so `cb` closes Info
first when it is open. `ib` and `ibr` use the same menu while Info is closed.
With Info open, they scroll to its Block row instead, which is faster than
waiting for the menu to re-enable after closing Info. Either way they press
**Block** or **Block and report** in the dialog, also when it is already open.
All three leave an already blocked contact alone, where the toggle would unblock.
`iu` unblocks with the toggle while Info is closed (about 0.13 s), and with Info
open presses Info's Unblock row and confirms a follow-up Unblock dialog if one
appears; it leaves a contact that is not blocked alone. These bindings perform
the named action, including report submission for `ibr`. Confirmations are found
within the dialog, not the title's own group. The dialog is a popover from Info's
row and a sheet from the menu.

Most menu and sidebar actions use IDs. Contact Info rows, theme navigation,
palette descriptions, and the dynamic `Block…` menu item use English labels.
Save to Downloads opens its “More options” menu. Child chords open or invoke
their named control; confirmations and further selection use WhatsApp's UI,
with `ib`, `ibr`, `iu`, `igmr`, and global `]]` able to invoke their confirmation
buttons. Member options use English labels, and member rows are told apart from
action rows by their missing accessibility value (verified in 26.38.74).

Requires macOS 14+ and Chord's Accessibility permission. Control identifiers
were inspected in WhatsApp 26.38.74. Chat actions still require a selected chat,
and call controls require an active call; bringing WhatsApp forward does not
make unavailable actions valid. Ambiguous controls across multiple windows fail.
WhatsApp has displayed rows that it omits from its accessibility tree, including
Group permissions, Advanced chat privacy, and Encryption; 26.38.74 exposes them
as text while they are on screen. `igp` first targets the accessible permissions
row. When it is missing, it locates the next row after Disappearing messages
using the current Mute/Notify row spacing, within the Group Info section above
Create a similar group. It checks the layout, uses a window-targeted click, and
verifies the Group permissions heading afterward. An unexpected layout or
destination reports an error. Contact details also depends on the selected
contact and app version.

Each control is pressed as soon as it is listed, a tap at its activation point
reaches it, and its window is in place. A page pushed within a window doesn't
need to finish sliding in: in 26.38.74, pressing Wallpaper while Chat theme was
still being pushed worked 6/6.

Sheets and action sheets are different. Catalyst draws them in their own
windows, which grow and fade in for about 0.2 s, while accessibility already
reports their final frames. A tap at a control's activation point meanwhile
lands wherever the growing window is. In 26.38.74, a press on Remove from group
opened the member's Info instead. So a control is pressed only once every edge of
its window is within a quarter of the control's size of the window's
accessibility frame. At that point every point drawn in the window is too, so
the tap lands inside the control. `_AXUIElementGetWindow` maps the control to
its window. The bounds are compared once per display frame, because the
WindowServer posts no notification for them. This is a geometric check, not a
delay: a sheet that is already open costs one comparison. Menu items,
cancels and keyboard shortcuts don't tap a point, so they skip the check. An action's
steps run in one native call, which activates WhatsApp once. A step that needs a
window-targeted click returns it with the step to resume from. Every
accessibility read waits for WhatsApp's main thread, so each wait for WhatsApp
reads the tree once. That read gets one request per element, skips the menu bar,
and serves all of the step's guards, scope and target, and the next step's first
check if nothing was pressed in between.

On 26.38.74, `itw` takes about 1.25 s. Most of that is WhatsApp's own work:
about 0.54 s to build Info and open its sheet, and about 0.2 s and 0.25 s for
the Theme and Wallpaper pages to appear. `igmr2` takes about 1.6 s, including
both action sheets opening. `c/` takes about 0.25 s. `i/` takes about 1.2 s,
because WhatsApp focuses the search field only after Info has closed.

WhatsApp's page scrolls animate for about 160 ms and post no completion
notification. Before an action pages further, counts members or locates the
permissions row, it waits until two consecutive reads of the list match.
Correctness does not depend on that timing: a page moves less than the
visible height, each scroll starts from a page that was read, and the bottom is
recognized when WhatsApp stops offering page down. WhatsApp keeps offering page
up at the top of Info, where it does nothing, so the list is moved up by
scrolling its topmost element (the Info header) into view instead.

Build from this directory with `vp pack`. Run `vp run test` for handler tests and
`vp run test:macos -- @keychord/chords-whatsapp` from the workspace root for
native checks in the disposable macOS VM.
To check global navigation against WhatsApp's dialogs, select
`@keychord/chords-navigation` with `test:macos`.
The native suite exercises every binding against an AppKit fixture through the
production addon and Chord host, including a covering app, UI text clicks,
palette geometry, toggle states, nested navigation, numbered chat info, group
member selection, paged Info and member lists with off-screen and covered rows,
member options and removal, dialog navigation and defaults, Block/Report/Unblock
confirmations, and unavailable controls. It does not place calls, modify real
chats, or submit real reports.

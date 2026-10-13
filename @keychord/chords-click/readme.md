# @keychord/chords-click

General macOS window clicks. Start with `.` and enter x/y coordinate pairs from the
top left. Each bare digit is one coordinate in tenths: `.13` clicks 10% across and
30% down; `.1313` clicks that position twice. Within coordinate pairs, `-` means 0%, `1`–`9` mean 10%–90%, and `0` means
100%. Far-edge coordinates land on the last pixel inside the window.

Add `/` and one digit to refine a shorthand coordinate by tenths of its unit:
`1/2` means 12%, `9/5` means 95%, and `-/2` means 2%. The digit after `/` is
always consumed as part of that coordinate; `/0` adds zero. `.91/2` clicks
(90%, 12%), and `.91/21/23/4` clicks (90%, 12%), then (12%, 34%).

A direction suffix makes the whole number an exact pixel offset: `20l` means
20 pixels from the left, `20r` from the right, `20t` from the top, and `20b` from
the bottom. `.20l5` clicks x=20 pixels, y=50%. `.20b5` clicks halfway across and
20 pixels above the bottom. Exact values may include decimals and use macOS
logical points, independent of Retina scale. Explicit directions may appear in
either axis order. Each pair must contain one horizontal and one vertical coordinate.

Pairs run together without separators. Pixel offsets consume the complete number
before their direction suffix. Use `/0` on a shorthand coordinate immediately
before a pixel amount to keep the two numbers distinct: `.13/020l5` clicks
(10%, 30%), then (20px, 50%). `/` is exclusively a fractional suffix.

Choose the initial click type with `.` (left), `..` (double), `.,` (right), or
`.;` (middle). Inside the sequence, `.`, `..`, `,`, and `;` override only the
next coordinate pair. Later pairs return to the initial click type. For example,
`..-9,9228` double-clicks (0%, 90%), right-clicks
(90%, 20%), then double-clicks (20%, 80%).

Use `.-` to drag with the left button, `.,-` with the right button, or `.;-`
with the middle button. The first pair presses the button; the remaining pairs
move while it stays down. `.-1328` drags from (10%, 30%) to (20%, 80%), then
releases. An internal `.-`, `.,-`, or `.;-` starts a drag at the next pair and
continues through following bare pairs. An explicit click marker ends that drag.

End a complete sequence with an extra `-` to leave the button down:
`.-1328-` keeps the drag held, and `.13-` presses at (10%, 30%) and stays held.
A later movement sequence continues the held drag and releases when it finishes,
unless it also ends with `-`. An ordinary click releases the held button before
clicking. Failures, including invalid coordinates or a missing window in the next
command, and package worker shutdown also release it. A double-click
cannot end with a hold marker.

Use `.=13` to move the pointer to (10%, 30%) without clicking. `.=1328` visits
both positions. When a button is already held, these moves continue the drag.

Use `./` for screen coordinates: `./55` clicks the center of the display
containing the pointer at the start of the sequence. Percentages, `/n` refinements,
and pixel edge offsets use that display's bounds. These are ordinary global mouse
events, so they reach the visible app at that point and can change focus.
Combine modifiers as `./=55` (move globally), `./-1328` (drag globally), or
`./;-1328` (middle-button drag globally). `.=/55` and `.-/1328`
also support screen scope. Window-scoped commands continue to target the captured
app's window even when covered.

A `-` immediately after the command/button prefix now starts a drag. To begin a
normal click with a zero horizontal offset, write `0l`: `.0l9`, `.,0l9`, or
`.;0l9`. Dashes inside pairs remain zero coordinates: `.0-` still clicks the
top-right edge. A trailing `-` is a hold only after a complete coordinate pair.

The five-click example is:

```text
.20b5-53/07/00r20b65
```

It clicks 20 pixels above the bottom at the horizontal center, halfway down at the
left edge, 30% from the left and 70% down, 20 pixels above the bottom at the right
edge, and 60% from the left and halfway down.

The handler uses the application captured by Chord when the chord was entered and
targets its frontmost on-screen normal window. It validates the complete sequence
before sending input, queues overlapping sequences, and waits 500 ms between
coordinate pairs. Drags keep the button held during this pause. Double-clicks retain
their short internal interval; single actions and the final action add no delay.
The fixed pause allows time for transitions, but the coordinate runner cannot
observe animation completion. Slow transitions or network requests may still need longer.
Clicks use the built-in `chord.click` helper and move the pointer to each resolved
point so the target is visible. Button events still go directly to the target window,
including when another app covers it; cursor movement does not activate the app or
click a covering window. Chord needs Accessibility permission. The sequence stops if the window
moves, resizes, disappears, or a click fails. No additional native addon is needed.

Other chord packages can reuse `click.js`, optionally passing a bundle ID to the
builder to target a specific app. The existing iPhone Mirroring handler shares the
parser and click routine while retaining its connection checks.

Run `vp run test:macos -- @keychord/chords-click` from the workspace root after
`vp run test:macos:setup`. The VM test sends real native clicks to a controlled
AppKit window behind a covering app and verifies received coordinates, order,
timing, cursor movement, focus preservation, and failures when the window moves or disappears.
Every named command in `chords/macos.toml` also has a binding-to-native-action unit
test. Native tests cover all buttons in window and global scope, drag holds, and
release after malformed or out-of-bounds follow-up commands.

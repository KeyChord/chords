# @keychord/chords-click

General macOS window clicks. Start with `.` and enter x/y coordinate pairs from the
top left. Each bare digit is one coordinate in tenths: `.13` clicks 10% across and
30% down; `.1313` clicks that position twice. `-` means 0%, `1`–`9` mean 10%–90%, and `0` means
100%. Far-edge coordinates land on the last pixel inside the window.

A direction suffix makes the whole number an exact pixel offset: `20l` means
20 pixels from the left, `20r` from the right, `20t` from the top, and `20b` from
the bottom. `.20l5` clicks x=20 pixels, y=50%. `.20b5` clicks halfway across and
20 pixels above the bottom. Exact values may include decimals and use macOS
logical points, independent of Retina scale. Explicit directions may appear in
either axis order. Each pair must contain one horizontal and one vertical coordinate.

Use `/` between pairs when mixing shorthand and exact numbers, so a run of digits
cannot merge into a pixel amount: `.13/20l5` clicks (10%, 30%), then (20px, 50%).
Pure shorthand pairs can run together, as in `.1313`.

Choose the initial click type with `.` (left), `..` (double), `.,` (right), or
`.;` (middle). Inside the sequence, `.`, `..`, `,`, and `;` override only the
next coordinate pair. Later pairs return to the initial click type. `/` keeps the
initial type. For example, `..-9,9228` double-clicks (0%, 90%), right-clicks
(90%, 20%), then double-clicks (20%, 80%).

The five-click example is:

```text
.20b5/-5/37/0r20b/65
```

It clicks 20 pixels above the bottom at the horizontal center, halfway down at the
left edge, 30% from the left and 70% down, 20 pixels above the bottom at the right
edge, and 60% from the left and halfway down.

The handler uses the application captured by Chord when the chord was entered and
targets its frontmost on-screen normal window. It validates the complete sequence
before clicking, queues overlapping sequences, and waits 500 ms after releasing
each click or long press before the next coordinate pair. Double-clicks retain
their short internal interval; single actions and the final action add no delay.
The fixed pause allows time for transitions, but the coordinate runner cannot
observe animation completion. Slow transitions or network requests may still need longer.
Clicks use the built-in `chord.click` helper without moving the pointer or activating
the app. Chord needs Accessibility permission. The sequence stops if the window
moves, resizes, disappears, or a click fails. No additional native addon is needed.

Other chord packages can reuse `click.js`, optionally passing a bundle ID to the
builder to target a specific app. The existing iPhone Mirroring handler shares the
parser and click routine while retaining its connection checks.

Run `vp run test:macos -- @keychord/chords-click` from the workspace root after
`vp run test:macos:setup`. The VM test sends real native clicks to a controlled
AppKit window behind a covering app and verifies received coordinates, order,
timing, pointer/focus preservation, and failures when the window moves or disappears.

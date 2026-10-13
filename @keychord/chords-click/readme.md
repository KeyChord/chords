# @keychord/chords-click

General macOS window clicks. Start with `.` followed by one or more coordinate pairs:

```text
.b20l.5b.5l0b.3l.3b20r0b.5r.4
```

Each click needs one vertical edge (`t` top or `b` bottom) and one horizontal edge
(`l` left or `r` right), in either order. A number beginning with a digit is a pixel
offset from that edge; a leading-dot number such as `.5` is a fraction of the
corresponding window dimension. Spaces are optional. Pixel offsets use macOS logical
screen points and are independent of Retina scale.

The example clicks 20 pixels above the bottom at the horizontal center, halfway up
at the left edge, 30% up and 30% from the left, 20 pixels above the bottom at the right
edge, and halfway up and 40% from the right. Zero right/bottom offsets land on the
last pixel inside the window.

The handler uses the application captured by Chord when the chord was entered and
targets its frontmost on-screen normal window. It validates the complete sequence
before clicking, queues overlapping sequences, and waits 200 ms between clicks.
Clicks use the built-in `chord.click` helper without moving the pointer or activating
the app. Chord needs Accessibility permission. The sequence stops if the window
moves, resizes, disappears, or a click fails. No additional native addon is needed.

Other chord packages can reuse `click.js`, optionally passing a bundle ID to the
builder to target a specific app. The existing iPhone Mirroring handler shares the
parser and click routine while retaining its connection checks.

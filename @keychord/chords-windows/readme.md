# @keychord/chords-windows

Native macOS window geometry and application shortcuts for Chord.

| Chord         | Result                       |
| ------------- | ---------------------------- |
| `/h` or `/wh` | Hide the current application |
| `/m` or `/wm` | Minimize the current window  |
| `/q` or `/wq` | Quit the current application |

`/ws<width><height>` sets the captured application's focused window size. A positive
single digit divides the display extent: `2` means half. A negative digit adds whole
display extents: `-1` means twice, `-2` means three times. Shorthand does not accept
decimal notation. An omitted dimension stays unchanged; `/wsw` selects only width
and `/wsh` selects only height. An `x` after the first number selects absolute pixels
for both dimensions; ordinary decimal pixel amounts are supported.

| Chord             | Result                                                     |
| ----------------- | ---------------------------------------------------------- |
| `/ws22`           | Half width and half height (a quarter of the display area) |
| `/ws2` or `/wsw2` | Half width, same height                                    |
| `/ws-1`           | Twice the display width, same height                       |
| `/ws2-1`          | Half width and twice the display height                    |
| `/wsh1`           | Full height, same width                                    |
| `/ws200x`         | Width 200 pixels, same height                              |
| `/ws200x200`      | Width and height 200 pixels                                |
| `/wsh200x`        | Height 200 pixels, same width                              |

`/wp<left><top>` positions the window relative to the display's top-left corner.
Positive and negative digits are signed divisors: `2` means halfway across, `-1`
means a full display offscreen, and `-2` means half a display offscreen. Position `0`
means the display origin. `/wpx` sets only X; `/wpy` sets only Y. `/wpr` anchors the
right edge instead of the left edge. `/wph` is also available for a top-only offset.

| Chord        | Result                                                                |
| ------------ | --------------------------------------------------------------------- |
| `/wp22`      | Left edge halfway across, top edge halfway down                       |
| `/wp00`      | Align the window's top-left corner with the display's top-left corner |
| `/wpr1`      | Align the right edge with the display's right edge, same top          |
| `/wp-1`      | Place the left edge a full display width offscreen to the left        |
| `/wpx-2`     | Place the left edge half a display width offscreen to the left        |
| `/wpy-2`     | Place the top edge half a display height above the display            |
| `/wp200x200` | Left and top offsets 200 pixels                                       |
| `/wpr200x`   | Right edge 200 pixels from the display's left edge                    |

`/w<width><height><left><top>` combines four shorthand values. All four are required.
A zero width or height preserves that dimension; positional zeros select the origin.
`/w1100` fills the usable display from its top-left corner, `/w2200` fills its top-left
quarter, and `/w0022` moves to the midpoint without resizing. `/w1-1-24` uses full
width, twice the height, a negative half-display left offset, and a quarter-display
top offset. Signed digits may be adjacent or separated by spaces. Use `/ws` and `/wp`
for absolute pixels or individual axes.

`/wl`, `/wr`, `/wt`, `/wb` align one edge and preserve size. `/wtl`, `/wtr`, `/wbl`,
`/wbr` align corners and preserve size. `/wc` centers the window. `/wlr` (or `/wrl`)
stretches from left to right, preserving height and top; `/wtb` (or `/wbt`) stretches
from top to bottom, preserving width and left. `/wf` fills the display. These commands
use native window geometry. The previous Window-menu actions live under `=w` in
`@keychord/chords-menu`.

Geometry uses the usable area of the display containing most of the window, excluding
the menu bar and Dock. Pixel values are macOS logical points. Resizing preserves the
requested origin, including when the window extends beyond the right or bottom edge;
the handler retries from a temporary origin if the application caps the first resize.
Accessibility access is required. An application's enforced size limits are reported
as errors instead of silently accepting clipped dimensions. Applications may also
constrain fully offscreen positions; constrained moves report their applied and
requested coordinates.

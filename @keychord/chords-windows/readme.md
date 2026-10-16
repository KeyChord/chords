# @keychord/chords-windows

Native macOS window geometry and application shortcuts for Chord.

`/ws<number>` moves the captured application's focused window to a desktop Space,
numbered from 1 in Mission Control display order, excluding full-screen Spaces.
`/ws]` moves it to the next desktop on its current display; `/ws[` moves it to the
previous one. These commands preserve window geometry and leave the visible Space
unchanged. The desktop must already exist; previous/next report an error at the
display's boundary. Full-screen, minimized, and all-Spaces windows are excluded.
The native handler verifies the window's destination after each move. Space moves
use runtime-resolved macOS APIs, following [yabai's native implementation](https://github.com/asmvik/yabai/blob/master/src/space_manager.c).

Space, size, and position commands act on the window Chord selected when the run
started (`this.focusedWindowId`), not on whichever window has focus when each
repetition runs. `3/ws]` therefore moves one window three desktops, although focus
passes to another window once the first move takes it off the visible Space, and
``5`i9`/wd=`` keeps growing the same window if you switch windows meanwhile. A
selected window that has closed is an error; nothing falls back to another window.
Window cycling still follows focus, so `3/w]` advances three windows.

`/w]` focuses the next regular window of the captured application; `/w[` focuses
the previous one. Both wrap around and use native Accessibility focus and raise
actions, independently of the configured Command-backtick shortcut. Minimized
windows, utility panels, and full-screen or other-Space windows are skipped.

| Chord | Result                       |
| ----- | ---------------------------- |
| `/wh` | Hide the current application |
| `/wm` | Minimize the current window  |
| `/wq` | Quit the current application |

`/wd<width><height>` sets the captured application's focused window dimensions. A positive
single digit divides the display extent: `2` means half. Within combined bounds or
the second dimension, a negative digit adds whole display extents: `-1` means twice,
`-2` means three times. A leading `-` after `/wd`, `/wdw`, or `/wdh` decreases the
current dimensions instead (see below). Shorthand does not accept
decimal notation. An omitted dimension stays unchanged; `/wdw` selects only width
and `/wdh` selects only height. An `x` after the first number selects absolute pixels
for both dimensions; ordinary decimal pixel amounts are supported.

| Chord             | Result                                                     |
| ----------------- | ---------------------------------------------------------- |
| `/wd22`           | Half width and half height (a quarter of the display area) |
| `/wd2` or `/wdw2` | Half width, same height                                    |
| `/wd2-1`          | Half width and twice the display height                    |
| `/wdh1`           | Full height, same width                                    |
| `/wd200x`         | Width 200 pixels, same height                              |
| `/wd200x200`      | Width and height 200 pixels                                |
| `/wdh200x`        | Height 200 pixels, same width                              |

`/wd=<amount>` increases both current window dimensions; `/wd-<amount>` decreases
them. `/wdw=` and `/wdw-` affect only width, while `/wdh=` and `/wdh-` affect only
height. Omitting the amount uses 10%. One digit selects the percentage: `1` means
10%, `2` means 20%, through `9` for 90%; `0` means 100%. A 100% decrease is rejected
because dimensions must remain positive. Each adjustment uses the current window
dimensions and preserves its top-left position.

| Chord             | Result                             |
| ----------------- | ---------------------------------- |
| `/wd=` or `/wd=1` | Increase width and height by 10%   |
| `/wd-` or `/wd-1` | Decrease width and height by 10%   |
| `/wd=0`           | Double width and height            |
| `/wdw=3`          | Increase width by 30%, same height |
| `/wdh-5`          | Halve height, same width           |

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
top offset. Signed digits may be adjacent or separated by spaces. Use `/wd` and `/wp`
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

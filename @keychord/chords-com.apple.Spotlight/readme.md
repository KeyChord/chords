# @keychord/chords-com.apple.Spotlight

> [!NOTE]
> This document is largely AI-written, so parts of it may not be fully accurate. It will be replaced with a hand-written version when I get the time.

Chord's built-in launcher, which uses Spotlight. Chord installs it by default.

Type `/<query>` and complete the chord to open Spotlight's top result for the query, as typing
it into Spotlight and pressing Return does. `/calculator` opens Calculator, and `/2+3` opens
Spotlight's calculation. `/` alone opens Spotlight.

The launcher is a fallback chord, so any other `/` chord, such as `/f` for Finder or `/t` for
Terminal, still runs instead. A launcher from an installed package, such as
[`@keychord/chords-raycast`](../chords-raycast), replaces it, because installed packages
override built-in ones.

It needs macOS 27, where Spotlight is part of the Siri AI app, and Accessibility access for
Chord. On earlier versions of macOS, `/<query>` reports that and suggests the Raycast package.

## How it works

1. If Spotlight isn't open, Chord opens it with `open -b com.apple.campo spotlight://apps`.
   That URL shows Spotlight's Applications view without the Spotlight keyboard shortcut, so it
   works even if you've changed or turned off the shortcut. Chord then presses the view's Back
   button for the general search.
2. Chord clears the search, then enters the query as one accessibility edit. Starting from an
   empty search means a result still showing from an earlier query can't be opened by mistake.
3. Chord waits until Spotlight has selected a result whose completion matches the query. It
   waits on Spotlight's accessibility notifications rather than checking on a timer.
4. Chord reads the panel again and raises it, then presses Return, because Spotlight has no
   accessibility action that opens a result. Raising matters when the panel was already open:
   an app activated since then has the keyboard, and Return would go there. Chord then waits
   for Spotlight to close the panel, which it does once the result has opened.

If Spotlight finds nothing, Chord doesn't open its "Search in Finder" or "Search The Web" rows
and reports that nothing was found. Spotlight shows those rows about five seconds after a search
that has no other results, so a query with no results fails at the five-second timeout. Opening
the search, finding a result and confirming it each wait at most that long; pass a different
timeout in milliseconds as the handler's first argument.

Until you choose Continue on it, Spotlight shows its introduction (Browse More Locations and a
privacy notice) each time it opens with an empty search. The query replaces it, as typing does,
so it doesn't stop the launcher, and Chord never chooses Continue for you.

Chord finds everything by accessibility identifier, so the launcher works in any language.

## Development

Build the JavaScript and the Swift addon with `vp pack`. Run unit tests with `vp run test`
(`bun test --isolate`) in this directory.

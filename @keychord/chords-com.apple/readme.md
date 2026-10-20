# @keychord/chords-com.apple

Empty app stubs for pre-installed macOS apps. The stubs remain here as a catalog
for future bindings. Apps with bindings live in separate packages named after
their exact bundle IDs:

- [Accessibility Inspector](../chords-com.apple.AccessibilityInspector) (`@keychord/chords-com.apple.AccessibilityInspector`)
- [Activity Monitor](../chords-com.apple.ActivityMonitor) (`@keychord/chords-com.apple.ActivityMonitor`)
- [Safari](../chords-com.apple.Safari) (`@keychord/chords-com.apple.Safari`)
- [iPhone Mirroring](../chords-com.apple.ScreenContinuity) (`@keychord/chords-com.apple.ScreenContinuity`)
- [System Preferences](../chords-com.apple.systempreferences) (`@keychord/chords-com.apple.systempreferences`)
- [Finder](../chords-com.apple.finder) (`@keychord/chords-com.apple.finder`)

Terminal's chords live in [`chords-terminal`](../chords-terminal), alongside other
basic terminals.

Enable each app package through the `KeyChord/chords` monorepo. Global launch
chords belong to their app packages too. Chord's pinned default
packages continue to use their snapshots until refreshed after the new mirrors exist.

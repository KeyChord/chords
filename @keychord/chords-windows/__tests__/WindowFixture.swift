import AppKit

@MainActor
final class FixtureWindow: NSWindow {
    // Allow the fixture to prove oversized sizes and negative/offscreen AX positions.
    override func constrainFrameRect(_ frameRect: NSRect, to screen: NSScreen?) -> NSRect { frameRect }
    override func setAccessibilityFrame(_ frame: NSRect) { setFrame(frame, display: true) }
}

@MainActor
final class WindowFixture: NSObject, NSApplicationDelegate {
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!
    var window: FixtureWindow!
    var timer: Timer?

    func snapshot() {
        let primary = NSScreen.screens[0].frame
        let screen = NSScreen.screens[0].visibleFrame
        let state: [String: Any] = [
            "x": window.frame.minX, "y": primary.maxY - window.frame.maxY,
            "width": window.frame.width, "height": window.frame.height,
            "screen": ["x": screen.minX, "y": primary.maxY - screen.maxY,
                       "width": screen.width, "height": screen.height],
            "frontmostAppId": NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "",
        ]
        try! JSONSerialization.data(withJSONObject: state).write(to: URL(fileURLWithPath: output), options: .atomic)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = FixtureWindow(contentRect: NSRect(x: 100, y: 100, width: 300, height: 400),
                               styleMask: [.titled, .resizable, .closable], backing: .buffered, defer: false)
        window.title = "Chord window geometry fixture"
        window.minSize = NSSize(width: 1, height: 1)
        window.maxSize = NSSize(width: 100_000, height: 100_000)
        window.isReleasedWhenClosed = false
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
        snapshot()
        try! String(ProcessInfo.processInfo.processIdentifier).write(toFile: output + ".pid", atomically: true, encoding: .utf8)
        timer = Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.snapshot() }
        }
    }
}

@main
struct Main {
    @MainActor
    static func main() {
        let app = NSApplication.shared
        let delegate = WindowFixture()
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

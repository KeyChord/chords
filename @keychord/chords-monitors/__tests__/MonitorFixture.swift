import AppKit

@MainActor
final class MonitorWindow: NSWindow {
    var clicks = 0
    override func sendEvent(_ event: NSEvent) {
        if [.leftMouseDown, .rightMouseDown, .otherMouseDown].contains(event.type) { clicks += 1 }
        super.sendEvent(event)
    }
}

@MainActor
final class MonitorFixture: NSObject, NSApplicationDelegate {
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!
    var window: MonitorWindow!
    var hiddenWindow: MonitorWindow!
    var timer: Timer?

    func snapshot() {
        let pointer = CGEvent(source: nil)!.location
        let primary = NSScreen.screens[0].frame
        let screen = NSScreen.screens[0].visibleFrame
        let state: [String: Any] = [
            "frontmostAppId": NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "",
            "cursor": ["x": pointer.x, "y": pointer.y],
            "center": ["x": screen.midX, "y": primary.maxY - screen.midY],
            "frame": [window.frame.minX, window.frame.minY, window.frame.width, window.frame.height],
            "visibleFrame": [screen.minX, screen.minY, screen.width, screen.height],
            "primaryTop": primary.maxY,
            "clicks": window.clicks,
            "keyWindow": NSApp.keyWindow === window,
        ]
        try! JSONSerialization.data(withJSONObject: state).write(to: URL(fileURLWithPath: output), options: .atomic)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Identical geometry must not make the monitor command select a hidden window.
        hiddenWindow = MonitorWindow(contentRect: NSRect(x: 100, y: 100, width: 300, height: 400),
                                    styleMask: [.titled, .resizable, .closable], backing: .buffered, defer: false)
        hiddenWindow.title = "Hidden window with matching bounds"
        hiddenWindow.isReleasedWhenClosed = false
        hiddenWindow.orderFront(nil)
        hiddenWindow.orderOut(nil)
        window = MonitorWindow(contentRect: NSRect(x: 100, y: 100, width: 300, height: 400),
                          styleMask: [.titled, .resizable, .closable], backing: .buffered, defer: false)
        window.title = "Chord monitor focus fixture"
        // A floating cover can own keyboard focus without being a normal window
        // the monitor command should select, like Chord's command overlay.
        if Bundle.main.bundleIdentifier!.hasSuffix(".cover") { window.level = .floating }
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
        let delegate = MonitorFixture()
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

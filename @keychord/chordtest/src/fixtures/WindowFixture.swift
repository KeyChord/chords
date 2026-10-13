import AppKit
import CoreGraphics

@MainActor
final class FixtureWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

@MainActor
final class EventView: NSView {
    var record: ((NSEvent, String, NSPoint) -> Void)?
    override var isFlipped: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func mouseDown(with event: NSEvent) { record?(event, "down", convert(event.locationInWindow, from: nil)) }
    override func mouseUp(with event: NSEvent) { record?(event, "up", convert(event.locationInWindow, from: nil)) }
}

@MainActor
final class WindowFixture: NSObject, NSApplicationDelegate {
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!
    var window: FixtureWindow!
    var events: [[String: Any]] = []
    var timer: Timer?

    func snapshot() {
        let mouse = NSEvent.mouseLocation
        let state: [String: Any] = [
            "events": events,
            "cursor": ["x": mouse.x, "y": mouse.y],
            "frontmostAppId": NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "",
            "width": window.frame.width, "height": window.frame.height,
            "visible": window.isVisible,
        ]
        if let data = try? JSONSerialization.data(withJSONObject: state) {
            try? data.write(to: URL(fileURLWithPath: output), options: .atomic)
        }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = FixtureWindow(contentRect: NSRect(x: 100, y: 100, width: 300, height: 600),
                               styleMask: .borderless, backing: .buffered, defer: false)
        window.title = "Chord deterministic click fixture"
        window.isReleasedWhenClosed = false
        let view = EventView(frame: NSRect(x: 0, y: 0, width: 300, height: 600))
        view.wantsLayer = true
        view.layer?.backgroundColor = NSColor.systemBlue.cgColor
        view.record = { [weak self] event, phase, point in
            self?.events.append(["phase": phase, "x": point.x, "y": point.y,
                                 "timestamp": event.timestamp])
            self?.snapshot()
        }
        window.contentView = view
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
        snapshot()
        try! String(ProcessInfo.processInfo.processIdentifier).write(toFile: output + ".pid", atomically: true, encoding: .utf8)
        timer = Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                let path = self.output + ".command"
                if let command = try? String(contentsOfFile: path, encoding: .utf8) {
                    try? FileManager.default.removeItem(atPath: path)
                    switch command {
                    case "move": self.window.setFrameOrigin(NSPoint(x: 150, y: 150))
                    case "resize": self.window.setContentSize(NSSize(width: 400, height: 500))
                    case "hide": self.window.orderOut(nil)
                    default: break
                    }
                }
                self.snapshot()
            }
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

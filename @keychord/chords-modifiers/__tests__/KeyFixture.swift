import AppKit

@MainActor
final class KeyFixture: NSObject, NSApplicationDelegate {
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!
    var window: NSWindow!
    var monitor: Any?
    var keys: [[String: UInt]] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 150, y: 150, width: 320, height: 160),
                          styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "Chord modifier fixture"
        monitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            MainActor.assumeIsolated {
                self?.keys.append(["code": UInt(event.keyCode), "flags": event.modifierFlags.rawValue])
                self?.snapshot()
            }
            return nil
        }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        snapshot()
        try! String(ProcessInfo.processInfo.processIdentifier).write(toFile: output + ".pid", atomically: true, encoding: .utf8)
    }

    func snapshot() {
        try! JSONSerialization.data(withJSONObject: keys).write(to: URL(fileURLWithPath: output), options: .atomic)
    }
}

@main struct Main {
    @MainActor static func main() {
        let delegate = KeyFixture()
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

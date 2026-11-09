import AppKit

/// Ordinary resizable windows for Rift to tile. The app stays running after its last
/// window closes.
@MainActor
final class RiftFixture: NSObject, NSApplicationDelegate {
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!
    let count = Int(ProcessInfo.processInfo.environment["RIFT_FIXTURE_WINDOWS"] ?? "") ?? 3
    var windows: [NSWindow] = []

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func applicationDidFinishLaunching(_ notification: Notification) {
        for index in 1...count {
            let window = NSWindow(
                contentRect: NSRect(x: 80 * index, y: 80 * index, width: 420, height: 300),
                styleMask: [.titled, .closable, .resizable, .miniaturizable],
                backing: .buffered, defer: false)
            window.title = "Chord Rift fixture \(index)"
            window.isReleasedWhenClosed = false
            window.makeKeyAndOrderFront(nil)
            windows.append(window)
        }
        // Rift closes a window by posting Command-W to its app. Launched straight from its
        // binary, this app's main menu didn't act on that, so close the key window here, as a
        // File › Close item would. Received key events are logged to diagnose a failed close.
        FileManager.default.createFile(atPath: output + ".events", contents: nil)
        let events = FileHandle(forWritingAtPath: output + ".events")!
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            let key = NSApp.keyWindow
            let line = "keyDown \(event.charactersIgnoringModifiers ?? "") flags=\(event.modifierFlags.rawValue) active=\(NSApp.isActive) key=\(key?.title ?? "none")\n"
            events.write(line.data(using: .utf8)!)
            guard event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command,
                event.charactersIgnoringModifiers == "w", let key
            else { return event }
            key.performClose(nil)
            return nil
        }
        NSApp.activate(ignoringOtherApps: true)
        try! String(ProcessInfo.processInfo.processIdentifier)
            .write(toFile: output + ".pid", atomically: true, encoding: .utf8)
    }
}

@main
struct Main {
    @MainActor
    static func main() {
        let app = NSApplication.shared
        let delegate = RiftFixture()
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

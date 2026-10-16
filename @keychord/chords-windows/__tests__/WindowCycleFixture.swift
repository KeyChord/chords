import AppKit

@MainActor
final class WindowCycleFixture: NSObject, NSApplicationDelegate {
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!
    var windows: [NSWindow] = []
    var panel: NSPanel!
    var timer: Timer?
    var keyEvents = 0

    func addWindow(_ title: String) {
        // Identical bounds ensure production resolves actual window IDs.
        let window = NSWindow(contentRect: NSRect(x: 100, y: 100, width: 400, height: 300),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = title
        window.isReleasedWhenClosed = false
        windows.append(window)
        window.makeKeyAndOrderFront(nil)
    }

    func snapshot() {
        let state: [String: Any] = [
            "keyWindow": NSApp.keyWindow?.title ?? "",
            "frontmostAppId": NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "",
            "keyEvents": keyEvents,
            "windows": windows.map { ["title": $0.title, "visible": $0.isVisible, "minimized": $0.isMiniaturized] },
        ]
        try! JSONSerialization.data(withJSONObject: state).write(to: URL(fileURLWithPath: output), options: .atomic)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        addWindow("Minimized")
        windows[0].miniaturize(nil)
        for title in ["One", "Two", "Three"] { addWindow(title) }
        panel = NSPanel(contentRect: NSRect(x: 600, y: 100, width: 150, height: 150),
                        styleMask: [.titled, .utilityWindow, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.title = "Utility"
        panel.orderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            self?.keyEvents += 1
            return event
        }
        snapshot()
        try! String(ProcessInfo.processInfo.processIdentifier).write(toFile: output + ".pid", atomically: true, encoding: .utf8)
        timer = Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                let path = self.output + ".command"
                if let command = try? String(contentsOfFile: path, encoding: .utf8) {
                    try? FileManager.default.removeItem(atPath: path)
                    let parts = command.split(separator: ":", maxSplits: 1).map(String.init)
                    if parts.count == 2 {
                        switch parts[0] {
                        case "close": self.windows.first { $0.title == parts[1] }?.close()
                        case "minimize": self.windows.first { $0.title == parts[1] }?.miniaturize(nil)
                        case "add": self.addWindow(parts[1])
                        default: break
                        }
                    }
                }
                self.snapshot()
            }
        }
    }
}

@main
struct Main {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = WindowCycleFixture()
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

import AppKit

@MainActor
final class ApplicationFixture: NSObject, NSApplicationDelegate {
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!
    var window: NSWindow!
    var timer: Timer?
    var keyEvents = 0
    var activity: NSObjectProtocol?

    func snapshot() {
        let state: [String: Any] = [
            "frontmostAppId": NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "",
            "hidden": NSApp.isHidden, "visible": window.isVisible, "keyEvents": keyEvents,
        ]
        try! JSONSerialization.data(withJSONObject: state).write(to: URL(fileURLWithPath: output), options: .atomic)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiated, .latencyCritical], reason: "Observe native application switching in a test VM")
        window = NSWindow(contentRect: NSRect(x: 100, y: 100, width: 300, height: 200),
                          styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = Bundle.main.bundleIdentifier!
        window.isReleasedWhenClosed = false
        window.makeKeyAndOrderFront(nil)
        if NSApp.activationPolicy() == .regular { NSApp.activate(ignoringOtherApps: true) }
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
                    switch command {
                    case "hide": NSApp.hide(nil)
                    case "activate": NSApp.activate(ignoringOtherApps: true)
                    case "close": self.window.close()
                    case "quit": NSApp.terminate(nil)
                    default:
                        if command.hasPrefix("activate:"),
                           let target = NSRunningApplication.runningApplications(withBundleIdentifier: String(command.dropFirst("activate:".count))).first {
                            NSApp.yieldActivation(to: target)
                            target.activate(options: [])
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
        let delegate = ApplicationFixture()
        app.setActivationPolicy(Bundle.main.bundleIdentifier!.hasSuffix("helper") ? .accessory : .regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

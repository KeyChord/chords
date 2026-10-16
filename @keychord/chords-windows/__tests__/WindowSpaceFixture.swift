import AppKit
import ApplicationServices
import Darwin

@MainActor
final class SpaceFixture: NSObject, NSApplicationDelegate {
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!
    let library = dlopen("/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight", RTLD_LAZY)!
    var window: NSWindow!
    /// Takes focus once the selected window leaves the visible Space.
    var companion: NSWindow!
    var timer: Timer?

    func symbol<T>(_ name: String, _: T.Type) -> T { unsafeBitCast(dlsym(library, name)!, to: T.self) }
    var connection: Int32 { symbol("SLSMainConnectionID", (@convention(c) () -> Int32).self)() }

    func desktops() -> [UInt64] {
        let copy = symbol("SLSCopyManagedDisplaySpaces", (@convention(c) (Int32) -> Unmanaged<CFArray>?).self)
        let displays = copy(connection)!.takeRetainedValue() as! [[String: Any]]
        return displays.flatMap { ($0["Spaces"] as! [[String: Any]]).compactMap { space in
            (space["type"] as! NSNumber).intValue == 0 ? (space["id64"] as! NSNumber).uint64Value : nil
        } }
    }

    func attribute(_ element: AXUIElement, _ name: String) -> AnyObject? {
        var result: CFTypeRef?
        AXUIElementCopyAttributeValue(element, name as CFString, &result)
        return result
    }

    func addButton(_ element: AXUIElement, depth: Int = 0) -> AXUIElement? {
        if attribute(element, kAXRoleAttribute) as? String == kAXButtonRole,
           attribute(element, kAXDescriptionAttribute) as? String == "add desktop" { return element }
        guard depth < 12 else { return nil }
        for child in attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? [] {
            if let button = addButton(child, depth: depth + 1) { return button }
        }
        return nil
    }

    func prepareDesktops() async throws {
        guard desktops().count < 3 else { return }
        // CoreDock is exported by HIServices, already loaded through AppKit, not SkyLight.
        guard let notification = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CoreDockSendNotification") else {
            throw NSError(domain: "Mission Control notification API is unavailable", code: 1)
        }
        let notify = unsafeBitCast(notification, to: (@convention(c) (CFString, Int32) -> Int32).self)
        guard notify("com.apple.expose.awake" as CFString, 0) == 0,
              let dock = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.dock").first else {
            throw NSError(domain: "Could not open Mission Control", code: 1)
        }
        defer {
            for down in [true, false] {
                CGEvent(keyboardEventSource: nil, virtualKey: 53, keyDown: down)?.post(tap: .cghidEventTap)
            }
        }
        let root = AXUIElementCreateApplication(dock.processIdentifier)
        let deadline = ContinuousClock.now + .seconds(8)
        while desktops().count < 3 {
            guard ContinuousClock.now < deadline else { throw NSError(domain: "Could not create test desktops", code: 1) }
            if let button = addButton(root) {
                let count = desktops().count
                guard AXUIElementPerformAction(button, kAXPressAction as CFString) == .success else {
                    throw NSError(domain: "Could not press Add Desktop", code: 1)
                }
                while desktops().count == count, ContinuousClock.now < deadline {
                    try await Task.sleep(for: .milliseconds(20))
                }
            } else { try await Task.sleep(for: .milliseconds(20)) }
        }
    }

    func snapshot() {
        let copy = symbol("SLSCopySpacesForWindows", (@convention(c) (Int32, Int32, CFArray) -> Unmanaged<CFArray>?).self)
        func spaces(_ window: NSWindow) -> [NSNumber] {
            copy(connection, 7, [NSNumber(value: window.windowNumber)] as CFArray)!.takeRetainedValue() as! [NSNumber]
        }
        let active = symbol("SLSGetActiveSpace", (@convention(c) (Int32) -> UInt64).self)(connection)
        let state: [String: Any] = [
            "spaces": spaces(window), "desktops": desktops(), "activeSpace": active,
            "windowId": window.windowNumber, "companionSpaces": spaces(companion),
            "frontmostAppId": NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "",
            "frame": [window.frame.minX, window.frame.minY, window.frame.width, window.frame.height],
        ]
        try! JSONSerialization.data(withJSONObject: state).write(to: URL(fileURLWithPath: output), options: .atomic)
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        Task { @MainActor in
            do {
                try await prepareDesktops()
                companion = NSWindow(contentRect: NSRect(x: 450, y: 100, width: 300, height: 400),
                                     styleMask: [.titled, .resizable, .closable], backing: .buffered, defer: false)
                companion.title = "Chord window Space fixture companion"
                companion.isReleasedWhenClosed = false
                companion.orderFront(nil)
                window = NSWindow(contentRect: NSRect(x: 100, y: 100, width: 300, height: 400),
                                  styleMask: [.titled, .resizable, .closable], backing: .buffered, defer: false)
                window.title = "Chord window Space fixture"
                window.isReleasedWhenClosed = false
                window.makeKeyAndOrderFront(nil)
                NSApplication.shared.activate(ignoringOtherApps: true)
                snapshot()
                try String(ProcessInfo.processInfo.processIdentifier).write(toFile: output + ".pid", atomically: true, encoding: .utf8)
                timer = Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { [weak self] _ in
                    MainActor.assumeIsolated { self?.snapshot() }
                }
            } catch {
                try? JSONSerialization.data(withJSONObject: ["setupError": String(describing: error)]).write(to: URL(fileURLWithPath: output), options: .atomic)
                try? String(ProcessInfo.processInfo.processIdentifier).write(toFile: output + ".pid", atomically: true, encoding: .utf8)
            }
        }
    }
}

@main
struct Main {
    @MainActor
    static func main() {
        let app = NSApplication.shared
        let delegate = SpaceFixture()
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

import AppKit
import ApplicationServices
import Darwin
import NodeAPI

#NodeModule(exports: [
    "focusMonitor": try NodeFunction { (target: String) throws -> NodePromise in
        try mainActorPromise { try await focusMonitor(target) }
    },
    "setMonitorResolution": try NodeFunction { (width: Int, height: Int) throws -> NodePromise in
        try mainActorPromise { try setMonitorResolution(width: width, height: height) }
    },
])

@MainActor
private func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}

@MainActor
private func focusMonitor(_ command: String) async throws {
    let screens = NSScreen.screens
    guard let primary = screens.first, let pointer = CGEvent(source: nil)?.location else {
        throw MonitorError("Could not read the connected monitors and pointer position")
    }
    func global(_ frame: CGRect) -> CGRect {
        CGRect(x: frame.minX, y: primary.frame.maxY - frame.maxY, width: frame.width, height: frame.height)
    }
    let layout = MonitorLayout(frames: screens.map { global($0.frame) })
    let index = try layout.target(command, pointer: pointer)
    guard AXIsProcessTrusted() else { throw MonitorError("Accessibility permission is required to focus monitors") }
    guard let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
        throw MonitorError("Could not read visible windows")
    }
    // AX has no public WindowServer ID attribute. Resolve this bridge at runtime
    // and fail explicitly if unavailable: bounds/title matching can select a
    // different window on another Space with exactly the same geometry.
    typealias GetWindowID = @convention(c) (AXUIElement, UnsafeMutablePointer<CGWindowID>) -> Int32
    guard let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "_AXUIElementGetWindow") else {
        throw MonitorError("This macOS version cannot identify visible windows for monitor focusing")
    }
    let getWindowID = unsafeBitCast(symbol, to: GetWindowID.self)
    let frame = global(screens[index].visibleFrame)
    let center = CGPoint(x: frame.midX, y: frame.midY)
    var candidate: (NSRunningApplication, AXUIElement, AXUIElement)?
    var hasWindows = false
    // WindowServer lists windows front to back. Read only normal, visible windows
    // on the selected display; never activate a window from a different Space.
    for info in windows {
        guard (info[kCGWindowLayer as String] as? Int) == 0,
              (info[kCGWindowAlpha as String] as? Double ?? 1) > 0,
              let pid = info[kCGWindowOwnerPID as String] as? pid_t,
              let id = info[kCGWindowNumber as String] as? CGWindowID,
              pid != ProcessInfo.processInfo.processIdentifier,
              let rawBounds = info[kCGWindowBounds as String] as? NSDictionary,
              let windowBounds = CGRect(dictionaryRepresentation: rawBounds),
              layout.monitor(for: windowBounds) == index else { continue }
        hasWindows = true
        guard let application = NSRunningApplication(processIdentifier: pid) else { continue }
        let app = AXUIElementCreateApplication(pid)
        AXUIElementSetMessagingTimeout(app, 1)
        guard let elements = attribute(app, kAXWindowsAttribute) as? [AXUIElement],
              let window = elements.first(where: { element in
                  var candidateID: CGWindowID = 0
                  return getWindowID(element, &candidateID) == AXError.success.rawValue && candidateID == id
              }) else { continue }
        candidate = (application, app, window)
        break
    }
    if hasWindows && candidate == nil {
        throw MonitorError("Could not access a visible window on monitor \(index + 1)")
    }
    guard CGWarpMouseCursorPosition(center) == .success else { throw MonitorError("Could not move the pointer to the monitor") }
    // Empty displays have no window to receive keyboard focus. Leave the pointer
    // there so Space switching and the next monitor command target this display.
    guard let (application, app, window) = candidate else { return }
    AXUIElementSetAttributeValue(window, kAXMainAttribute as CFString, kCFBooleanTrue)
    guard application.activate(options: []) else { throw MonitorError("Could not activate the monitor's application") }
    let error = AXUIElementPerformAction(window, kAXRaiseAction as CFString)
    guard error == .success else { throw MonitorError("Could not focus the monitor's window (AX error \(error.rawValue))") }
    let deadline = ContinuousClock.now + .seconds(2)
    repeat {
        if NSWorkspace.shared.frontmostApplication?.processIdentifier == application.processIdentifier,
           let focused = attribute(app, kAXFocusedWindowAttribute), CFEqual(focused, window) { return }
        try await Task.sleep(for: .milliseconds(20))
    } while ContinuousClock.now < deadline
    throw MonitorError("The monitor's window did not receive focus")
}

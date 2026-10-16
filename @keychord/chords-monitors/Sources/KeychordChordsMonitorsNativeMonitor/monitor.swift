import AppKit
import AXorcistRuntime
import ApplicationServices
import ChordNodeSupport
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
    guard AXPermissionHelpers.hasAccessibilityPermissions() else { throw MonitorError("Accessibility permission is required to focus monitors") }
    guard let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else {
        throw MonitorError("Could not read visible windows")
    }
    // Resolve exact WindowServer IDs; matching geometry can select another Space's window.
    let resolver = AXWindowResolver()
    let frame = global(screens[index].visibleFrame)
    let center = CGPoint(x: frame.midX, y: frame.midY)
    var candidate: (NSRunningApplication, Element, Element)?
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
        let app = AXApp(application).element
        app.setMessagingTimeout(1)
        guard let window = app.windows()?.first(where: { resolver.windowID(from: $0) == id }) else { continue }
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
    _ = try? window.setAttributeValue(true, forAttribute: kAXMainAttribute)
    guard application.activate(options: []) else { throw MonitorError("Could not activate the monitor's application") }
    do {
        try window.performAction(.raise)
    } catch let error as AccessibilitySystemError {
        throw MonitorError("Could not focus the monitor's window (AX error \(error.axError.rawValue))")
    }
    let deadline = ContinuousClock.now + .seconds(2)
    repeat {
        if NSWorkspace.shared.frontmostApplication?.processIdentifier == application.processIdentifier,
           app.focusedWindow() == window { return }
        try await Task.sleep(for: .milliseconds(20))
    } while ContinuousClock.now < deadline
    throw MonitorError("The monitor's window did not receive focus")
}

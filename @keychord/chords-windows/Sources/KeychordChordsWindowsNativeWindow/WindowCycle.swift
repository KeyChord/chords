import AppKit
import AXorcistRuntime
import ApplicationServices

@MainActor private var cycleProcess: pid_t?
@MainActor private var cycleOrder: [CGWindowID] = []

@MainActor
func cycleWindows(bundleId: String?, direction: String) async throws {
    guard direction == "NEXT" || direction == "PREVIOUS" else { throw WindowError("Unknown window cycle direction") }
    guard AXPermissionHelpers.hasAccessibilityPermissions() else { throw WindowError("Accessibility permission is required to manage windows") }
    let application: NSRunningApplication?
    if let bundleId {
        application = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
    } else {
        application = NSWorkspace.shared.frontmostApplication
    }
    guard let application else { throw WindowError("The target application is not running") }
    let app = AXApp(application).element
    app.setMessagingTimeout(2)
    guard let info = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]],
          let windows = app.windows() else { throw WindowError("Could not read the application's windows") }
    let visible = info.compactMap { entry -> CGWindowID? in
        guard entry[kCGWindowOwnerPID as String] as? pid_t == application.processIdentifier,
              entry[kCGWindowLayer as String] as? Int == 0,
              (entry[kCGWindowAlpha as String] as? Double ?? 1) > 0 else { return nil }
        return entry[kCGWindowNumber as String] as? CGWindowID
    }
    let resolver = AXWindowResolver()
    var candidates: [CGWindowID: Element] = [:]
    for window in windows {
        guard window.subrole() == kAXStandardWindowSubrole,
              window.isMinimized() != true, window.isFullScreen() != true,
              let id = resolver.windowID(from: window), visible.contains(id) else { continue }
        candidates[id] = window
    }
    // Raising a window changes the WindowServer's front-to-back list. Retain the
    // ring so three or more windows remain reachable in either direction.
    if cycleProcess != application.processIdentifier {
        cycleProcess = application.processIdentifier
        cycleOrder = []
    }
    cycleOrder.removeAll { candidates[$0] == nil }
    cycleOrder.append(contentsOf: visible.filter { candidates[$0] != nil && !cycleOrder.contains($0) })
    guard cycleOrder.count > 1,
          let current = app.focusedWindow() ?? app.mainWindow(),
          let currentID = resolver.windowID(from: current),
          let index = cycleOrder.firstIndex(of: currentID) else { return }
    let offset = direction == "NEXT" ? 1 : -1
    let id = cycleOrder[(index + offset + cycleOrder.count) % cycleOrder.count]
    let window = candidates[id]!
    _ = try? window.setAttributeValue(true, forAttribute: kAXMainAttribute)
    guard application.activate(options: []) else { throw WindowError("Could not activate the target application") }
    do {
        try window.performAction(.raise)
    } catch let error as AccessibilitySystemError {
        throw WindowError("Could not focus the window (AX error \(error.axError.rawValue))")
    }
    let deadline = ContinuousClock.now + .seconds(2)
    repeat {
        if NSWorkspace.shared.frontmostApplication?.processIdentifier == application.processIdentifier,
           app.focusedWindow() == window { return }
        try await Task.sleep(for: .milliseconds(20))
    } while ContinuousClock.now < deadline
    throw WindowError("The target window did not receive focus")
}

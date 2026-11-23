import AppKit
import AXorcistRuntime
import ApplicationServices

@MainActor private var cycleProcess: pid_t?
@MainActor private var cycleOrder: [CGWindowID] = []

@MainActor
private func visibleWindows(_ app: Element, pid: pid_t, resolver: AXWindowResolver)
    throws -> (order: [CGWindowID], candidates: [CGWindowID: Element]) {
    guard let info = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]],
          let windows = app.windows() else { throw WindowError("Could not read the application's windows") }
    let order = info.compactMap { entry -> CGWindowID? in
        guard entry[kCGWindowOwnerPID as String] as? pid_t == pid,
              entry[kCGWindowLayer as String] as? Int == 0,
              (entry[kCGWindowAlpha as String] as? Double ?? 1) > 0 else { return nil }
        return entry[kCGWindowNumber as String] as? CGWindowID
    }
    var candidates: [CGWindowID: Element] = [:]
    for window in windows {
        guard window.subrole() == kAXStandardWindowSubrole,
              window.isMinimized() != true, window.isFullScreen() != true,
              let id = resolver.windowID(from: window), order.contains(id) else { continue }
        candidates[id] = window
    }
    return (order, candidates)
}

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
    let resolver = AXWindowResolver()
    let pid = application.processIdentifier
    let settle = ContinuousClock.now + .seconds(1)
    var snapshot = try visibleWindows(app, pid: pid, resolver: resolver)
    var focused = app.focusedWindow() ?? app.mainWindow()
    var focusedID = focused.flatMap { resolver.windowID(from: $0) }
    // AppKit can report a newly opened key window before WindowServer lists it on screen.
    while focused?.subrole() == kAXStandardWindowSubrole,
          focused?.isFullScreen() != true, focused?.isMinimized() != true,
          focusedID.flatMap({ snapshot.candidates[$0] }) == nil,
          ContinuousClock.now < settle {
        try await Task.sleep(for: .milliseconds(30))
        snapshot = try visibleWindows(app, pid: pid, resolver: resolver)
        focused = app.focusedWindow() ?? app.mainWindow()
        focusedID = focused.flatMap { resolver.windowID(from: $0) }
    }
    let candidates = snapshot.candidates
    // Raising a window changes the WindowServer's front-to-back list. Retain the
    // ring so three or more windows remain reachable in either direction.
    if cycleProcess != application.processIdentifier {
        cycleProcess = application.processIdentifier
        cycleOrder = []
    }
    cycleOrder.removeAll { candidates[$0] == nil }
    cycleOrder.append(contentsOf: snapshot.order.filter { candidates[$0] != nil && !cycleOrder.contains($0) })
    guard cycleOrder.count > 1 else { return }
    let offset = direction == "NEXT" ? 1 : -1
    let next = focusedID.flatMap { cycleOrder.firstIndex(of: $0) }.map {
        ($0 + offset + cycleOrder.count) % cycleOrder.count
    } ?? (offset == 1 ? 0 : cycleOrder.count - 1)
    let window = candidates[cycleOrder[next]]!
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

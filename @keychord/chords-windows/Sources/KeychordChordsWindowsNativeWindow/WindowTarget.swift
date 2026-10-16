import AppKit
import AXorcistRuntime
import ApplicationServices
import CoreGraphics

/// The window an action targets. Chord selects the window focused when a run starts and
/// passes its number to every repetition, so `3/ws]` keeps moving one window even though
/// focus moves to another window after the first move. Without a selection, the target
/// application's focused or main window is used.
struct TargetWindow {
    let id: CGWindowID?
    /// Missing only for a selected window outside the active desktop Space, which
    /// Accessibility does not report.
    let element: Element?

    func requireElement() throws -> Element {
        guard let element else { throw WindowError("The target window is not on the current desktop Space") }
        return element
    }
}

@MainActor
private func ownerProcess(of window: CGWindowID) -> pid_t? {
    // Unlike Accessibility, Core Graphics also describes windows on other Spaces.
    guard let info = CGWindowListCopyWindowInfo(.optionIncludingWindow, window) as? [[String: Any]],
          let entry = info.first,
          (entry[kCGWindowNumber as String] as? NSNumber)?.uint32Value == window,
          let owner = entry[kCGWindowOwnerPID as String] as? NSNumber else { return nil }
    return owner.int32Value
}

@MainActor
func targetWindow(bundleId: String?, windowId: Int?) throws -> TargetWindow {
    guard AXPermissionHelpers.hasAccessibilityPermissions() else { throw WindowError("Accessibility permission is required to manage windows") }
    guard let windowId else {
        let application: NSRunningApplication?
        if let bundleId { application = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first }
        else { application = NSWorkspace.shared.frontmostApplication }
        guard let application else { throw WindowError("The target application is not running") }
        let app = AXApp(application).element
        app.setMessagingTimeout(2)
        guard let window = app.focusedWindow() ?? app.mainWindow() else {
            throw WindowError("The target application has no focused or main window")
        }
        return TargetWindow(id: AXWindowResolver().windowID(from: window), element: window)
    }
    guard let id = CGWindowID(exactly: windowId) else { throw WindowError("Invalid target window number \(windowId)") }
    // Never fall back to the focused window: that is a different window than selected.
    guard let pid = ownerProcess(of: id), let application = NSRunningApplication(processIdentifier: pid) else {
        throw WindowError("The target window has closed")
    }
    let app = AXApp(application).element
    app.setMessagingTimeout(2)
    let resolver = AXWindowResolver()
    return TargetWindow(id: id, element: app.windows()?.first { resolver.windowID(from: $0) == id })
}

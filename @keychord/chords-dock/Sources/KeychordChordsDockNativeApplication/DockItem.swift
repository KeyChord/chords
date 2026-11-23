import AppKit
import ApplicationServices

private struct DockError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

private func attribute<T>(_ element: AXUIElement, _ name: String) -> T? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
    return value as? T
}

private func dockItems(_ root: AXUIElement, depth: Int) -> [AXUIElement] {
    var actions: CFArray?
    if AXUIElementCopyActionNames(root, &actions) == .success,
       let names = actions as? [String], names.contains(kAXPressAction),
       let role: String = attribute(root, kAXRoleAttribute), role == "AXDockItem" {
        return [root]
    }
    guard depth > 0 else { return [] }
    let children: [AXUIElement] = attribute(root, kAXChildrenAttribute) ?? []
    return children.flatMap { dockItems($0, depth: depth - 1) }
}

@MainActor
func runDockItem(index: Int, action: String) async throws {
    guard index > 0 else { throw DockError("Dock item numbers start at 1") }
    guard AXIsProcessTrusted() else { throw DockError("Grant Chord Accessibility access to control the Dock") }
    guard let dock = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.dock").first else {
        throw DockError("The Dock is not available")
    }
    let items = dockItems(AXUIElementCreateApplication(dock.processIdentifier), depth: 4)
    guard items.indices.contains(index - 1) else {
        throw DockError("Dock item \(index) does not exist (\(items.count) available)")
    }
    let item = items[index - 1]
    switch action {
    case "LEFT":
        let status = AXUIElementPerformAction(item, kAXPressAction as CFString)
        guard status == .success else {
            throw DockError("Could not open Dock item \(index) (AX error \(status.rawValue))")
        }
    case "FOCUS":
        if AXUIElementSetAttributeValue(item, kAXFocusedAttribute as CFString, kCFBooleanTrue) == .success,
           attribute(item, kAXFocusedAttribute) == true { return }
        try hoverDockItem(item, index: index)
    case "RIGHT":
        // The Dock can dismiss a menu shown for an item outside the hovered region.
        try? hoverDockItem(item, index: index)
        try await Task.sleep(for: .milliseconds(80))
        let status = AXUIElementPerformAction(item, kAXShowMenuAction as CFString)
        guard status == .success else {
            throw DockError("Could not show the Dock item \(index) menu (AX error \(status.rawValue))")
        }
    default:
        throw DockError("Unknown Dock item action: \(action)")
    }
}

private func hoverDockItem(_ item: AXUIElement, index: Int) throws {
    guard let position: AXValue = attribute(item, kAXPositionAttribute),
          let extent: AXValue = attribute(item, kAXSizeAttribute) else {
        throw DockError("Dock item \(index) has no visible position")
    }
    var origin = CGPoint.zero
    var size = CGSize.zero
    guard AXValueGetValue(position, .cgPoint, &origin),
          AXValueGetValue(extent, .cgSize, &size), size.width > 0, size.height > 0 else {
        throw DockError("Dock item \(index) has no visible position")
    }
    let center = CGPoint(x: origin.x + size.width / 2, y: origin.y + size.height / 2)
    guard center.x.isFinite, center.y.isFinite,
          CGWarpMouseCursorPosition(center) == .success,
          let event = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved,
                              mouseCursorPosition: center, mouseButton: .left) else {
        throw DockError("Could not move the pointer to Dock item \(index)")
    }
    event.post(tap: .cghidEventTap)
}

import AppKit
import ApplicationServices

private struct TabReorderError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

private func attribute<T>(_ element: AXUIElement, _ key: String) -> T? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, key as CFString, &value) == .success else { return nil }
    return value as? T
}

private func tabs(in root: AXUIElement, depth: Int = 0) -> [AXUIElement] {
    let children: [AXUIElement] = attribute(root, kAXChildrenAttribute) ?? []
    let role: String? = attribute(root, kAXRoleAttribute)
    let identifier: String? = attribute(root, kAXIdentifierAttribute)
    if role == kAXTabGroupRole || identifier?.hasPrefix("TabBar?") == true {
        let tabButtons = children.filter { attribute($0, kAXRoleAttribute) == kAXRadioButtonRole }
        if !tabButtons.isEmpty { return tabButtons }
    }
    guard depth < 6 else { return [] }
    for child in children {
        let group = tabs(in: child, depth: depth + 1)
        if !group.isEmpty { return group }
    }
    return []
}

private func frame(_ element: AXUIElement) throws -> CGRect {
    guard let position: AXValue = attribute(element, kAXPositionAttribute),
          let sizeValue: AXValue = attribute(element, kAXSizeAttribute) else {
        throw TabReorderError("Safari did not expose the tab's position")
    }
    var origin = CGPoint.zero
    var size = CGSize.zero
    guard AXValueGetValue(position, .cgPoint, &origin),
          AXValueGetValue(sizeValue, .cgSize, &size), size.width > 0, size.height > 0 else {
        throw TabReorderError("The Safari tab is outside the visible tab bar")
    }
    return CGRect(origin: origin, size: size)
}

private func isSelected(_ item: AXUIElement) -> Bool {
    (attribute(item, kAXValueAttribute) as NSNumber?)?.boolValue == true ||
        (attribute(item, kAXSelectedAttribute) as NSNumber?)?.boolValue == true
}

private func descendant(
    of root: AXUIElement, limit: Int, where predicate: (AXUIElement) -> Bool
) -> AXUIElement? {
    if predicate(root) { return root }
    guard limit > 0 else { return nil }
    let children: [AXUIElement] = attribute(root, kAXChildrenAttribute) ?? []
    for child in children {
        if let match = descendant(of: child, limit: limit - 1, where: predicate) { return match }
    }
    return nil
}

private func sidebar(in window: AXUIElement) -> AXUIElement? {
    descendant(of: window, limit: 5) {
        attribute($0, kAXIdentifierAttribute) == "LibraryView"
    }
}

private func tabGroups(in sidebar: AXUIElement) -> [AXUIElement] {
    let children: [AXUIElement] = attribute(sidebar, kAXRowsAttribute)
        ?? attribute(sidebar, kAXChildrenAttribute) ?? []
    return children.filter { row in
        descendant(of: row, limit: 3) {
            let id: String? = attribute($0, kAXIdentifierAttribute)
            return id?.hasPrefix("SidebarLibraryItemTabGroup?") == true
        } != nil
    }
}

private func groupName(_ row: AXUIElement) -> String? {
    descendant(of: row, limit: 4) {
        attribute($0, kAXIdentifierAttribute) == "LibraryItemCellTextField"
    }.flatMap { attribute($0, kAXValueAttribute) }
}

@MainActor
func moveSafariTabGroup(_ direction: String) async throws {
    guard direction == "LEFT" || direction == "RIGHT" else { throw TabReorderError("Unknown tab group direction") }
    guard AXIsProcessTrusted(),
          let safari = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Safari").first,
          safari.isActive else { throw TabReorderError("Focus a Safari window with Accessibility enabled") }
    let root = AXUIElementCreateApplication(safari.processIdentifier)
    guard let window: AXUIElement = attribute(root, kAXFocusedWindowAttribute) else {
        throw TabReorderError("Safari has no focused window")
    }
    var library = sidebar(in: window)
    var openedSidebar: AXUIElement?
    defer {
        if safari.isActive, let openedSidebar {
            _ = AXUIElementPerformAction(openedSidebar, kAXPressAction as CFString)
        }
    }
    if library == nil,
       let button = descendant(of: window, limit: 4, where: {
           attribute($0, kAXIdentifierAttribute) == "SidebarButton"
       }),
       AXUIElementPerformAction(button, kAXPressAction as CFString) == .success {
        openedSidebar = button
        let deadline = ContinuousClock.now + .seconds(1)
        repeat {
            try await Task.sleep(for: .milliseconds(30))
            library = sidebar(in: window)
        } while library == nil && ContinuousClock.now < deadline
    }
    guard let library else { throw TabReorderError("Safari did not expose its tab group sidebar") }
    let groups = tabGroups(in: library)
    guard let selected = groups.firstIndex(where: isSelected) else {
        throw TabReorderError("Could not locate Safari's selected tab group")
    }
    let next = selected + (direction == "LEFT" ? -1 : 1)
    guard groups.indices.contains(next) else { return }
    let name = groupName(groups[next])
    guard safari.isActive,
          AXUIElementSetAttributeValue(groups[next], kAXSelectedAttribute as CFString, kCFBooleanTrue) == .success else {
        throw TabReorderError("Could not select Safari's adjacent tab group")
    }
    let deadline = ContinuousClock.now + .seconds(3)
    repeat {
        if let current: AXUIElement = attribute(root, kAXFocusedWindowAttribute) {
            let title: String? = attribute(current, kAXTitleAttribute)
            if let name, title?.hasPrefix("\(name) —") == true { return }
            if let library = sidebar(in: current) {
                let rows = tabGroups(in: library)
                if rows.indices.contains(next), isSelected(rows[next]), groupName(rows[next]) == name { return }
            }
        }
        try await Task.sleep(for: .milliseconds(30))
    } while ContinuousClock.now < deadline
    throw TabReorderError("Safari did not switch to the adjacent tab group")
}

@MainActor
func moveSafariTab(_ direction: String) async throws {
    guard direction == "LEFT" || direction == "RIGHT" else { throw TabReorderError("Unknown tab direction") }
    guard AXIsProcessTrusted(),
          let safari = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.Safari").first,
          safari.isActive else { throw TabReorderError("Focus a Safari window with Accessibility enabled") }
    let root = AXUIElementCreateApplication(safari.processIdentifier)
    guard let window: AXUIElement = attribute(root, kAXFocusedWindowAttribute) else {
        throw TabReorderError("Safari has no focused window")
    }
    let ordered = tabs(in: window)
    guard let current = ordered.firstIndex(where: isSelected) else {
        throw TabReorderError("Could not locate Safari's selected tab")
    }
    let target = current + (direction == "LEFT" ? -1 : 1)
    guard ordered.indices.contains(target) else { return }
    let tabTitle: String? = attribute(ordered[current], kAXTitleAttribute)
    var lastIndex: Int?
    for _ in 0..<3 {
        guard safari.isActive else { throw TabReorderError("Safari lost focus while moving its tab") }
        let items = tabs(in: window)
        guard items.count == ordered.count,
              let index = items.firstIndex(where: isSelected),
              attribute(items[index], kAXTitleAttribute) == tabTitle else {
            throw TabReorderError("Safari's selected tab changed during the drag")
        }
        if index == target { return }
        let start = try frame(items[index])
        let destination = try frame(items[target])
        let landingX = target < index ? destination.minX + 2 :
            destination.minX + destination.width * (lastIndex == index ? 0.75 : 0.25)
        try await dragSafariTab(safari, from: start, to: CGPoint(x: landingX, y: destination.midY))
        lastIndex = index
        try await Task.sleep(for: .milliseconds(225))
    }
    let updated = tabs(in: window)
    if updated.indices.contains(target), isSelected(updated[target]),
       attribute(updated[target], kAXTitleAttribute) == tabTitle { return }
    throw TabReorderError("Safari did not move the selected tab one position \(direction.lowercased())")
}

@MainActor
private func dragSafariTab(_ safari: NSRunningApplication, from start: CGRect, to: CGPoint) async throws {
    let from = CGPoint(x: start.midX, y: start.midY)
    let system = AXUIElementCreateSystemWide()
    for point in [from, to] {
        var element: AXUIElement?
        var owner: pid_t = 0
        guard AXUIElementCopyElementAtPosition(system, Float(point.x), Float(point.y), &element) == .success,
              let element, AXUIElementGetPid(element, &owner) == .success, owner == safari.processIdentifier else {
            throw TabReorderError("Safari's selected or adjacent tab is covered")
        }
    }
    let source = CGEventSource(stateID: .hidSystemState)
    func event(_ type: CGEventType, point: CGPoint) throws -> CGEvent {
        guard let result = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: point,
                                   mouseButton: .left) else {
            throw TabReorderError("Could not create Safari tab drag")
        }
        result.setIntegerValueField(.mouseEventClickState, value: 1)
        return result
    }
    let down = try event(.leftMouseDown, point: from)
    let up = try event(.leftMouseUp, point: to)
    let drags = try (1...8).map { step in
        let portion = CGFloat(step) / 8
        let drag = try event(.leftMouseDragged, point: CGPoint(x: from.x + (to.x - from.x) * portion,
                                                               y: from.y + (to.y - from.y) * portion))
        drag.setIntegerValueField(.mouseEventDeltaX, value: Int64((to.x - from.x) / 8))
        drag.setIntegerValueField(.mouseEventDeltaY, value: Int64((to.y - from.y) / 8))
        return drag
    }
    guard CGWarpMouseCursorPosition(from) == .success else {
        throw TabReorderError("Could not move the pointer to Safari's selected tab")
    }
    try event(.mouseMoved, point: from).post(tap: .cghidEventTap)
    try await Task.sleep(for: .milliseconds(75))
    down.post(tap: .cghidEventTap)
    do {
        for drag in drags {
            try await Task.sleep(for: .milliseconds(25))
            guard safari.isActive else { throw TabReorderError("Safari lost focus while moving its tab") }
            guard CGWarpMouseCursorPosition(drag.location) == .success else {
                throw TabReorderError("Could not move the pointer during Safari's tab drag")
            }
            drag.post(tap: .cghidEventTap)
        }
        try await Task.sleep(for: .milliseconds(150))
    } catch {
        up.post(tap: .cghidEventTap)
        throw error
    }
    up.post(tap: .cghidEventTap)
}

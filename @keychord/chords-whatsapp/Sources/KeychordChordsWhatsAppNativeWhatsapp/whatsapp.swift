import AppKit
import ApplicationServices
import Foundation
import NodeAPI

private struct WhatsAppError: Error, CustomStringConvertible {
    let description: String
    init(_ message: String) { description = "WhatsApp: \(message)" }
}

private struct Request: Decodable, Sendable {
    enum Kind: String, Decodable, Sendable { case menu = "MENU", element = "ELEMENT", chat = "CHAT", grid = "GRID" }
    let kind: Kind
    let scope: String?
    let identifiers: [String]?
    let titlePrefix: String?
    let description: String?
    let descriptionPrefix: String?
    let unlessIdentifier: String?
    let unlessAny: [Selector]?
    let onlyIfAny: [Selector]?
    let scopeParent: Bool?
    let role: String?
    let index: Int?
    let row: Int?
    let column: Int?
    let click: Bool?
}

private struct Selector: Decodable, Sendable {
    let identifiers: [String]?
    let description: String?
    let role: String?
}

#NodeModule(exports: [
    "perform": try NodeFunction { (bundleId: String, json: String) throws -> NodePromise in
        let requests = try JSONDecoder().decode([Request].self, from: Data(json.utf8))
        return try mainActorPromise { try await perform(bundleId: bundleId, requests: requests) }
    },
])

@MainActor
private func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    AXUIElementCopyAttributeValue(element, name as CFString, &value)
    return value
}

@MainActor
private func children(_ element: AXUIElement) -> [AXUIElement] {
    attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? []
}

// WhatsApp prefixes menu identifiers and titles with direction markers.
private let ignoredCharacters = CharacterSet.controlCharacters.union(
    CharacterSet(charactersIn: "\u{200B}\u{200C}\u{200D}\u{200E}\u{200F}\u{FEFF}\u{202A}\u{202B}\u{202C}\u{202D}\u{202E}")
)

private func clean(_ value: String) -> String {
    String(value.unicodeScalars.filter { !ignoredCharacters.contains($0) })
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

@MainActor
private func find(_ root: AXUIElement, matching: @MainActor (AXUIElement) -> Bool) throws -> [AXUIElement] {
    var results: [AXUIElement] = []
    var visited: [AXUIElement] = []
    @MainActor func walk(_ element: AXUIElement, depth: Int) throws {
        guard depth < 30 else { return }
        for seen in visited { if CFEqual(seen, element) { return } }
        guard visited.count < 5000 else { throw WhatsAppError("accessibility tree is too large") }
        visited.append(element)
        if matching(element) { results.append(element) }
        // Action discovery never needs message history.
        if clean(attribute(element, kAXIdentifierAttribute) as? String ?? "") == "ChatMessagesTableView" { return }
        for child in children(element) { try walk(child, depth: depth + 1) }
    }
    try walk(root, depth: 0)
    return results
}

@MainActor
private func select(_ root: AXUIElement, request: Request) throws -> AXUIElement? {
    let matches = try find(root) { element in
        let identifier = clean(attribute(element, kAXIdentifierAttribute) as? String ?? "")
        let title = clean(attribute(element, kAXTitleAttribute) as? String ?? "")
        let description = clean(attribute(element, kAXDescriptionAttribute) as? String ?? "")
        if let role = request.role, attribute(element, kAXRoleAttribute) as? String != role { return false }
        return request.identifiers?.contains(identifier) == true
            || (request.titlePrefix.map { title.hasPrefix($0) } ?? false)
            || (request.description.map { description == $0 || description.hasPrefix($0 + ",") || title == $0 || title.hasPrefix($0 + ",") } ?? false)
            || (request.descriptionPrefix.map { description.hasPrefix($0) || title.hasPrefix($0) } ?? false)
    }
    let enabled = matches.filter { (attribute($0, kAXEnabledAttribute) as? Bool) != false }
    let label = request.identifiers?.joined(separator: "/") ?? request.titlePrefix ?? request.description ?? "control"
    guard !matches.isEmpty else { return nil }
    guard !enabled.isEmpty else { throw WhatsAppError("\(label) is disabled in the current context") }
    guard enabled.count == 1 else { throw WhatsAppError("\(label) is ambiguous (\(enabled.count) controls)") }
    return enabled[0]
}

@MainActor
private func activate(_ bundleId: String) async throws -> NSRunningApplication {
    let workspace = NSWorkspace.shared
    var app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
    if app == nil {
        guard let url = workspace.urlForApplication(withBundleIdentifier: bundleId) else {
            throw WhatsAppError("application \(bundleId) is not installed")
        }
        workspace.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration(), completionHandler: nil)
        let deadline = Date(timeIntervalSinceNow: 5)
        while app == nil && Date() < deadline {
            try await Task.sleep(for: .milliseconds(50))
            app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
        }
    }
    guard let app else { throw WhatsAppError("application did not launch") }
    app.unhide()
    app.activate()
    let deadline = Date(timeIntervalSinceNow: 2)
    func isFrontmost() -> Bool {
        app.isActive && workspace.frontmostApplication?.processIdentifier == app.processIdentifier
    }
    while !isFrontmost() && !app.isTerminated && Date() < deadline {
        try await Task.sleep(for: .milliseconds(20))
    }
    guard isFrontmost(), !app.isTerminated else { throw WhatsAppError("application did not become active") }
    return app
}

@MainActor
private func contains(_ application: AXUIElement, selectors: [Selector]) throws -> Bool {
    for selector in selectors {
        let matches = try find(application) { element in
            if let role = selector.role, attribute(element, kAXRoleAttribute) as? String != role { return false }
            let identifier = clean(attribute(element, kAXIdentifierAttribute) as? String ?? "")
            let description = clean(attribute(element, kAXDescriptionAttribute) as? String ?? "")
            let title = clean(attribute(element, kAXTitleAttribute) as? String ?? "")
            let value = clean(attribute(element, kAXValueAttribute) as? String ?? "")
            return selector.identifiers?.contains(identifier) == true || (selector.description.map { description == $0 || title == $0 || value == $0 } ?? false)
        }
        if !matches.isEmpty { return true }
    }
    return false
}

@MainActor
private func frame(_ element: AXUIElement) throws -> CGRect {
    guard let position = attribute(element, kAXPositionAttribute), CFGetTypeID(position) == AXValueGetTypeID(),
          let size = attribute(element, kAXSizeAttribute), CFGetTypeID(size) == AXValueGetTypeID() else { throw WhatsAppError("control has no accessible bounds") }
    var origin = CGPoint.zero
    var extent = CGSize.zero
    guard AXValueGetValue(unsafeDowncast(position, to: AXValue.self), .cgPoint, &origin),
          AXValueGetValue(unsafeDowncast(size, to: AXValue.self), .cgSize, &extent),
          origin.x.isFinite, origin.y.isFinite, extent.width.isFinite, extent.height.isFinite,
          extent.width > 0, extent.height > 0 else { throw WhatsAppError("control is not visible") }
    return CGRect(origin: origin, size: extent)
}

@MainActor
private func gridControl(_ application: AXUIElement, request: Request) throws -> AXUIElement? {
    guard let row = request.row, let column = request.column, (1...9).contains(row), (1...9).contains(column) else {
        throw WhatsAppError("palette position must be row,column (1–9)")
    }
    // Palette buttons have a value describing the colour/image. Navigation
    // buttons can share the label, but do not have a value.
    let controls = try find(application) {
        attribute($0, kAXRoleAttribute) as? String == kAXButtonRole
            && (clean(attribute($0, kAXDescriptionAttribute) as? String ?? "") == request.description
                || clean(attribute($0, kAXTitleAttribute) as? String ?? "") == request.description)
            && !clean(attribute($0, kAXValueAttribute) as? String ?? "").isEmpty
    }
    if controls.isEmpty { return nil }
    let windows = controls.compactMap { attribute($0, kAXWindowAttribute) }
    guard let window = windows.first, windows.allSatisfy({ CFEqual($0, window) }) else { throw WhatsAppError("palette is ambiguous across windows") }
    let positioned = try controls.map { ($0, try frame($0)) }.sorted {
        if $0.1.midY != $1.1.midY { return $0.1.midY < $1.1.midY }
        return $0.1.midX < $1.1.midX
    }
    var rows: [[(AXUIElement, CGRect)]] = []
    for control in positioned {
        if let last = rows.last, abs(last[0].1.midY - control.1.midY) <= 2 {
            rows[rows.count - 1].append(control)
        } else { rows.append([control]) }
    }
    guard rows.count >= row, rows[row - 1].count >= column else { throw WhatsAppError("palette row \(row), column \(column) is unavailable") }
    let target = rows[row - 1].sorted { $0.1.midX < $1.1.midX }[column - 1].0
    guard (attribute(target, kAXEnabledAttribute) as? Bool) != false else { throw WhatsAppError("palette control is disabled") }
    return target
}

@MainActor
private func perform(bundleId: String, requests: [Request]) async throws -> String {
    guard AXIsProcessTrusted() else { throw WhatsAppError("Chord needs Accessibility permission") }
    let app = try await activate(bundleId)
    let application = AXUIElementCreateApplication(app.processIdentifier)
    AXUIElementSetMessagingTimeout(application, 2)
    for (index, request) in requests.enumerated() {
        let deadline = Date(timeIntervalSinceNow: 2)
        var target: AXUIElement?
        while target == nil {
            // Navigation animations can finish after AXPress returns. Recheck
            // page guards while waiting so a newly opened page can skip a step.
            if let selectors = request.onlyIfAny, try !contains(application, selectors: selectors) { break }
            if let selectors = request.unlessAny, try contains(application, selectors: selectors) { break }
            if let identifier = request.unlessIdentifier,
               !(try find(application) { clean(attribute($0, kAXIdentifierAttribute) as? String ?? "") == identifier }).isEmpty { break }
            guard !app.isTerminated else { throw WhatsAppError("application exited during the action") }
            switch request.kind {
            case .menu:
                if let value = attribute(application, kAXMenuBarAttribute), CFGetTypeID(value) == AXUIElementGetTypeID() {
                    let bar = unsafeDowncast(value, to: AXUIElement.self)
                    guard let scope = request.scope else { throw WhatsAppError("missing menu scope") }
                    let menus = children(bar).filter { clean(attribute($0, kAXIdentifierAttribute) as? String ?? "") == scope }
                    if menus.count == 1 { target = try select(menus[0], request: request) }
                }
            case .element:
                if let scope = request.scope {
                    let roots = try find(application) { clean(attribute($0, kAXIdentifierAttribute) as? String ?? "") == scope }
                    guard roots.count <= 1 else { throw WhatsAppError("ambiguous UI scope \(scope)") }
                    if let root = roots.first {
                        if request.scopeParent == true, let parent = attribute(root, kAXParentAttribute), CFGetTypeID(parent) == AXUIElementGetTypeID() {
                            target = try select(unsafeDowncast(parent, to: AXUIElement.self), request: request)
                        } else { target = try select(root, request: request) }
                    }
                } else { target = try select(application, request: request) }
            case .chat:
                guard let index = request.index, (1...9).contains(index) else { throw WhatsAppError("chat index must be between 1 and 9") }
                let tables = try find(application) { clean(attribute($0, kAXIdentifierAttribute) as? String ?? "") == "ChatListView_TableView" }
                guard tables.count <= 1 else { throw WhatsAppError("multiple chat lists are open") }
                if let table = tables.first {
                    // Catalyst exposes loaded chat rows as direct buttons. Filter/archive
                    // cells are containers and must not shift the numbered chat positions.
                    let rows = children(table).filter {
                        attribute($0, kAXRoleAttribute) as? String == kAXButtonRole
                            && !clean(attribute($0, kAXIdentifierAttribute) as? String ?? "").hasPrefix("ChatListView_")
                    }
                    guard rows.count >= index else { throw WhatsAppError("chat #\(index) is not loaded; scroll the chat list into view") }
                    target = rows[index - 1]
                }
            case .grid:
                target = try gridControl(application, request: request)
            }
            if target == nil {
                guard Date() < deadline else {
                    let label = request.identifiers?.joined(separator: "/") ?? request.description ?? request.titlePrefix ?? "chat list"
                    throw WhatsAppError("\(label) is unavailable in the current window or app version")
                }
                try await Task.sleep(for: .milliseconds(25))
            }
        }
        guard let target else { continue }
        var actions: CFArray?
        AXUIElementCopyActionNames(target, &actions)
        if request.click == true || (actions as? [String])?.contains(kAXPressAction) != true {
            guard request.kind != .menu, index == requests.count - 1 else { throw WhatsAppError("control has no press action") }
            return try clickTarget(target, processId: app.processIdentifier)
        }
        // Never retry a dispatched press: AX cannotComplete can mean the callback
        // ran even though its reply timed out.
        let error = AXUIElementPerformAction(target, kAXPressAction as CFString)
        guard error == .success else { throw WhatsAppError("control invocation failed (AX \(error.rawValue))") }
    }
    return ""
}

@MainActor
private func clickTarget(_ element: AXUIElement, processId: pid_t) throws -> String {
    guard let window = attribute(element, kAXWindowAttribute), CFGetTypeID(window) == AXUIElementGetTypeID() else { throw WhatsAppError("control has no containing window") }
    let bounds = try frame(unsafeDowncast(window, to: AXUIElement.self))
    let control = try frame(element)
    let point = CGPoint(x: control.midX, y: control.midY)
    guard point.x.isFinite, point.y.isFinite, bounds.contains(point) else { throw WhatsAppError("control is outside the visible window; scroll it into view") }
    let data = try JSONSerialization.data(withJSONObject: [
        "processId": processId,
        "point": ["x": point.x, "y": point.y],
        "bounds": ["x": bounds.minX, "y": bounds.minY, "width": bounds.width, "height": bounds.height],
    ])
    return String(decoding: data, as: UTF8.self)
}

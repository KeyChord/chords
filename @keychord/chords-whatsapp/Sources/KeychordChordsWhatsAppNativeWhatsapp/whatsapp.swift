import AppKit
import AXorcistRuntime
import ApplicationServices
import ChordNodeSupport
import Foundation
import NodeAPI

private struct WhatsAppError: Error, CustomStringConvertible {
    let description: String
    init(_ message: String) { description = "WhatsApp: \(message)" }
}

private struct Request: Decodable, Sendable {
    enum Kind: String, Decodable, Sendable {
        case menu = "MENU", element = "ELEMENT", chat = "CHAT", grid = "GRID"
        case participant = "PARTICIPANT"
        case device = "DEVICE", dismissPopover = "DISMISS_POPOVER"
        case groupPermissions = "GROUP_PERMISSIONS", verify = "VERIFY"
    }
    let kind: Kind
    let scope: String?
    let identifiers: [String]?
    let titlePrefix: String?
    let description: String?
    let descriptions: [String]?
    let descriptionPrefix: String?
    let descriptionSuffix: String?
    let unlessIdentifier: String?
    let unlessAny: [Selector]?
    let onlyIfAny: [Selector]?
    let scopeParent: Bool?
    let scopeAncestor: Int?
    let scroll: Bool?
    let optional: Bool?
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

// Keep AXChildren order: numbered chats and palette positions follow the displayed order.
@MainActor
private func children(_ element: Element) -> [Element] {
    (element.attribute(Attribute<[AXUIElement]>(kAXChildrenAttribute)) ?? []).map(Element.init)
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
private func find(_ root: Element, matching: @MainActor (Element) -> Bool) throws -> [Element] {
    var results: [Element] = []
    var visited: [Element] = []
    @MainActor func walk(_ element: Element, depth: Int) throws {
        guard depth < 30 else { return }
        guard !visited.contains(element) else { return }
        guard visited.count < 5000 else { throw WhatsAppError("accessibility tree is too large") }
        visited.append(element)
        if matching(element) { results.append(element) }
        // Action discovery never needs message history.
        if clean(element.identifier() ?? "") == "ChatMessagesTableView" { return }
        for child in children(element) { try walk(child, depth: depth + 1) }
    }
    try walk(root, depth: 0)
    return results
}

@MainActor
private func select(_ root: Element, request: Request) throws -> Element? {
    let matches = try find(root) { element in
        let identifier = clean(element.identifier() ?? "")
        let title = clean(element.title() ?? "")
        let description = clean(element.descriptionText() ?? "")
        if let role = request.role, element.role() != role { return false }
        return request.identifiers?.contains(identifier) == true
            || (request.titlePrefix.map { title.hasPrefix($0) } ?? false)
            || (request.description.map { description == $0 || description.hasPrefix($0 + ",") || title == $0 || title.hasPrefix($0 + ",") } ?? false)
            || (request.descriptions?.contains { description == $0 || description.hasPrefix($0 + ",") || title == $0 || title.hasPrefix($0 + ",") } ?? false)
            || (request.descriptionPrefix.map { description.hasPrefix($0) || title.hasPrefix($0) } ?? false)
            || (request.descriptionSuffix.map { description.hasSuffix($0) || title.hasSuffix($0) } ?? false)
    }
    let enabled = matches.filter { ($0.isEnabled()) != false }
    let label = request.identifiers?.joined(separator: "/") ?? request.titlePrefix ?? request.description ?? request.descriptions?.joined(separator: "/") ?? request.descriptionSuffix ?? "control"
    guard !matches.isEmpty else { return nil }
    if let index = request.index {
        guard index > 0, index <= matches.count else { throw WhatsAppError("\(label) #\(index) is unavailable") }
        let windows = matches.compactMap { $0.attribute(Attribute<AXUIElement>(kAXWindowAttribute)).map(Element.init) }
        guard windows.count == matches.count, let window = windows.first,
              windows.allSatisfy({ $0 == window }) else { throw WhatsAppError("\(label) is ambiguous across windows") }
        let target = matches[index - 1]
        guard target.isEnabled() != false else { throw WhatsAppError("\(label) #\(index) is disabled") }
        return target
    }
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
private func contains(_ application: Element, selectors: [Selector]) throws -> Bool {
    for selector in selectors {
        let matches = try find(application) { element in
            if let role = selector.role, element.role() != role { return false }
            let identifier = clean(element.identifier() ?? "")
            let description = clean(element.descriptionText() ?? "")
            let title = clean(element.title() ?? "")
            let value = clean(element.attribute(Attribute<String>(kAXValueAttribute)) ?? "")
            return selector.identifiers?.contains(identifier) == true || (selector.description.map { description == $0 || title == $0 || value == $0 } ?? false)
        }
        if !matches.isEmpty { return true }
    }
    return false
}

@MainActor
private func frame(_ element: Element) throws -> CGRect {
    guard let frame = element.frame() else { throw WhatsAppError("control has no accessible bounds") }
    guard frame.origin.x.isFinite, frame.origin.y.isFinite, frame.width.isFinite, frame.height.isFinite,
          frame.width > 0, frame.height > 0 else { throw WhatsAppError("control is not visible") }
    return frame
}

@MainActor
private func gridControl(_ application: Element, request: Request) throws -> Element? {
    guard let row = request.row, let column = request.column, (1...9).contains(row), (1...9).contains(column) else {
        throw WhatsAppError("palette position must be row,column (1–9)")
    }
    // Palette buttons have a value describing the colour/image. Navigation
    // buttons can share the label, but do not have a value.
    let controls = try find(application) {
        $0.role() == kAXButtonRole
            && (clean($0.descriptionText() ?? "") == request.description
                || clean($0.title() ?? "") == request.description)
            && !clean($0.attribute(Attribute<String>(kAXValueAttribute)) ?? "").isEmpty
    }
    if controls.isEmpty { return nil }
    let windows = controls.compactMap { $0.attribute(Attribute<AXUIElement>(kAXWindowAttribute)).map(Element.init) }
    guard let window = windows.first, windows.allSatisfy({ $0 == window }) else { throw WhatsAppError("palette is ambiguous across windows") }
    let positioned = try controls.map { ($0, try frame($0)) }.sorted {
        if $0.1.midY != $1.1.midY { return $0.1.midY < $1.1.midY }
        return $0.1.midX < $1.1.midX
    }
    var rows: [[(Element, CGRect)]] = []
    for control in positioned {
        if let last = rows.last, abs(last[0].1.midY - control.1.midY) <= 2 {
            rows[rows.count - 1].append(control)
        } else { rows.append([control]) }
    }
    guard rows.count >= row, rows[row - 1].count >= column else { throw WhatsAppError("palette row \(row), column \(column) is unavailable") }
    let target = rows[row - 1].sorted { $0.1.midX < $1.1.midX }[column - 1].0
    guard (target.isEnabled()) != false else { throw WhatsAppError("palette control is disabled") }
    return target
}

private let deviceSections = ["Camera", "Microphone", "Speaker"]

@MainActor
private func label(_ element: Element) -> String {
    [element.descriptionText(), element.title(), element.attribute(Attribute<String>(kAXValueAttribute))]
        .compactMap { $0.map(clean) }.first { !$0.isEmpty } ?? ""
}

@MainActor
private func deviceControl(_ application: Element, request: Request) throws -> Element? {
    guard let section = request.description, deviceSections.contains(section),
          let index = request.index, index > 0 else { throw WhatsAppError("invalid device choice") }
    let popovers = try find(application) { $0.role() == "AXPopover" }
    var choices: [[Element]] = []
    for popover in popovers {
        let elements = try find(popover) { _ in true }
        var currentSection: String?
        var controls: [Element] = []
        for element in elements {
            if element.role() == "AXHeading" {
                // Catalyst headings can carry their label on a child heading/text.
                currentSection = try find(element) { deviceSections.contains(label($0)) }.first.map(label)
            } else if currentSection == section, element.role() == kAXStaticTextRole,
                      !label(element).isEmpty, !deviceSections.contains(label(element)) {
                controls.append(element)
            }
        }
        if !controls.isEmpty { choices.append(controls) }
    }
    guard !choices.isEmpty else { return nil }
    guard choices.count == 1 else { throw WhatsAppError("\(section) choices are ambiguous across popovers") }
    guard index <= choices[0].count else { throw WhatsAppError("\(section) #\(index) is unavailable") }
    let target = choices[0][index - 1]
    guard target.isEnabled() != false else { throw WhatsAppError("\(section) #\(index) is disabled") }
    return target
}

@MainActor
private func scopedRoot(_ application: Element, request: Request) throws -> Element? {
    guard let scope = request.scope else { return application }
    let roots = try find(application) { clean($0.identifier() ?? "") == scope }
    guard roots.count <= 1 else { throw WhatsAppError("ambiguous UI scope \(scope)") }
    guard var root = roots.first else { return nil }
    for _ in 0..<(request.scopeAncestor ?? (request.scopeParent == true ? 1 : 0)) {
        guard let parent = root.parent() else { throw WhatsAppError("missing UI scope parent") }
        root = parent
    }
    return root
}

// WhatsApp 26.38 renders Group permissions but omits it (and the next two
// rows) from AXChildren. Use the adjacent, named rows to locate its first row,
// only inside Group Info. The JS handler verifies the destination after the
// window-targeted click; no group setting is changed by opening this page.
@MainActor
private func groupPermissionsPoint(_ root: Element) throws -> CGPoint? {
    func unique(_ prefix: String, role: String) throws -> Element? {
        let matches = try find(root) {
            $0.role() == role && (label($0) == prefix || label($0).hasPrefix(prefix + ","))
        }
        guard matches.count <= 1 else { throw WhatsAppError("ambiguous Group Info row \(prefix)") }
        return matches.first
    }
    guard let window = root.attribute(Attribute<AXUIElement>(kAXWindowAttribute)).map(Element.init),
          try find(window, matching: { clean($0.identifier() ?? "") == "NavigationBar_GroupInfoQRButton" }).count == 1,
          let mute = try unique("Mute", role: kAXButtonRole),
          let notify = try unique("Notify for", role: kAXButtonRole),
          let disappearing = try unique("Disappearing messages", role: kAXStaticTextRole),
          let similar = try unique("Create a similar group", role: kAXButtonRole),
          let muteFrame = try? frame(mute), let notifyFrame = try? frame(notify),
          let anchor = try? frame(disappearing), let end = try? frame(similar),
          let viewport = try? frame(root) else { return nil }
    let rowHeight = notifyFrame.midY - muteFrame.midY
    let tolerance = max(2, rowHeight * 0.1)
    guard (20...100).contains(rowHeight),
          abs(muteFrame.midX - notifyFrame.midX) <= tolerance,
          abs(anchor.midX - muteFrame.midX) <= tolerance,
          abs(anchor.height - rowHeight) <= tolerance,
          abs(muteFrame.height - rowHeight) <= tolerance,
          abs(notifyFrame.height - rowHeight) <= tolerance,
          end.minY - anchor.midY >= rowHeight * 3,
          end.minY - anchor.midY <= rowHeight * 6 else { return nil }
    let point = CGPoint(x: anchor.midX, y: anchor.midY + rowHeight)
    guard viewport.contains(anchor), viewport.contains(point), viewport.contains(CGPoint(x: end.midX, y: end.minY)),
          point.y > anchor.maxY, point.y < end.minY else { return nil }
    // A newly accessible row at this position makes the layout unknown. Do
    // not substitute its action for the inaccessible permissions control.
    let occupied = try find(root) {
        ($0.isActionSupported(kAXPressAction) || $0.role() == kAXStaticTextRole)
            && ($0.frame()?.contains(point) == true)
    }
    guard occupied.isEmpty else { return nil }
    return point
}

// Catalyst only exposes some rows while they are on screen. Search from the
// top, then down, stopping at an unchanged viewport or a bounded deadline.
@MainActor
private func scrollSearch(_ root: Element, down: inout Bool, previous: inout String?) throws -> Bool {
    let fingerprint = try find(root) { _ in true }.map {
        "\(clean($0.identifier() ?? ""))|\(label($0))|\(String(describing: $0.frame()))"
    }.joined(separator: "\n")
    if previous == fingerprint {
        if down { return false }
        down = true
    }
    previous = fingerprint
    let action = down ? "AXScrollDown" : "AXScrollUp"
    let containers = try find(root) { $0.isActionSupported(action) }
    guard containers.count <= 1 else { throw WhatsAppError("ambiguous scroll area") }
    if let container = containers.first {
        do { try container.performAction(action) }
        catch let error as AccessibilitySystemError {
            throw WhatsAppError("\(action) failed (AX \(error.axError.rawValue))")
        }
        return true
    }
    if !down {
        down = true
        previous = nil
        return try scrollSearch(root, down: &down, previous: &previous)
    }
    return false
}

@MainActor
private func participantControl(_ application: Element, request: Request) throws -> Element? {
    guard let index = request.index, index > 0 else { throw WhatsAppError("group member index must be positive") }
    let tables = try find(application) { clean($0.identifier() ?? "") == "ParticipantPicker_TableView" }
    guard tables.count <= 1 else { throw WhatsAppError("multiple group member pickers are open") }
    guard let table = tables.first else { return nil }
    let identifiers = ["ParticipantPicker_ContactCell", "ParticipantPicker_SuggestedContactCell"]
    let rows = children(table).filter { identifiers.contains(clean($0.identifier() ?? "")) }
    guard index <= rows.count else { throw WhatsAppError("group member #\(index) is not loaded; scroll the member picker into view") }
    let row = rows[index - 1]
    // The row and its switch share an ID. Count each direct row once, then
    // invoke its switch, keeping headings and selection chips out of numbering.
    let target = children(row).first { identifiers.contains(clean($0.identifier() ?? "")) && $0.isActionSupported(kAXPressAction) } ?? row
    guard target.isEnabled() != false else { throw WhatsAppError("group member #\(index) is disabled") }
    return target
}

@MainActor
private func perform(bundleId: String, requests: [Request]) async throws -> String {
    guard AXPermissionHelpers.hasAccessibilityPermissions() else { throw WhatsAppError("Chord needs Accessibility permission") }
    let app = try await activate(bundleId)
    let application = AXApp(app).element
    application.setMessagingTimeout(2)
    for (index, request) in requests.enumerated() {
        let deadline = Date(timeIntervalSinceNow: request.scroll == true ? 5 : 2)
        var target: Element?
        var scrollDown = false
        var previousViewport: String?
        var scrollAttempts = 0
        search: while target == nil {
            // Navigation animations can finish after AXPress returns. Recheck
            // page guards while waiting so a newly opened page can skip a step.
            if let selectors = request.onlyIfAny, try !contains(application, selectors: selectors) { break }
            if let selectors = request.unlessAny, try contains(application, selectors: selectors) { break }
            if let identifier = request.unlessIdentifier,
               !(try find(application) { clean($0.identifier() ?? "") == identifier }).isEmpty { break }
            guard !app.isTerminated else { throw WhatsAppError("application exited during the action") }
            switch request.kind {
            case .dismissPopover:
                let popovers = try find(application) { $0.role() == "AXPopover" }.filter {
                    try contains($0, selectors: deviceSections.map { Selector(identifiers: nil, description: $0, role: nil) })
                }
                guard popovers.count <= 1 else { throw WhatsAppError("multiple call device popovers are open") }
                target = popovers.first
                if target == nil { break search }
            case .menu:
                if let bar = application.menuBar() {
                    guard let scope = request.scope else { throw WhatsAppError("missing menu scope") }
                    let menus = children(bar).filter { clean($0.identifier() ?? "") == scope }
                    if menus.count == 1 { target = try select(menus[0], request: request) }
                }
            case .verify:
                target = try select(application, request: request)
            case .element, .groupPermissions:
                if let root = try scopedRoot(application, request: request) {
                    target = try select(root, request: request)
                    if target == nil, request.kind == .groupPermissions,
                       let point = try groupPermissionsPoint(root) {
                        guard index == requests.count - 1 else { throw WhatsAppError("permissions click must be the final native step") }
                        return try clickTarget(root, point: point, processId: app.processIdentifier)
                    }
                    if target == nil, request.scroll == true, scrollAttempts < 24, Date() < deadline,
                       try scrollSearch(root, down: &scrollDown, previous: &previousViewport) {
                        scrollAttempts += 1
                        try await Task.sleep(for: .milliseconds(100))
                        continue search
                    }
                }
            case .participant:
                target = try participantControl(application, request: request)
            case .chat:
                guard let index = request.index, index > 0 else { throw WhatsAppError("chat index must be positive") }
                let tables = try find(application) { clean($0.identifier() ?? "") == "ChatListView_TableView" }
                guard tables.count <= 1 else { throw WhatsAppError("multiple chat lists are open") }
                if let table = tables.first {
                    // Catalyst exposes loaded chat rows as direct buttons. Filter/archive
                    // cells are containers and must not shift the numbered chat positions.
                    let rows = children(table).filter {
                        !clean($0.identifier() ?? "").hasPrefix("ChatListView_")
                            && ($0.role() == kAXButtonRole || clean($0.help() ?? "").contains("Double tap to open chat"))
                    }
                    guard rows.count >= index else { throw WhatsAppError("chat #\(index) is not loaded; scroll the chat list into view") }
                    target = rows[index - 1]
                }
            case .grid:
                target = try gridControl(application, request: request)
            case .device:
                target = try deviceControl(application, request: request)
            }
            if target == nil {
                if Date() >= deadline {
                    if request.optional == true { break search }
                    let label = request.identifiers?.joined(separator: "/") ?? request.description ?? request.descriptions?.joined(separator: "/") ?? request.titlePrefix ?? "chat list"
                    if request.kind == .verify { throw WhatsAppError("\(label) did not open") }
                    throw WhatsAppError("\(label) is unavailable in the current window or app version")
                }
                try await Task.sleep(for: .milliseconds(25))
            }
        }
        guard let target else { continue }
        if request.kind == .verify { continue }
        if request.kind == .dismissPopover {
            guard target.isActionSupported(kAXCancelAction) else { throw WhatsAppError("device popover cannot be dismissed; close it first") }
            try target.performAction(kAXCancelAction)
            continue
        }
        if request.click == true || !target.isActionSupported(kAXPressAction) {
            guard request.kind != .menu, index == requests.count - 1 else { throw WhatsAppError("control has no press action") }
            return try clickTarget(target, processId: app.processIdentifier)
        }
        // Never retry a dispatched press: AX cannotComplete can mean the callback
        // ran even though its reply timed out.
        do {
            try target.performAction(.press)
        } catch let error as AccessibilitySystemError {
            throw WhatsAppError("control invocation failed (AX \(error.axError.rawValue))")
        }
    }
    return ""
}

@MainActor
private func clickTarget(_ element: Element, point: CGPoint? = nil, processId: pid_t) throws -> String {
    guard let window = element.attribute(Attribute<AXUIElement>(kAXWindowAttribute)).map(Element.init) else { throw WhatsAppError("control has no containing window") }
    let bounds = try frame(window)
    let control = try frame(element)
    let point = point ?? CGPoint(x: control.midX, y: control.midY)
    guard point.x.isFinite, point.y.isFinite, bounds.contains(point) else { throw WhatsAppError("control is outside the visible window; scroll it into view") }
    let data = try JSONSerialization.data(withJSONObject: [
        "processId": processId,
        "point": ["x": point.x, "y": point.y],
        "bounds": ["x": bounds.minX, "y": bounds.minY, "width": bounds.width, "height": bounds.height],
    ])
    return String(decoding: data, as: UTF8.self)
}

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

// WhatsApp disables its menu items while a sheet or popover transitions, so a
// disabled control is retried until the step's deadline.
private struct Disabled: Error, CustomStringConvertible {
    let label: String
    var description: String { "WhatsApp: \(label) is disabled in the current context" }
}

private struct Request: Decodable, Sendable {
    enum Kind: String, Decodable, Sendable {
        case menu = "MENU", element = "ELEMENT", chat = "CHAT", grid = "GRID"
        case participant = "PARTICIPANT", member = "MEMBER"
        case device = "DEVICE", dismissPopover = "DISMISS_POPOVER"
        case groupPermissions = "GROUP_PERMISSIONS", verify = "VERIFY"
        case filter = "FILTER", filterSelected = "FILTER_SELECTED", openChat = "OPEN_CHAT"
        case openWindow = "OPEN_WINDOW", searchChat = "SEARCH_CHAT"
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
    let scopeAncestorRole: String?
    let scroll: Bool?
    let optional: Bool?
    let missing: String?
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
private func select(_ roots: [Element], request: Request) throws -> Element? {
    var matches: [Element] = []
    for root in roots {
        for match in try find(root, matching: { element in
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
        }) where !matches.contains(match) { matches.append(match) }
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
    guard !enabled.isEmpty else { throw Disabled(label: label) }
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

// Returns nil until the scope is on screen. An ancestor-role scope (the popover of
// an action sheet title) can briefly match two sheets while one replaces the other.
@MainActor
private func scopedRoots(_ application: Element, request: Request) throws -> [Element]? {
    guard let scope = request.scope else { return [application] }
    let anchors = try find(application) { clean($0.identifier() ?? "") == scope }
    if let role = request.scopeAncestorRole {
        var roots: [Element] = []
        for anchor in anchors {
            var current = anchor.parent()
            var depth = 0
            while let element = current, element.role() != role, depth < 16 {
                current = element.parent()
                depth += 1
            }
            if let root = current, root.role() == role, !roots.contains(root) { roots.append(root) }
        }
        return roots.isEmpty ? nil : roots
    }
    guard anchors.count <= 1 else { throw WhatsAppError("ambiguous UI scope \(scope)") }
    guard var root = anchors.first else { return nil }
    for _ in 0..<(request.scopeAncestor ?? (request.scopeParent == true ? 1 : 0)) {
        guard let parent = root.parent() else { throw WhatsAppError("missing UI scope parent") }
        root = parent
    }
    return [root]
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

private let pageUp = "AXScrollUpByPage", pageDown = "AXScrollDownByPage"

// Catalyst repeats a table's page actions on every descendant, so the table is the
// outermost element offering one. Each action is offered only while that direction
// can scroll; a list that fits on screen offers neither.
@MainActor
private func scrollArea(_ root: Element) throws -> Element? {
    func pages(_ element: Element) -> Bool { element.isActionSupported(pageUp) || element.isActionSupported(pageDown) }
    if pages(root) { return root }
    let areas = try find(root) { pages($0) && !($0.parent().map(pages) ?? false) }
    guard areas.count <= 1 else { throw WhatsAppError("ambiguous scroll area") }
    return areas.first
}

// Catalyst exposes only the rows on screen, so lists are read a page at a time.
// WhatsApp animates page scrolls (and sheet presentations) for about 160 ms with no
// completion notification, so a page is read once two consecutive reads match.
// Correctness does not depend on that timing: a page scroll moves less than the
// visible height, every scroll starts from a page that was read, the bottom is
// detected when AXScrollDownByPage is no longer offered, and the top when showing
// the topmost element uncovers nothing above it.
private struct PageScan {
    private var previous: [String]?
    private var scrolledFrom: [String]?
    private var down = false

    @MainActor private static func layout(_ list: Element) -> [String] {
        [String(describing: list.frame())] + children(list).map { "\($0.role() ?? "")|\(String(describing: $0.frame()))" }
    }

    @MainActor mutating func settled(_ list: Element) -> Bool {
        let layout = Self.layout(list)
        defer { previous = layout }
        // A requested page scroll only starts on WhatsApp's next frame.
        if let start = scrolledFrom {
            if layout != start { scrolledFrom = nil }
            return false
        }
        return layout == previous
    }

    @MainActor mutating func page(_ area: Element, _ action: String) throws {
        let start = Self.layout(area)
        do { try area.performAction(action) }
        catch let error as AccessibilitySystemError {
            throw WhatsAppError("\(action) failed (AX \(error.axError.rawValue))")
        }
        scrolledFrom = start
    }

    // Moves up to the top, then pages down to the bottom. Returns false once both
    // ends have been read.
    @MainActor mutating func advance(_ area: Element, downOnly: Bool) throws -> Bool {
        if !down, !downOnly, let top = children(area).first, top.isActionSupported("AXScrollToVisible") {
            // WhatsApp keeps offering AXScrollUpByPage at the top of a table, and near
            // it the action does nothing. AXScrollToVisible is synchronous: showing
            // the topmost exposed element (the table header in Info) uncovers any row
            // above it under the navigation bar, until none remains.
            _ = try? top.performAction("AXScrollToVisible")
            if children(area).first == top { down = true }
            previous = nil
            return true
        }
        if !down, !downOnly, area.isActionSupported(pageUp) {
            try page(area, pageUp)
            return true
        }
        down = true
        guard area.isActionSupported(pageDown) else { return false }
        try page(area, pageDown)
        return true
    }
}

// WhatsApp performs AXPress as a tap at the control's activation point, which does
// nothing while the control is off screen or under the translucent navigation bar.
// AXScrollToVisible is synchronous; hit-testing then confirms the tap lands in the
// list rather than on an overlay. A link's tap lands on the text that draws it, a
// sibling element, so any hit inside the list counts.
@MainActor
private func reachable(_ target: Element, in list: Element, application: Element) -> Bool {
    if target.isActionSupported("AXScrollToVisible") { _ = try? target.performAction("AXScrollToVisible") }
    guard let point = activationPoint(target) else { return false }
    var hit: AXUIElement?
    guard AXUIElementCopyElementAtPosition(application.underlyingElement, Float(point.x), Float(point.y), &hit) == .success,
          let hit else { return false }
    var current: Element? = Element(hit)
    if current == list { return false }
    for _ in 0..<20 {
        guard let element = current else { return false }
        if element == target || element == list { return true }
        current = element.parent()
    }
    return false
}

@MainActor
private func activationPoint(_ element: Element) -> CGPoint? {
    var value: CFTypeRef?
    if AXUIElementCopyAttributeValue(element.underlyingElement, "AXActivationPoint" as CFString, &value) == .success,
       let value, CFGetTypeID(value) == AXValueGetTypeID() {
        var point = CGPoint.zero
        if AXValueGetValue(value as! AXValue, .cgPoint, &point) { return point }
    }
    return (try? frame(element)).map { CGPoint(x: $0.midX, y: $0.midY) }
}

// Group Info's member section starts at the only heading row with a button (member
// search) and ends at the first gap between rows. Action rows (Add members, Invite
// via link, View all) expose an empty AXValue; member rows expose none. Rows that
// stay on screen across a page scroll keep their element, so the rows shared by
// consecutive pages carry the count forward.
private struct MemberCount {
    private struct Row {
        let row: Element
        let members: Int
        let member: Bool
    }
    private var counted: [Row] = []
    var anchored: Bool { !counted.isEmpty }

    @MainActor mutating func control(_ list: Element, index: Int, canScrollDown: Bool) throws -> Element? {
        let rows = children(list)
        var section: [Row] = []
        if let heading = try rows.firstIndex(where: isMembersHeading) {
            section.append(Row(row: rows[heading], members: 0, member: false))
        } else if let known = rows.lazy.compactMap({ [counted] row in counted.first { $0.row == row } }).first {
            section.append(known)
        } else { return nil }
        guard let first = rows.firstIndex(of: section[0].row), var bottom = section[0].row.frame()?.maxY else { return nil }
        var members = section[0].members
        var ended = false
        for row in rows[(first + 1)...] {
            guard let rowFrame = row.frame(), abs(rowFrame.minY - bottom) <= 1 else { ended = true; break }
            let member = (children(row).first ?? row).attribute(Attribute<String>(kAXValueAttribute)) == nil
            if member { members += 1 }
            section.append(Row(row: row, members: members, member: member))
            bottom = rowFrame.maxY
        }
        counted = section
        if let target = section.first(where: { $0.member && $0.members == index }) {
            let control = children(target.row).first ?? target.row
            guard control.role() == kAXButtonRole else { throw WhatsAppError("group member #\(index) has no member options (it is you)") }
            return control
        }
        if members < index, ended || !canScrollDown {
            throw WhatsAppError("group member #\(index) is not listed in Group Info (\(members) shown); open the full member list")
        }
        return nil
    }
}

@MainActor
private func isMembersHeading(_ row: Element) throws -> Bool {
    guard row.role() == "AXHeading" else { return false }
    return try !find(row) { $0.role() == kAXButtonRole }.isEmpty
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

// Catalyst exposes loaded chat rows as direct buttons (the open chat as text).
// Filter and archive cells are containers and must not shift numbered positions.
@MainActor
private func chatRows(_ table: Element) -> [Element] {
    children(table).filter {
        !clean($0.identifier() ?? "").hasPrefix("ChatListView_")
            && ($0.role() == kAXButtonRole || clean($0.help() ?? "").contains("Double tap to open chat"))
    }
}

@MainActor
private func chatList(_ application: Element) throws -> Element? {
    let tables = try find(application) { clean($0.identifier() ?? "") == "ChatListView_TableView" }
    guard tables.count <= 1 else { throw WhatsAppError("multiple chat lists are open") }
    return tables.first
}

// A chip's label can carry a count, such as "Groups, 1 unread chat".
@MainActor
private func filterChip(_ application: Element, request: Request) throws -> Element? {
    guard let name = request.description else { throw WhatsAppError("missing chat filter") }
    let strips = try find(application) { clean($0.identifier() ?? "") == "ChatListView_chipButtonsCell" }
    guard strips.count <= 1 else { throw WhatsAppError("multiple chat lists are open") }
    guard let strip = strips.first else { return nil }
    let chips = children(strip).filter { chip in
        chip.role() == kAXButtonRole && [chip.descriptionText(), chip.title()].contains {
            let label = clean($0 ?? "")
            return label == name || label.hasPrefix(name + ",")
        }
    }
    guard chips.count <= 1 else { throw WhatsAppError("\(name) filter is ambiguous") }
    return chips.first
}

// nil when the element can no longer be read, such as a chip that was rebuilt.
@MainActor
private func selectedState(_ element: Element) -> Bool? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element.underlyingElement, kAXSelectedAttribute as CFString, &value) == .success else { return nil }
    return (value as? Bool) == true
}

// Whether a tap at `point` lands on `target`. When unread counts widen the chips,
// the strip scrolls and WhatsApp's sidebar can cover the leftmost chip's centre.
@MainActor
private func hits(_ target: Element, at point: CGPoint, application: Element) -> Bool {
    var hit: AXUIElement?
    guard AXUIElementCopyElementAtPosition(application.underlyingElement, Float(point.x), Float(point.y), &hit) == .success,
          let hit else { return false }
    var current: Element? = Element(hit)
    for _ in 0..<20 {
        guard let element = current else { return false }
        if element == target { return true }
        current = element.parent()
    }
    return false
}

// The point nearest a partly covered control's centre that a tap still reaches.
@MainActor
private func uncoveredPoint(_ target: Element, application: Element) -> CGPoint? {
    guard let bounds = try? frame(target) else { return nil }
    return (1...9).map { CGPoint(x: bounds.minX + bounds.width * CGFloat($0) / 10, y: bounds.midY) }
        .sorted { abs($0.x - bounds.midX) < abs($1.x - bounds.midX) }
        .first { hits(target, at: $0, application: application) }
}

private final class Wakeups: Sendable {
    let continuation: AsyncStream<Void>.Continuation
    init(_ continuation: AsyncStream<Void>.Continuation) { self.continuation = continuation }
}

private let changeNotifications = [
    kAXLayoutChangedNotification, kAXValueChangedNotification, kAXSelectedChildrenChangedNotification,
    kAXCreatedNotification, kAXUIElementDestroyedNotification, kAXFocusedUIElementChangedNotification,
]

// Runs `check`, then runs it again on each accessibility notification WhatsApp
// posts, until it returns true. The deadline only bounds an action WhatsApp ignored.
@MainActor
private func awaitChange(processId: pid_t, deadline: Date, _ check: @MainActor () throws -> Bool) async throws -> Bool {
    var created: AXObserver?
    let callback: AXObserverCallbackWithInfo = { _, _, _, info, context in
        // Reading reused table rows makes Catalyst post forced layout changes;
        // they would wake this loop on its own reads.
        if (info as NSDictionary)["data"] as? String == "AXForceUpdateChange" { return }
        guard let context else { return }
        Unmanaged<Wakeups>.fromOpaque(context).takeUnretainedValue().continuation.yield(())
    }
    guard AXObserverCreateWithInfoCallback(processId, callback, &created) == .success, let observer = created else {
        throw WhatsAppError("could not observe WhatsApp's accessibility notifications")
    }
    let (wakeups, continuation) = AsyncStream.makeStream(of: Void.self, bufferingPolicy: .bufferingNewest(1))
    let context = Unmanaged.passRetained(Wakeups(continuation))
    let observed = AXUIElementCreateApplication(processId)
    for name in changeNotifications { AXObserverAddNotification(observer, observed, name as CFString, context.toOpaque()) }
    let source = AXObserverGetRunLoopSource(observer)
    CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
    let timeout = Task {
        try? await Task.sleep(for: .seconds(max(0, deadline.timeIntervalSinceNow)))
        continuation.finish()
    }
    defer {
        timeout.cancel()
        CFRunLoopRemoveSource(CFRunLoopGetMain(), source, .commonModes)
        for name in changeNotifications { AXObserverRemoveNotification(observer, observed, name as CFString) }
        context.release()
    }
    // Observing first means a change right after this check still wakes the loop.
    if try check() { return true }
    for await _ in wakeups {
        if try check() { return true }
    }
    return false
}

// WhatsApp applies a filter about 75 ms after the chip's AXPress returns. In one
// main-thread call it selects the chip, swaps the list's fetch and reloads the
// table, so a selected chip means the filter's chats are WhatsApp's current list.
// Nothing announces the selection, but the reload posts layout changes: one per
// frame while rows animate, and one about 0.5 s after any table reload (UIKit's
// accessibility debounce). Each notification wakes one read of the chip, which
// WhatsApp keeps across filter changes; a chip that was rebuilt is found again.
@MainActor
private func awaitSelected(_ found: Element, application: Element, request: Request, processId: pid_t, deadline: Date) async throws -> Bool {
    var chip = found
    return try await awaitChange(processId: processId, deadline: deadline) {
        if let state = selectedState(chip) { return state }
        guard let current = try filterChip(application, request: request) else { return false }
        chip = current
        return selectedState(current) == true
    }
}

// The chat's own search field; the chat list's search is a separate tokenized bar.
// A chat open in its own window has its own field, so the main window's is used.
@MainActor
private func chatSearchField(_ application: Element) throws -> Element? {
    let fields = try find(application) {
        $0.role() == kAXTextFieldRole && $0.attribute(Attribute<String>(kAXSubroleAttribute)) == "AXSearchField"
    }
    guard fields.count > 1 else { return fields.first }
    return fields.first { field in
        var main: CFTypeRef?
        guard let window = field.attribute(Attribute<AXUIElement>(kAXWindowAttribute)),
              AXUIElementCopyAttributeValue(window, kAXMainAttribute as CFString, &main) == .success else { return false }
        return (main as? Bool) == true
    }
}

@MainActor
private func focusedElement(_ application: Element) -> Element? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(application.underlyingElement, kAXFocusedUIElementAttribute as CFString, &value) == .success,
          let value, CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
    return Element(value as! AXUIElement)
}

// Info's Search button focuses the chat's search field only after Info has animated
// away, and a closing Info can give focus back to the composer after the menu
// focused the field. Focus on another control is returned to the field with a tap;
// focus on the window itself means WhatsApp has not finished the transition.
@MainActor
private func awaitSearchFocus(_ application: Element, processId: pid_t) async throws -> Bool {
    try await awaitChange(processId: processId, deadline: Date(timeIntervalSinceNow: 3)) {
        guard let field = try chatSearchField(application), let focus = focusedElement(application) else { return false }
        if focus == field { return true }
        if focus.role() != kAXWindowRole, focus.attribute(Attribute<String>(kAXSubroleAttribute)) != "iOSContentGroup" {
            _ = try? field.performAction(.press)
        }
        return false
    }
}

private let digitKeys: [CGKeyCode] = [0x12, 0x13, 0x14, 0x15, 0x17, 0x16, 0x1A, 0x1C, 0x19] // kVK_ANSI_1…9
private let rightBracketKey: CGKeyCode = 0x1E // kVK_ANSI_RightBracket
private let oKey: CGKeyCode = 0x1F // kVK_ANSI_O

// ⌘1–⌘9 ("Select recent chats") select a row of the current filter from WhatsApp's
// list data, and Next Chat (⇧⌘]) selects the following row. Unlike a row's AXPress,
// a tap that WhatsApp ignores while a filter reload animates, they do not depend on
// accessibility rows or layout.
@MainActor
private func openChat(_ table: Element, index: Int, processId: pid_t) throws {
    // Catalyst exposes only on-screen rows. A list without page actions fits on
    // screen, so its rows are the whole filter and a missing position is reported.
    let loaded = chatRows(table).count
    if index > loaded, try scrollArea(table) == nil {
        throw WhatsAppError("chat #\(index) is unavailable; this filter shows \(loaded)")
    }
    try postShortcuts([(digitKeys[min(index, 9) - 1], .maskCommand)]
        + Array(repeating: (rightBracketKey, [.maskCommand, .maskShift]), count: max(0, index - 9)), processId: processId)
}

// The events go to WhatsApp's process rather than the keyboard focus, and WhatsApp
// handles them in order. A private source keeps keys the user is holding out of them.
@MainActor
private func postShortcuts(_ keys: [(CGKeyCode, CGEventFlags)], processId: pid_t) throws {
    let source = CGEventSource(stateID: .privateState)
    for (key, flags) in keys {
        guard let down = CGEvent(keyboardEventSource: source, virtualKey: key, keyDown: true),
              let up = CGEvent(keyboardEventSource: source, virtualKey: key, keyDown: false) else {
            throw WhatsAppError("could not create chat shortcut events")
        }
        down.flags = flags
        up.flags = flags
        down.postToPid(processId)
        up.postToPid(processId)
    }
}

@MainActor
private func perform(bundleId: String, requests: [Request]) async throws -> String {
    guard AXPermissionHelpers.hasAccessibilityPermissions() else { throw WhatsAppError("Chord needs Accessibility permission") }
    let app = try await activate(bundleId)
    let application = AXApp(app).element
    application.setMessagingTimeout(2)
    for (index, request) in requests.enumerated() {
        let scrolls = request.scroll == true || request.kind == .member
        let deadline = Date(timeIntervalSinceNow: scrolls ? 5 : 2)
        var target: Element?
        var scan = PageScan()
        var members = MemberCount()
        var covered = false
        var disabled: Disabled?
        search: while target == nil {
            // Navigation animations can finish after AXPress returns. Recheck
            // page guards while waiting so a newly opened page can skip a step.
            if let selectors = request.onlyIfAny, try !contains(application, selectors: selectors) { break }
            if let selectors = request.unlessAny, try contains(application, selectors: selectors) { break }
            if let identifier = request.unlessIdentifier,
               !(try find(application) { clean($0.identifier() ?? "") == identifier }).isEmpty { break }
            guard !app.isTerminated else { throw WhatsAppError("application exited during the action") }
            do { switch request.kind {
            case .dismissPopover:
                let popovers: [Element]
                if request.scope != nil {
                    popovers = try scopedRoots(application, request: request) ?? []
                    guard popovers.count <= 1 else { throw WhatsAppError("multiple action sheets are open") }
                } else {
                    popovers = try find(application) { $0.role() == "AXPopover" }.filter {
                        try contains($0, selectors: deviceSections.map { Selector(identifiers: nil, description: $0, role: nil) })
                    }
                }
                guard popovers.count <= 1 else { throw WhatsAppError("multiple call device popovers are open") }
                target = popovers.first
                if target == nil { break search }
            case .menu:
                if let bar = application.menuBar() {
                    guard let scope = request.scope else { throw WhatsAppError("missing menu scope") }
                    let menus = children(bar).filter { clean($0.identifier() ?? "") == scope }
                    if menus.count == 1 { target = try select([menus[0]], request: request) }
                }
            case .verify:
                target = try select([application], request: request)
            case .element, .groupPermissions, .member:
                guard let roots = try scopedRoots(application, request: request) else { break }
                guard scrolls else {
                    target = try select(roots, request: request)
                    break
                }
                guard roots.count == 1 else { throw WhatsAppError("ambiguous list scope") }
                let area = try scrollArea(roots[0])
                guard scan.settled(area ?? roots[0]) else { break }
                if request.kind == .member {
                    guard let position = request.index, position > 0 else { throw WhatsAppError("group member index must be positive") }
                    target = try members.control(area ?? roots[0], index: position, canScrollDown: area?.isActionSupported(pageDown) == true)
                } else {
                    target = try select(roots, request: request)
                }
                if let found = target {
                    if reachable(found, in: area ?? roots[0], application: application) { break }
                    target = nil
                    covered = true
                    // Page toward a control that AXScrollToVisible did not reveal.
                    if let area, let point = activationPoint(found), let viewport = area.frame() ?? roots[0].frame() {
                        let action = point.y > viewport.midY ? pageDown : pageUp
                        if area.isActionSupported(action) { try scan.page(area, action) }
                    }
                } else if request.kind == .groupPermissions, let point = try groupPermissionsPoint(roots[0]) {
                    guard index == requests.count - 1 else { throw WhatsAppError("permissions click must be the final native step") }
                    return try clickTarget(roots[0], point: point, processId: app.processIdentifier)
                } else if let area, !(try scan.advance(area, downOnly: members.anchored)) {
                    // Every page of the list has been read.
                    if request.optional == true { break search }
                    throw WhatsAppError("\(request.missing ?? describe(request)) is unavailable in the current window or app version")
                }
            case .participant:
                target = try participantControl(application, request: request)
            case .chat:
                guard let index = request.index, index > 0 else { throw WhatsAppError("chat index must be positive") }
                if let table = try chatList(application) {
                    let rows = chatRows(table)
                    guard rows.count >= index else { throw WhatsAppError("chat #\(index) is not loaded; scroll the chat list into view") }
                    target = rows[index - 1]
                }
            case .filter, .filterSelected:
                target = try filterChip(application, request: request)
            case .openChat:
                target = try chatList(application)
            case .openWindow, .searchChat:
                target = application
            case .grid:
                target = try gridControl(application, request: request)
            case .device:
                target = try deviceControl(application, request: request)
            } } catch let error as Disabled {
                target = nil
                disabled = error
            }
            if target == nil {
                if Date() >= deadline {
                    if request.optional == true { break search }
                    if let disabled { throw disabled }
                    let label = request.missing ?? describe(request)
                    if request.kind == .verify { throw WhatsAppError("\(label) did not open") }
                    if covered { throw WhatsAppError("\(label) is covered or off screen; scroll it into view") }
                    throw WhatsAppError("\(label) is unavailable in the current window or app version")
                }
                try await Task.sleep(for: .milliseconds(25))
            }
        }
        guard let target else { continue }
        if request.kind == .verify { continue }
        if request.kind == .filterSelected {
            guard try await awaitSelected(target, application: application, request: request, processId: app.processIdentifier, deadline: deadline) else {
                throw WhatsAppError("the \(describe(request)) filter was not applied; WhatsApp ignores filters pressed while its chat list reloads")
            }
            continue
        }
        if request.kind == .openChat {
            guard let position = request.index, position > 0 else { throw WhatsAppError("chat index must be positive") }
            try openChat(target, index: position, processId: app.processIdentifier)
            continue
        }
        if request.kind == .openWindow {
            // "Open in new window" (⌥⌘O) does not depend on the chat's toolbar, whose
            // More menu WhatsApp hides while the chat's search bar is open.
            try postShortcuts([(oKey, [.maskCommand, .maskAlternate])], processId: app.processIdentifier)
            continue
        }
        if request.kind == .searchChat {
            guard try await awaitSearchFocus(application, processId: app.processIdentifier) else {
                throw WhatsAppError("the chat's search field did not take focus; open a chat first")
            }
            continue
        }
        if request.kind == .filter {
            // Pressing the selected chip deselects it, and WhatsApp can then show All.
            if selectedState(target) == true { continue }
            if target.isActionSupported("AXScrollToVisible") { _ = try? target.performAction("AXScrollToVisible") }
            if let point = activationPoint(target), !hits(target, at: point, application: application) {
                guard index == requests.count - 1, let uncovered = uncoveredPoint(target, application: application) else {
                    throw WhatsAppError("the \(describe(request)) filter is covered; widen WhatsApp's window")
                }
                return try clickTarget(target, point: uncovered, processId: app.processIdentifier)
            }
        }
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

private func describe(_ request: Request) -> String {
    if request.kind == .member { return "group member #\(request.index ?? 0)" }
    return request.identifiers?.joined(separator: "/") ?? request.description ?? request.descriptions?.joined(separator: "/")
        ?? request.titlePrefix ?? request.descriptionPrefix ?? request.descriptionSuffix ?? "chat list"
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

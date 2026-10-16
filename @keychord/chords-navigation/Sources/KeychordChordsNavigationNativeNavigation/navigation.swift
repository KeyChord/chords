import AppKit
import AXorcistRuntime
import ApplicationServices
import ChordNodeSupport
import Foundation
import NodeAPI

private struct NavigationError: Error, CustomStringConvertible {
    let description: String
    init(_ message: String) { description = "Navigation: \(message)" }
}

private struct Request: Decodable, Sendable {
    enum Action: String, Decodable, Sendable {
        case previous = "PREVIOUS", next = "NEXT", close = "CLOSE", option = "OPTION"
    }
    let action: Action
    let index: Int?
}

#NodeModule(exports: [
    "perform": try NodeFunction { (bundleId: String, json: String) throws -> NodePromise in
        let request = try JSONDecoder().decode(Request.self, from: Data(json.utf8))
        return try mainActorPromise { try await perform(bundleId, request: request) }
    },
])

@MainActor
private func children(_ element: Element) -> [Element] {
    (element.attribute(Attribute<[AXUIElement]>(kAXChildrenAttribute)) ?? []).map(Element.init)
}

@MainActor
private func tree(_ root: Element, content: Bool = false) throws -> [Element] {
    var result: [Element] = []
    let deadline = Date(timeIntervalSinceNow: 3)
    func walk(_ element: Element, depth: Int) throws {
        guard depth < 30, !result.contains(element) else { return }
        guard result.count < 5000, Date() < deadline else { throw NavigationError("accessibility tree is too large or busy") }
        guard element.attribute(Attribute<Bool>("AXHidden")) != true else { return }
        result.append(element)
        // Navigation discovery does not need document/chat history. Numbered
        // choices opt into content traversal inside the selected scope.
        if !content, ["AXTable", "AXList", "AXOutline"].contains(element.role() ?? "") { return }
        for child in children(element) { try walk(child, depth: depth + 1) }
    }
    try walk(root, depth: 0)
    return result
}

@MainActor
private func ancestors(_ element: Element) -> [Element] {
    var result: [Element] = []
    var current: Element? = element
    for _ in 0..<30 {
        guard let node = current, !result.contains(node) else { break }
        result.append(node)
        current = node.parent()
    }
    return result
}

@MainActor
private func isDialog(_ element: Element) -> Bool {
    ["AXSheet", "AXDialog", "AXPopover"].contains(element.role() ?? "")
        || ["AXDialog", "AXSystemDialog"].contains(element.subrole() ?? "")
        || element.attribute(Attribute<Bool>(kAXModalAttribute)) == true
}

@MainActor
private func frame(_ element: Element) throws -> CGRect {
    guard let area = element.frame(), area.minX.isFinite, area.minY.isFinite,
          area.width.isFinite, area.height.isFinite, area.width > 0, area.height > 0 else {
        throw NavigationError("control has no visible accessibility bounds")
    }
    return area
}

private struct Scope {
    let window: Element
    let root: Element
    let modal: Bool
}

@MainActor
private func scope(_ application: Element) throws -> Scope {
    let focused = application.attribute(Attribute<AXUIElement>(kAXFocusedWindowAttribute))
        ?? application.attribute(Attribute<AXUIElement>(kAXMainWindowAttribute))
    let windows = application.attribute(Attribute<[AXUIElement]>(kAXWindowsAttribute)) ?? []
    guard let window = focused.map(Element.init) ?? (windows.count == 1 ? windows.first.map(Element.init) : nil) else {
        throw NavigationError("no unique active window")
    }
    let dialogs = try tree(window).filter { $0 != window && isDialog($0) }
    let innermost = dialogs.filter { outer in
        !dialogs.contains { $0 != outer && ancestors($0).contains(outer) }
    }
    guard innermost.count <= 1 else { throw NavigationError("ambiguous dialogs") }
    return Scope(window: window, root: innermost.first ?? window, modal: !innermost.isEmpty || isDialog(window))
}

@MainActor
private func usable(_ element: Element, in scope: Scope, allowWindowClose: Bool = false) -> Bool {
    let parents = ancestors(element)
    guard parents.contains(scope.root),
          element.attribute(Attribute<Bool>("AXHidden")) != true,
          let area = try? frame(element), let bounds = try? frame(scope.root),
          bounds.contains(CGPoint(x: area.midX, y: area.midY)) else { return false }
    for parent in parents {
        if parent.attribute(Attribute<Bool>("AXHidden")) == true { return false }
        if parent.role() == "AXScrollArea", let clip = parent.frame(), !clip.contains(CGPoint(x: area.midX, y: area.midY)) { return false }
        if parent == scope.root { break }
    }
    if !allowWindowClose, ["AXCloseButton", "AXMinimizeButton", "AXZoomButton", "AXFullScreenButton"].contains(element.subrole() ?? "") { return false }
    return true
}

@MainActor
private func enabled(_ element: Element) throws -> Element {
    guard element.isEnabled() != false else { throw NavigationError("control is disabled") }
    return element
}

@MainActor
private func relationship(_ attribute: String, in scope: Scope, allowWindowClose: Bool = false) throws -> Element? {
    for owner in ancestors(scope.root) {
        if let control = owner.attribute(Attribute<AXUIElement>(attribute)).map(Element.init),
           usable(control, in: scope, allowWindowClose: allowWindowClose) {
            return try enabled(control)
        }
        if owner == scope.window { break }
    }
    return nil
}

@MainActor
private func navigationControl(_ scope: Scope, previous: Bool) throws -> Element? {
    let attribute = previous ? kAXCancelButtonAttribute : kAXDefaultButtonAttribute
    if let control = try relationship(attribute as String, in: scope) { return control }
    if previous, scope.modal, let control = try relationship(kAXCloseButtonAttribute as String, in: scope) { return control }
    let bounds = try frame(scope.root)
    let elements = try tree(scope.root)
    let closeBox = scope.window.attribute(Attribute<AXUIElement>(kAXCloseButtonAttribute)).map(Element.init)
    let top = max(bounds.minY, scope.root == scope.window ? closeBox?.frame()?.maxY ?? bounds.minY : bounds.minY)
    let bottom = top + min(120, bounds.height / 4)
    let hints = elements.filter {
        guard let area = $0.frame(), area.width > 0, area.height > 0, area.midY > top, area.midY < bottom else { return false }
        if $0.role() == kAXToolbarRole { return true }
        if $0.role() == kAXGroupRole, area.width >= bounds.width * 0.6, area.height <= 80 { return true }
        let labelledGroup = $0.role() == kAXGroupRole && !($0.descriptionText() ?? $0.title() ?? "").isEmpty
        return ($0.role() == "AXHeading" || labelledGroup) && abs(area.midX - bounds.midX) < bounds.width / 4
    }
    let buttons = elements.filter {
        guard $0.role() == kAXButtonRole, usable($0, in: scope), let area = $0.frame(), area.midY > top, area.midY < bottom else { return false }
        return scope.modal || hints.contains { hint in
            guard let title = hint.frame() else { return false }
            return abs(title.midY - area.midY) <= max(title.height, area.height) / 2
        }
    }
    if let row = buttons.compactMap({ $0.frame()?.midY }).min() {
        let matches = buttons.filter {
            guard let area = $0.frame(), abs(area.midY - row) <= max(2, area.height / 2) else { return false }
            return previous ? area.midX < bounds.midX : area.midX > bounds.midX
        }
        guard matches.count <= 1 else { throw NavigationError("ambiguous navigation buttons") }
        if let control = matches.first { return try enabled(control) }
    }
    return nil
}

@MainActor
private func optionControl(_ application: Element, scope: Scope, index: Int) throws -> Element {
    guard index > 0 else { throw NavigationError("option index must be positive") }
    var root = scope.root
    if !scope.modal, let focused = application.attribute(Attribute<AXUIElement>(kAXFocusedUIElementAttribute)).map(Element.init),
       let container = ancestors(focused).first(where: { ["AXList", "AXTable", "AXOutline", "AXGrid", "AXRadioGroup", "AXMenu"].contains($0.role() ?? "") }),
       ancestors(container).contains(scope.window) { root = container }
    let selectedScope = Scope(window: scope.window, root: root, modal: scope.modal)
    let controls = try tree(root, content: true).filter {
        ["AXButton", "AXRadioButton", "AXCheckBox", "AXMenuItem"].contains($0.role() ?? "") && usable($0, in: selectedScope)
    }
    // Some bridges expose both a wrapper and its actual button as actionable.
    let leaves = controls.filter { outer in
        !controls.contains { $0 != outer && ancestors($0).contains(outer) }
    }
    let positioned = try leaves.map { ($0, try frame($0)) }.sorted {
        if $0.1.midY != $1.1.midY { return $0.1.midY < $1.1.midY }
        return $0.1.midX < $1.1.midX
    }
    var rows: [[(Element, CGRect)]] = []
    for control in positioned {
        if let last = rows.last, abs(last[0].1.midY - control.1.midY) <= 2 {
            rows[rows.count - 1].append(control)
        } else { rows.append([control]) }
    }
    let ordered = rows.flatMap { $0.sorted { $0.1.midX < $1.1.midX } }
    guard index <= ordered.count else { throw NavigationError("option #\(index) is unavailable (\(ordered.count) visible options)") }
    let target = ordered[index - 1]
    guard ordered.filter({ abs($0.1.midX - target.1.midX) <= 1 && abs($0.1.midY - target.1.midY) <= 1 }).count == 1 else {
        throw NavigationError("option #\(index) has ambiguous overlapping controls")
    }
    return try enabled(target.0)
}

@MainActor
private func dismiss(_ scope: Scope, processId: pid_t) throws {
    guard scope.modal else { throw NavigationError("no dialog to dismiss") }
    if let control = try relationship(kAXCancelButtonAttribute as String, in: scope)
        ?? relationship(kAXCloseButtonAttribute as String, in: scope, allowWindowClose: isDialog(scope.window)) {
        guard control.isActionSupported(kAXPressAction) else { throw NavigationError("dialog dismissal has no accessibility press action") }
        try control.performAction(.press)
    } else if scope.root.isActionSupported(kAXCancelAction) {
        try scope.root.performAction(kAXCancelAction)
    } else {
        // Escape is sent to the captured process, never the global keyboard focus.
        guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 53, keyDown: true),
              let up = CGEvent(keyboardEventSource: nil, virtualKey: 53, keyDown: false) else {
            throw NavigationError("could not create dialog Escape events")
        }
        down.postToPid(processId)
        up.postToPid(processId)
    }
}

@MainActor
private func perform(_ bundleId: String, request: Request) async throws -> String {
    guard AXPermissionHelpers.hasAccessibilityPermissions() else { throw NavigationError("Chord needs Accessibility permission") }
    guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first else {
        throw NavigationError("captured application is no longer running")
    }
    app.unhide()
    app.activate()
    let deadline = Date(timeIntervalSinceNow: 2)
    while NSWorkspace.shared.frontmostApplication?.processIdentifier != app.processIdentifier && Date() < deadline {
        try await Task.sleep(for: .milliseconds(20))
    }
    guard !app.isTerminated, NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else {
        throw NavigationError("captured application did not become active")
    }
    let application = AXApp(app).element
    application.setMessagingTimeout(0.5)
    var current = try scope(application)
    if request.action == .close {
        guard current.modal else { throw NavigationError("no dialog to close") }
        let family = ancestors(current.root)
        for _ in 0..<8 {
            let previous = current.root
            try dismiss(current, processId: app.processIdentifier)
            let deadline = Date(timeIntervalSinceNow: 1.5)
            repeat {
                try await Task.sleep(for: .milliseconds(25))
                // A standalone modal window can be the application's last window.
                if (application.attribute(Attribute<[AXUIElement]>(kAXWindowsAttribute)) ?? []).isEmpty { return "" }
                current = try scope(application)
                if !current.modal || current.root != previous { break }
            } while Date() < deadline
            guard current.root != previous || !current.modal else { throw NavigationError("dialog did not dismiss") }
            if !current.modal || !family.contains(current.window) { return "" }
        }
        throw NavigationError("too many nested dialogs")
    }
    var target: Element?
    if request.action == .option {
        guard let index = request.index else { throw NavigationError("missing option index") }
        target = try optionControl(application, scope: current, index: index)
    } else {
        let deadline = Date(timeIntervalSinceNow: 2)
        repeat {
            target = try navigationControl(current, previous: request.action == .previous)
            if target != nil { break }
            if request.action == .previous, current.modal {
                try dismiss(current, processId: app.processIdentifier)
                return ""
            }
            if Date() >= deadline { throw NavigationError("\(request.action.rawValue) is unavailable in the active window") }
            try await Task.sleep(for: .milliseconds(25))
            current = try scope(application)
        } while target == nil
    }
    guard let target else { throw NavigationError("control is unavailable") }
    if target.isActionSupported(kAXPressAction) {
        // Never retry a dispatched action: its callback may already have run.
        try target.performAction(.press)
        return ""
    }
    guard let window = target.attribute(Attribute<AXUIElement>(kAXWindowAttribute)).map(Element.init) else {
        throw NavigationError("control has no containing window")
    }
    let bounds = try frame(window)
    let control = try frame(target)
    let point = CGPoint(x: control.midX, y: control.midY)
    guard bounds.contains(point) else { throw NavigationError("control is outside its window") }
    let data = try JSONSerialization.data(withJSONObject: [
        "processId": app.processIdentifier,
        "point": ["x": point.x, "y": point.y],
        "bounds": ["x": bounds.minX, "y": bounds.minY, "width": bounds.width, "height": bounds.height],
    ])
    return String(decoding: data, as: UTF8.self)
}

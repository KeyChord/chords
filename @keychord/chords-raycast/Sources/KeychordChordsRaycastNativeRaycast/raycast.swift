import AppKit
import Algorithms
import AXorcistRuntime
import ApplicationServices
import ChordNodeSupport
import Foundation
import NodeAPI

#NodeModule(exports: [
    "readState": try NodeFunction { () throws -> NodePromise in
        try mainActorPromise { try encode(snapshot().state) }
    },
    "setSearch": try NodeFunction { (query: String, remainingMs: Double) throws -> NodePromise in
        let deadline = ProcessInfo.processInfo.systemUptime + remainingMs / 1000
        return try mainActorPromise {
            let current = try snapshot(deadline: deadline)
            let input = try current.searchInput()
            try checkDeadline(deadline)
            // WebKit's accessibility setter dispatches the input change as one edit.
            do {
                try input.setValue(query)
            } catch let error as AccessibilitySystemError {
                throw RaycastError.accessibility("set search text", error.axError)
            }
            return ""
        }
    },
    "returnToRoot": try NodeFunction { (fingerprint: String, remainingMs: Double) throws -> NodePromise in
        let deadline = ProcessInfo.processInfo.systemUptime + remainingMs / 1000
        return try mainActorPromise {
            let current = try snapshot(deadline: deadline)
            _ = try current.focusedElement()
            guard current.state.navigationFingerprint == fingerprint, let back = current.backAction else { return "false" }
            try checkDeadline(deadline)
            return try press(back, operation: "return to Root Search") ? "true" : "false"
        }
    },
    "activateSearch": try NodeFunction { (query: String, fingerprint: String, remainingMs: Double) throws -> NodePromise in
        let deadline = ProcessInfo.processInfo.systemUptime + remainingMs / 1000
        return try mainActorPromise {
            let current = try snapshot(deadline: deadline)
            _ = try current.searchInput()
            guard current.state.value == query else { throw RaycastError.queryChanged }
            guard !current.state.busy, current.state.fingerprint == fingerprint,
                  let action = current.primaryAction else { return "false" }
            try checkDeadline(deadline)
            return try press(action, operation: "activate the primary result") ? "true" : "false"
        }
    },
])

private let bundleId = "com.raycast.macos"

private struct State: Encodable {
    var bundleId: String?
    var frontmostBundleId: String?
    var role: String?
    var placeholder: String?
    var description: String?
    var focused = false
    var value: String?
    var rootSearchVisible: Bool?
    var busy = false
    var fingerprint: String?
    var navigationFingerprint: String?
}

private struct Snapshot {
    var state: State
    var processId: pid_t?
    var input: Element?
    var primaryAction: Element?
    var backAction: Element?

    @MainActor
    func focusedElement() throws -> Element {
        guard state.bundleId == bundleId, state.focused, let input, let processId,
              try ownsKeyboardFocus(input, processId: processId) else { throw RaycastError.searchNotFocused }
        return input
    }

    @MainActor
    func searchInput() throws -> Element {
        let input = try focusedElement()
        let label = (state.placeholder?.isEmpty == false ? state.placeholder : state.description) ?? ""
        guard state.bundleId == bundleId, state.focused,
              state.role == "AXTextField" || state.role == "AXSearchField",
              label.range(of: #"^Search for apps (?:and|or) commands(?:[.\u2026]|$)"#,
                          options: [.regularExpression, .caseInsensitive]) != nil,
              state.focused else {
            throw RaycastError.searchNotFocused
        }
        return input
    }
}

private enum RaycastError: Error, CustomStringConvertible {
    case accessibilityDenied
    case accessibility(String, AXError)
    case searchNotFocused
    case queryChanged
    case treeTooLarge
    case deadlineExceeded

    var description: String {
        switch self {
        case .accessibilityDenied:
            return "Chord needs Accessibility access to search Raycast"
        case .accessibility(let operation, let error):
            return "Unable to \(operation) in Raycast (AX error \(error.rawValue))"
        case .searchNotFocused:
            return "Raycast's main search input is no longer focused"
        case .queryChanged:
            return "Raycast's search text changed before activating a result"
        case .treeTooLarge:
            return "Raycast's accessibility tree exceeded the bounded search limit"
        case .deadlineExceeded:
            return "Raycast's accessibility operation exceeded its deadline"
        }
    }
}

private func encode<T: Encodable>(_ value: T) throws -> String {
    String(decoding: try JSONEncoder().encode(value), as: UTF8.self)
}

@MainActor
private func press(_ element: Element, operation: String) throws -> Bool {
    do {
        try element.performAction(.press)
        return true
    } catch let error as AccessibilitySystemError {
        switch error.axError {
        case .cannotComplete:
            // A callback can run despite a timeout. JS observes the outcome
            // without repeating an action that may already have been dispatched.
            return true
        case .invalidUIElement: return false
        default: throw RaycastError.accessibility(operation, error.axError)
        }
    }
}

// AXorcist's optional getters erase AX errors. Keep this read to distinguish
// revoked permission/unexpected failures from transient WebKit proxy disappearance.
@MainActor
private func attribute(_ element: Element, _ name: String) throws -> CFTypeRef? {
    var value: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element.underlyingElement, name as CFString, &value)
    switch error {
    case .success: return value
    case .noValue, .attributeUnsupported, .invalidUIElement, .cannotComplete: return nil
    case .apiDisabled: throw RaycastError.accessibilityDenied
    default: throw RaycastError.accessibility("read \(name)", error)
    }
}

@MainActor
private func elementAttribute(_ element: Element, _ name: String) throws -> Element? {
    guard let value = try attribute(element, name), CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
    return Element(unsafeDowncast(value, to: AXUIElement.self))
}

@MainActor
private func ownsKeyboardFocus(_ input: Element, processId: pid_t) throws -> Bool {
    guard try attribute(input, kAXFocusedAttribute) as? Bool == true else { return false }
    let system = Element.systemWide()
    system.setMessagingTimeout(0.1)
    if let application = try elementAttribute(system, kAXFocusedApplicationAttribute) {
        if application.pid() == processId { return true }
    }
    if let focused = try elementAttribute(system, kAXFocusedUIElementAttribute), focused == input { return true }
    // WebKit exposes different proxy elements through the app and system paths.
    // Its app-scoped focused field plus the foreground app establishes ownership.
    return NSWorkspace.shared.frontmostApplication?.processIdentifier == processId
}

@MainActor
private func labels(_ element: Element) throws -> [String] {
    let texts = try [kAXTitleAttribute, kAXDescriptionAttribute, kAXValueAttribute]
        .compactMap { try attribute(element, $0) as? String }
    return Array(texts.filter { !$0.isEmpty }.uniqued())
}

private struct Tree {
    var texts: [String] = []
    var busy = false
    var results: Element?
    var primaryAction: Element?
    var actionLabel: String?
    var backAction: Element?
    var complete = true
}

@MainActor
private func checkDeadline(_ deadline: TimeInterval) throws {
    guard ProcessInfo.processInfo.systemUptime < deadline else { throw RaycastError.deadlineExceeded }
}

@MainActor
private func scan(_ root: Element, findControls: Bool, deadline: TimeInterval) throws -> Tree {
    var tree = Tree()
    var stack: [(Element, Int)] = [(root, 0)]
    var visited = Set<Element>()
    while let (element, depth) = stack.popLast() {
        try checkDeadline(deadline)
        // Element equality uses CFEqual, including when two AX hashes collide.
        guard visited.insert(element).inserted else { continue }
        guard visited.count <= 512, depth <= 32 else { throw RaycastError.treeTooLarge }
        element.setMessagingTimeout(0.1)
        let text = try labels(element)
        let role = try attribute(element, kAXRoleAttribute) as? String
        if role == nil { tree.complete = false }
        tree.texts += text
        let busy = try attribute(element, "AXElementBusy") as? Bool == true
        tree.busy = tree.busy || busy
        if findControls {
            if text.contains("Root search results") { tree.results = element }
            if role == "AXButton", text.contains("Back"), try attribute(element, kAXEnabledAttribute) as? Bool != false {
                tree.backAction = element
            }
            if role == "AXButton", text.contains(where: { $0.contains("↵") }),
               try attribute(element, kAXEnabledAttribute) as? Bool != false {
                if element.isActionSupported(kAXPressAction) {
                    tree.primaryAction = element
                    tree.actionLabel = text.joined(separator: " ")
                }
            }
        }
        let children = (try attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? []).map(Element.init)
        // Preserve displayed result order in the fingerprint.
        stack += children.reversed().map { ($0, depth + 1) }
    }
    return tree
}

@MainActor
private func snapshot(deadline: TimeInterval? = nil) throws -> Snapshot {
    let deadline = min(deadline ?? .infinity, ProcessInfo.processInfo.systemUptime + 1)
    try checkDeadline(deadline)
    guard AXPermissionHelpers.hasAccessibilityPermissions() else { throw RaycastError.accessibilityDenied }
    let frontmost = NSWorkspace.shared.frontmostApplication
    var current = Snapshot(state: State(bundleId: frontmost?.bundleIdentifier,
                                       frontmostBundleId: frontmost?.bundleIdentifier))
    // Raycast's non-activating panel can own keyboard focus while NSWorkspace
    // still reports the underlying application. Inspect Raycast by bundle ID,
    // then establish ownership through the system-wide focused AX element.
    guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first else { return current }
    current.processId = app.processIdentifier
    let application = AXApp(app).element
    application.setMessagingTimeout(0.1)
    if let input = try elementAttribute(application, kAXFocusedUIElementAttribute) {
        input.setMessagingTimeout(0.1)
        current.input = input
        current.state.role = try attribute(input, kAXRoleAttribute) as? String
        current.state.placeholder = try attribute(input, kAXPlaceholderValueAttribute) as? String
        current.state.description = try attribute(input, kAXDescriptionAttribute) as? String
        current.state.focused = try ownsKeyboardFocus(input, processId: app.processIdentifier)
        if current.state.focused { current.state.bundleId = bundleId }
        current.state.value = try attribute(input, kAXValueAttribute) as? String
    }
    if let window = try elementAttribute(application, kAXFocusedWindowAttribute) {
        let tree = try scan(window, findControls: true, deadline: deadline)
        current.state.rootSearchVisible = tree.results != nil ? true : (tree.complete ? false : nil)
        current.state.busy = tree.busy
        current.primaryAction = tree.primaryAction
        if try labels(window).contains("Main Window"), let back = tree.backAction {
            current.backAction = back
            current.state.navigationFingerprint = try encode(tree.texts)
        }
        if let results = tree.results, let action = tree.actionLabel {
            let contents = try scan(results, findControls: false, deadline: deadline)
            current.state.busy = current.state.busy || contents.busy
            current.state.fingerprint = try encode(contents.texts + [action])
        }
    } else if let windows = try attribute(application, kAXWindowsAttribute) as? [AXUIElement], windows.isEmpty {
        current.state.rootSearchVisible = false
    }
    if let input = current.input, try !ownsKeyboardFocus(input, processId: app.processIdentifier) {
        current.state.focused = false
        current.primaryAction = nil
        current.backAction = nil
    }
    return current
}

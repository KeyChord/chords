import AppKit
import ApplicationServices
import Foundation
import NodeAPI

#NodeModule(exports: [
    "readState": try NodeFunction { () throws -> NodePromise in
        try runOnMainQueue { try encode(snapshot().state) }
    },
    "setSearch": try NodeFunction { (query: String, remainingMs: Double) throws -> NodePromise in
        let deadline = ProcessInfo.processInfo.systemUptime + remainingMs / 1000
        return try runOnMainQueue {
            let current = try snapshot(deadline: deadline)
            let input = try current.searchInput()
            try checkDeadline(deadline)
            // WebKit's accessibility setter dispatches the input change as one edit.
            let error = AXUIElementSetAttributeValue(input, kAXValueAttribute as CFString, query as CFString)
            guard error == .success else { throw RaycastError.accessibility("set search text", error) }
            return ""
        }
    },
    "returnToRoot": try NodeFunction { (fingerprint: String, remainingMs: Double) throws -> NodePromise in
        let deadline = ProcessInfo.processInfo.systemUptime + remainingMs / 1000
        return try runOnMainQueue {
            let current = try snapshot(deadline: deadline)
            _ = try current.focusedElement()
            guard current.state.navigationFingerprint == fingerprint, let back = current.backAction else { return "false" }
            try checkDeadline(deadline)
            let error = AXUIElementPerformAction(back, kAXPressAction as CFString)
            switch error {
            case .success, .cannotComplete: return "true"
            case .invalidUIElement: return "false"
            default: throw RaycastError.accessibility("return to Root Search", error)
            }
        }
    },
    "activateSearch": try NodeFunction { (query: String, fingerprint: String, remainingMs: Double) throws -> NodePromise in
        let deadline = ProcessInfo.processInfo.systemUptime + remainingMs / 1000
        return try runOnMainQueue {
            let current = try snapshot(deadline: deadline)
            _ = try current.searchInput()
            guard current.state.value == query else { throw RaycastError.queryChanged }
            guard !current.state.busy, current.state.fingerprint == fingerprint,
                  let action = current.primaryAction else { return "false" }
            try checkDeadline(deadline)
            let error = AXUIElementPerformAction(action, kAXPressAction as CFString)
            switch error {
            case .success, .cannotComplete:
                // A callback can run despite cannotComplete. The JS caller observes
                // the outcome and never repeats a potentially dispatched action.
                return "true"
            case .invalidUIElement:
                return "false"
            default:
                throw RaycastError.accessibility("activate the primary result", error)
            }
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
    var input: AXUIElement?
    var primaryAction: AXUIElement?
    var backAction: AXUIElement?

    @MainActor
    func focusedElement() throws -> AXUIElement {
        guard state.bundleId == bundleId, state.focused, let input, let processId,
              try ownsKeyboardFocus(input, processId: processId) else { throw RaycastError.searchNotFocused }
        return input
    }

    @MainActor
    func searchInput() throws -> AXUIElement {
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

// Complete each MainActor operation on its originating JS queue. NodeSwift's
// default async executor cannot identify the environment when several addons load.
@NodeActor
private func runOnMainQueue(_ operation: @escaping @MainActor @Sendable () throws -> String) throws -> NodePromise {
    let deferred = try NodePromise.Deferred()
    let queue = try NodeAsyncQueue(label: "chord.raycast-search").handle()
    Task { @MainActor in
        let result = Result { try operation() }
        do {
            try queue.queue.run { [queue] in
                _ = queue
                try deferred(result.map { $0 as NodeValueConvertible })
            }
        } catch {
            NSLog("Chord Raycast completion queue unavailable: %@", String(describing: error))
        }
    }
    return deferred.promise
}

private func encode<T: Encodable>(_ value: T) throws -> String {
    String(decoding: try JSONEncoder().encode(value), as: UTF8.self)
}

@MainActor
private func attribute(_ element: AXUIElement, _ name: String) throws -> CFTypeRef? {
    var value: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, name as CFString, &value)
    switch error {
    case .success: return value
    case .noValue, .attributeUnsupported, .invalidUIElement, .cannotComplete: return nil
    case .apiDisabled: throw RaycastError.accessibilityDenied
    default: throw RaycastError.accessibility("read \(name)", error)
    }
}

@MainActor
private func elementAttribute(_ element: AXUIElement, _ name: String) throws -> AXUIElement? {
    guard let value = try attribute(element, name), CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
    return unsafeDowncast(value, to: AXUIElement.self)
}

@MainActor
private func ownsKeyboardFocus(_ input: AXUIElement, processId: pid_t) throws -> Bool {
    guard try attribute(input, kAXFocusedAttribute) as? Bool == true else { return false }
    let system = AXUIElementCreateSystemWide()
    AXUIElementSetMessagingTimeout(system, 0.1)
    if let application = try elementAttribute(system, kAXFocusedApplicationAttribute) {
        var pid: pid_t = 0
        if AXUIElementGetPid(application, &pid) == .success, pid == processId { return true }
    }
    if let focused = try elementAttribute(system, kAXFocusedUIElementAttribute), CFEqual(focused, input) { return true }
    // WebKit exposes different proxy elements through the app and system paths.
    // Its app-scoped focused field plus the foreground app establishes ownership.
    return NSWorkspace.shared.frontmostApplication?.processIdentifier == processId
}

@MainActor
private func labels(_ element: AXUIElement) throws -> [String] {
    var result: [String] = []
    for name in [kAXTitleAttribute, kAXDescriptionAttribute, kAXValueAttribute] {
        if let text = try attribute(element, name) as? String, !text.isEmpty, !result.contains(text) {
            result.append(text)
        }
    }
    return result
}

private struct Tree {
    var texts: [String] = []
    var busy = false
    var results: AXUIElement?
    var primaryAction: AXUIElement?
    var actionLabel: String?
    var backAction: AXUIElement?
    var complete = true
}

@MainActor
private func checkDeadline(_ deadline: TimeInterval) throws {
    guard ProcessInfo.processInfo.systemUptime < deadline else { throw RaycastError.deadlineExceeded }
}

@MainActor
private func scan(_ root: AXUIElement, findControls: Bool, deadline: TimeInterval) throws -> Tree {
    var tree = Tree()
    var stack: [(AXUIElement, Int)] = [(root, 0)]
    var visited: [AXUIElement] = []
    while let (element, depth) = stack.popLast() {
        try checkDeadline(deadline)
        // AX hash values are not element identities; distinct elements can share
        // a hash. Use CFEqual so a collision cannot hide results or the action.
        guard !visited.contains(where: { CFEqual($0, element) }) else { continue }
        visited.append(element)
        guard visited.count <= 512, depth <= 32 else { throw RaycastError.treeTooLarge }
        AXUIElementSetMessagingTimeout(element, 0.1)
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
                var actions: CFArray?
                let error = AXUIElementCopyActionNames(element, &actions)
                if error == .success, (actions as? [String])?.contains(kAXPressAction) == true {
                    tree.primaryAction = element
                    tree.actionLabel = text.joined(separator: " ")
                }
            }
        }
        let children = try attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? []
        // Preserve displayed result order in the fingerprint.
        stack += children.reversed().map { ($0, depth + 1) }
    }
    return tree
}

@MainActor
private func snapshot(deadline: TimeInterval? = nil) throws -> Snapshot {
    let deadline = min(deadline ?? .infinity, ProcessInfo.processInfo.systemUptime + 1)
    try checkDeadline(deadline)
    guard AXIsProcessTrusted() else { throw RaycastError.accessibilityDenied }
    let frontmost = NSWorkspace.shared.frontmostApplication
    var current = Snapshot(state: State(bundleId: frontmost?.bundleIdentifier,
                                       frontmostBundleId: frontmost?.bundleIdentifier))
    // Raycast's non-activating panel can own keyboard focus while NSWorkspace
    // still reports the underlying application. Inspect Raycast by bundle ID,
    // then establish ownership through the system-wide focused AX element.
    guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first else { return current }
    current.processId = app.processIdentifier
    let application = AXUIElementCreateApplication(app.processIdentifier)
    AXUIElementSetMessagingTimeout(application, 0.1)
    if let input = try elementAttribute(application, kAXFocusedUIElementAttribute) {
        AXUIElementSetMessagingTimeout(input, 0.1)
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

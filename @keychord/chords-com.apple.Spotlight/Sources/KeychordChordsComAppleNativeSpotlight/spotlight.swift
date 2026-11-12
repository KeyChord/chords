import AppKit
import ApplicationServices
import ChordNodeSupport
import Foundation
import NodeAPI

// Spotlight on macOS 27 is a panel of the Siri AI app (`com.apple.campo`), not of Spotlight.app.
// Everything here matches accessibility identifiers, which stay the same in every language.
// `spotlight://apps` opens the panel in its Applications view, whose Back button leads to the
// general search. Only Return opens the selected result: AXConfirm on the field reports success
// but opens nothing and leaves the panel without keyboard focus.

#NodeModule(exports: [
    "isSupported": try NodeFunction { () throws -> NodePromise in
        try mainActorPromise {
            NSWorkspace.shared.urlForApplication(withBundleIdentifier: panelBundleId) != nil ? "true" : "false"
        }
    },
    "isPanelOpen": try NodeFunction { () throws -> NodePromise in
        try mainActorPromise { try currentPanel() != nil ? "true" : "false" }
    },
    // Waits for the panel, then leaves any scoped view for the general search.
    "prepare": try NodeFunction { (remainingMs: Double) throws -> NodePromise in
        let deadline = Date(timeIntervalSinceNow: remainingMs / 1000)
        return try mainActorPromise { try await prepare(deadline: deadline) ? "true" : "false" }
    },
    // Runs `query` from an empty search, so no result of an earlier query can count as its own,
    // and waits until Spotlight has selected a result for it.
    "search": try NodeFunction { (query: String, remainingMs: Double) throws -> NodePromise in
        let deadline = Date(timeIntervalSinceNow: remainingMs / 1000)
        return try mainActorPromise { try await search(query, deadline: deadline) }
    },
    // Re-reads the panel right before Return is sent, and gives it the keyboard.
    "focus": try NodeFunction { (query: String) throws -> NodePromise in
        try mainActorPromise { try focus(query) ? "true" : "false" }
    },
    // Spotlight closes the panel once it has opened the selected result.
    "awaitClosed": try NodeFunction { (remainingMs: Double) throws -> NodePromise in
        let deadline = Date(timeIntervalSinceNow: remainingMs / 1000)
        return try mainActorPromise {
            try await awaitChange(deadline: deadline) { try currentPanel() == nil } ? "true" : "false"
        }
    },
])

private let panelBundleId = "com.apple.campo"
private let searchFieldId = "SpotlightSearchField"
private let resultCellPrefix = "Identifier:ResultCell,"
// "Search in Finder" and "Search The Web" rows. Spotlight shows them only once a search has
// found nothing to open, about five seconds in, so they never count as a result.
private let relatedSearchBundle = "Bundle:com.apple.spotlight.related_search"

private enum SpotlightError: Error, CustomStringConvertible {
    case accessibilityDenied
    case accessibility(String, AXError)
    case notRunning
    case treeTooLarge

    var description: String {
        switch self {
        case .accessibilityDenied:
            return "Chord needs Accessibility access to search Spotlight"
        case .accessibility(let operation, let error):
            return "Unable to \(operation) in Spotlight (AX error \(error.rawValue))"
        case .notRunning:
            return "Spotlight isn't running"
        case .treeTooLarge:
            return "Spotlight's accessibility tree exceeded the bounded search limit"
        }
    }
}

private enum Readiness: Equatable {
    case waiting
    case ready
    case nothingFound
}

private struct Panel {
    var window: AXUIElement
    var field: AXUIElement
    var hint: AXUIElement?
    var back: AXUIElement?
    var selectedResult: String?
}

/// Some elements of the panel answer reads with kAXErrorFailure (-25200), so any failure other
/// than a revoked permission means no value. A panel that stops answering reads as closed, and
/// every wait still ends at its deadline.
@MainActor
private func attribute(_ element: AXUIElement, _ name: String) throws -> CFTypeRef? {
    var value: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, name as CFString, &value)
    switch error {
    case .success: return value
    case .apiDisabled: throw SpotlightError.accessibilityDenied
    default: return nil
    }
}

@MainActor
private func string(_ element: AXUIElement, _ name: String) throws -> String? {
    try attribute(element, name) as? String
}

@MainActor
private func children(_ element: AXUIElement) throws -> [AXUIElement] {
    (try attribute(element, kAXChildrenAttribute) as? [AXUIElement]) ?? []
}

@MainActor
private func frame(_ element: AXUIElement) throws -> CGRect? {
    guard let position = try attribute(element, kAXPositionAttribute),
          let size = try attribute(element, kAXSizeAttribute),
          CFGetTypeID(position) == AXValueGetTypeID(), CFGetTypeID(size) == AXValueGetTypeID() else { return nil }
    var origin = CGPoint.zero
    var extent = CGSize.zero
    AXValueGetValue(unsafeDowncast(position, to: AXValue.self), .cgPoint, &origin)
    AXValueGetValue(unsafeDowncast(size, to: AXValue.self), .cgSize, &extent)
    return CGRect(origin: origin, size: extent)
}

@MainActor
private func application() -> NSRunningApplication? {
    NSRunningApplication.runningApplications(withBundleIdentifier: panelBundleId).first
}

/// The open panel, or nil when Spotlight shows none.
@MainActor
private func currentPanel() throws -> Panel? {
    guard AXIsProcessTrusted() else { throw SpotlightError.accessibilityDenied }
    guard let app = application() else { return nil }
    let root = AXUIElementCreateApplication(app.processIdentifier)
    AXUIElementSetMessagingTimeout(root, 0.25)
    for window in (try attribute(root, kAXWindowsAttribute) as? [AXUIElement]) ?? [] {
        if let panel = try scan(window) { return panel }
    }
    return nil
}

@MainActor
private func scan(_ window: AXUIElement) throws -> Panel? {
    var field: AXUIElement?
    var fieldParent: AXUIElement?
    var fieldGrandparent: AXUIElement?
    var selectedResult: String?
    var visited = 0
    var stack: [(element: AXUIElement, parent: AXUIElement?, grandparent: AXUIElement?, depth: Int)] =
        [(window, nil, nil, 0)]
    while let (element, parent, grandparent, depth) = stack.popLast() {
        visited += 1
        guard visited <= 400, depth <= 24 else { throw SpotlightError.treeTooLarge }
        // The results, or every installed app in the Applications view, are a collection list
        // that can hold thousands of elements. Its selection is all that matters, so it isn't
        // walked, which keeps each read of the panel to a few dozen elements.
        if try string(element, kAXSubroleAttribute) == "AXCollectionList" {
            let selected = (try attribute(element, kAXSelectedChildrenAttribute) as? [AXUIElement])?.first
            if let identifier = try selected.flatMap({ try string($0, kAXIdentifierAttribute) }),
               identifier.hasPrefix(resultCellPrefix) {
                selectedResult = identifier
            }
            continue
        }
        let identifier = try string(element, kAXIdentifierAttribute)
        if identifier == searchFieldId {
            field = element
            fieldParent = parent
            fieldGrandparent = grandparent
        }
        stack += try children(element).reversed().map { ($0, element, parent, depth + 1) }
    }
    guard let field else { return nil }
    var panel = Panel(window: window, field: field, selectedResult: selectedResult)
    // The completion beside the query ("calculator — Open") is a text area next to the field.
    if let fieldParent {
        panel.hint = try children(fieldParent).first { try string($0, kAXRoleAttribute) == kAXTextAreaRole }
    }
    // A scoped view such as Applications has a Back button left of the search area. Its label
    // is translated, so it is found by position.
    if let fieldGrandparent, let fieldFrame = try frame(field) {
        panel.back = try children(fieldGrandparent).first {
            guard try string($0, kAXRoleAttribute) == kAXButtonRole, let button = try frame($0) else { return false }
            return button.maxX <= fieldFrame.minX
        }
    }
    return panel
}

/// The completion Spotlight shows for the selected result, e.g. "calculator" in
/// "⁨calculator⁩ — ⁨Open⁩". Each part is wrapped in first-strong and pop isolates.
private func completion(_ hint: String) -> String {
    guard let start = hint.firstIndex(of: "\u{2068}") else { return hint }
    let rest = hint[hint.index(after: start)...]
    return String(rest[..<(rest.firstIndex(of: "\u{2069}") ?? rest.endIndex)])
}

// The field reports AXFocused even while another app has the keyboard, so focus is not part
// of readiness; `focus` raises the panel before Return instead.
@MainActor
private func readiness(_ panel: Panel, _ query: String) throws -> Readiness {
    guard try string(panel.field, kAXValueAttribute) == query,
          let selected = panel.selectedResult,
          let hint = try panel.hint.flatMap({ try string($0, kAXValueAttribute) }),
          completion(hint).range(of: query, options: [.anchored, .caseInsensitive]) != nil else {
        return .waiting
    }
    return selected.contains(relatedSearchBundle) ? .nothingFound : .ready
}

/// True when the panel still shows a result for `query`, after raising the panel. A panel that
/// opened before another app was activated loses the keyboard to it, so Return would go there.
/// Raising the window gives the keyboard back without activating Spotlight's app.
@MainActor
private func focus(_ query: String) throws -> Bool {
    guard let panel = try currentPanel(), try readiness(panel, query) == .ready else { return false }
    let error = AXUIElementPerformAction(panel.window, kAXRaiseAction as CFString)
    guard error == .success || error == .cannotComplete else {
        if error == .apiDisabled { throw SpotlightError.accessibilityDenied }
        throw SpotlightError.accessibility("bring the search to the front", error)
    }
    return true
}

@MainActor
private func setValue(_ field: AXUIElement, _ value: String) throws {
    let error = AXUIElementSetAttributeValue(field, kAXValueAttribute as CFString, value as CFString)
    guard error == .success else {
        if error == .apiDisabled { throw SpotlightError.accessibilityDenied }
        throw SpotlightError.accessibility("enter the search", error)
    }
}

@MainActor
private func prepare(deadline: Date) async throws -> Bool {
    var pressedBack = false
    return try await awaitChange(deadline: deadline) {
        guard let panel = try currentPanel() else { return false }
        guard let back = panel.back else { return true }
        // Press Back once. While the view changes, SwiftUI rebuilds the button, and a second
        // press of the rebuilt one fails (kAXErrorAttributeUnsupported) or would go back again.
        // A press that fails outright is tried again on the next change.
        if !pressedBack {
            let error = AXUIElementPerformAction(back, kAXPressAction as CFString)
            if error == .apiDisabled { throw SpotlightError.accessibilityDenied }
            pressedBack = error == .success || error == .cannotComplete
        }
        return false
    }
}

@MainActor
/// "closed" when the panel goes away mid-search. Spotlight closes it when another app is
/// activated, and a closing panel stays in the accessibility tree for a moment, so a run can
/// start on one that is about to go.
private func search(_ query: String, deadline: Date) async throws -> String {
    guard let panel = try currentPanel() else { return "closed" }
    var closed = false
    if try string(panel.field, kAXValueAttribute)?.isEmpty == false {
        try setValue(panel.field, "")
        let cleared = try await awaitChange(deadline: deadline) {
            guard let panel = try currentPanel() else { closed = true; return true }
            return panel.selectedResult == nil
        }
        if closed { return "closed" }
        guard cleared else { return "timeout" }
    }
    try setValue(panel.field, query)
    var outcome = Readiness.waiting
    let settled = try await awaitChange(deadline: deadline) {
        guard let panel = try currentPanel() else { closed = true; return true }
        outcome = try readiness(panel, query)
        return outcome != .waiting
    }
    if closed { return "closed" }
    guard settled else { return "timeout" }
    return outcome == .ready ? "ready" : "nothing"
}

private final class Wakeups: Sendable {
    let continuation: AsyncStream<Void>.Continuation
    init(_ continuation: AsyncStream<Void>.Continuation) { self.continuation = continuation }
}

private let changeNotifications = [
    kAXWindowCreatedNotification, kAXUIElementDestroyedNotification, kAXCreatedNotification,
    kAXFocusedUIElementChangedNotification, kAXValueChangedNotification,
    kAXSelectedChildrenChangedNotification, kAXSelectedTextChangedNotification,
    kAXLayoutChangedNotification, kAXFocusedWindowChangedNotification,
]

/// Runs `check`, then again on each accessibility notification from Spotlight's panel app,
/// until it returns true. The deadline only bounds a change that never comes.
@MainActor
private func awaitChange(deadline: Date, _ check: @MainActor () throws -> Bool) async throws -> Bool {
    guard let app = application() else { throw SpotlightError.notRunning }
    var created: AXObserver?
    let callback: AXObserverCallback = { _, _, _, context in
        guard let context else { return }
        Unmanaged<Wakeups>.fromOpaque(context).takeUnretainedValue().continuation.yield(())
    }
    guard AXObserverCreate(app.processIdentifier, callback, &created) == .success, let observer = created else {
        throw SpotlightError.accessibility("observe Spotlight", .failure)
    }
    let (wakeups, continuation) = AsyncStream.makeStream(of: Void.self, bufferingPolicy: .bufferingNewest(1))
    let context = Unmanaged.passRetained(Wakeups(continuation))
    let observed = AXUIElementCreateApplication(app.processIdentifier)
    for name in changeNotifications {
        AXObserverAddNotification(observer, observed, name as CFString, context.toOpaque())
    }
    let source = AXObserverGetRunLoopSource(observer)
    CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
    let timeout = Task {
        try? await Task.sleep(for: .seconds(max(0, deadline.timeIntervalSinceNow)))
        continuation.finish()
    }
    defer {
        timeout.cancel()
        CFRunLoopRemoveSource(CFRunLoopGetMain(), source, .commonModes)
        for name in changeNotifications {
            AXObserverRemoveNotification(observer, observed, name as CFString)
        }
        context.release()
    }
    // Observing first means a change right after this check still wakes the loop.
    if try check() { return true }
    for await _ in wakeups {
        if try check() { return true }
    }
    return false
}

// Native Safari automation exported to `src/js/safari.ts` through NodeSwift.
//
// The add-on sends Safari's `do JavaScript` Apple event directly and uses the Accessibility API
// to open Safari Settings at its Developer pane. No `osascript` helper process is involved.
// Browser interfaces are generated from SafariBrowser.sdef by swift-scripting-bridge.

import AppKit
import AXorcistRuntime
import ApplicationServices
import Carbon
import ChordNodeSupport
import Foundation
import NodeAPI
import ScriptingBridge

private let safariBundleIdentifier = "com.apple.Safari"

private enum SafariError: Error, CustomStringConvertible {
    case invalidJavaScript
    case safariNotFound
    case safariDidNotLaunch
    case accessibilityPermissionRequired
    case couldNotCreateKeyboardEvent
    case developerButtonNotFound
    case accessibility(String)
    case appleEvent(String)

    var description: String {
        switch self {
        case .invalidJavaScript:
            return "expected JavaScript source"
        case .safariNotFound:
            return "Safari could not be found"
        case .safariDidNotLaunch:
            return "Safari did not launch"
        case .accessibilityPermissionRequired:
            return "Accessibility permission is required to open Safari's Developer settings"
        case .couldNotCreateKeyboardEvent:
            return "could not create the Command-, keyboard event"
        case .developerButtonNotFound:
            return "could not find the Developer button in Safari Settings"
        case .accessibility(let detail):
            return "Safari Accessibility operation failed: \(detail)"
        case .appleEvent(let detail):
            return "Safari Apple event failed: \(detail)"
        }
    }
}

#NodeModule(exports: [
    "runJavaScript": try NodeFunction { (source: String) throws in
        try autoreleasepool {
            try runJavaScript(source)
        }
        return try NodeUndefined()
    },
    "openDeveloperSettings": try NodeFunction { () throws -> NodePromise in
        try mainActorPromise { try await openDeveloperSettings() }
    },
])

private func describe(_ error: Error) -> String {
    if let error = error as? SafariError {
        return error.description
    }
    if let localized = error as? LocalizedError, let text = localized.errorDescription {
        return text
    }
    return String(describing: error)
}

// MARK: - Safari Apple event

// Scripting Bridge reports Apple-event failures through its delegate. Capture them
// so they become ordinary Swift/JavaScript errors instead of Objective-C exceptions.
private final class ScriptingErrors: NSObject, SBApplicationDelegate {
    var error: Error?

    func eventDidFail(_ event: UnsafePointer<AppleEvent>, withError error: Error) -> Any? {
        if self.error == nil { self.error = error }
        return nil
    }
}

private func runJavaScript(_ source: String) throws {
    guard !source.isEmpty else {
        throw SafariError.invalidJavaScript
    }

    guard let application = SBApplication(bundleIdentifier: safariBundleIdentifier) else {
        throw SafariError.appleEvent("could not create Safari's scripting interface")
    }
    let errors = ScriptingErrors()
    let previousDelegate = application.delegate
    let previousTimeout = application.timeout
    application.delegate = errors
    application.timeout = 60 * 60 // Apple-event timeouts are in ticks (60 per second).
    defer {
        application.delegate = previousDelegate
        application.timeout = previousTimeout
    }
    let safari: SafariBrowser.Application = application
    let tab = safari.windows.first?.currentTabViewItem
    if let error = errors.error { throw SafariError.appleEvent(describe(error)) }
    guard let tab else { throw SafariError.appleEvent("Safari has no current tab") }
    let result = safari.doJavaScript(source, in: tab)
    if let error = errors.error { throw SafariError.appleEvent(describe(error)) }
    print("The title of the page is: \(result as? String ?? "")")
}

// MARK: - Safari Developer settings

@MainActor
private func runningSafari() -> NSRunningApplication? {
    NSRunningApplication.runningApplications(withBundleIdentifier: safariBundleIdentifier).first
}

@MainActor
private func activateSafari() async throws -> NSRunningApplication {
    var safari = runningSafari()
    if safari == nil {
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: safariBundleIdentifier) else {
            throw SafariError.safariNotFound
        }
        NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration(), completionHandler: nil)

        let deadline = Date(timeIntervalSinceNow: 5)
        while safari == nil && Date() < deadline {
            try await Task.sleep(for: .milliseconds(50))
            safari = runningSafari()
        }
    }

    guard let safari else {
        throw SafariError.safariDidNotLaunch
    }

    safari.activate()
    let deadline = Date(timeIntervalSinceNow: 2)
    while !safari.isActive && Date() < deadline {
        try await Task.sleep(for: .milliseconds(20))
    }
    return safari
}

private func pressCommandComma(processIdentifier: pid_t) throws {
    guard
        let source = CGEventSource(stateID: .hidSystemState),
        let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 43, keyDown: true),
        let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 43, keyDown: false)
    else {
        throw SafariError.couldNotCreateKeyboardEvent
    }

    keyDown.flags = .maskCommand
    keyUp.flags = .maskCommand
    keyDown.postToPid(processIdentifier)
    keyUp.postToPid(processIdentifier)
}

@MainActor
private func hasDeveloperLabel(_ element: Element) -> Bool {
    [element.title(), element.descriptionText(), element.identifier()].contains {
        $0?.localizedCaseInsensitiveCompare("Developer") == .orderedSame
    }
}

@MainActor
private func findDeveloperButton(_ element: Element, depth: Int = 0) -> Element? {
    guard depth <= 8 else {
        return nil
    }

    if element.role() == kAXButtonRole, hasDeveloperLabel(element) {
        return element
    }
    for child in (element.attribute(Attribute<[AXUIElement]>(kAXChildrenAttribute)) ?? []).map(Element.init) {
        if let button = findDeveloperButton(child, depth: depth + 1) {
            return button
        }
    }
    return nil
}

@MainActor
private func findToolbars(_ element: Element, depth: Int = 0) -> [Element] {
    guard depth <= 6 else {
        return []
    }

    var toolbars: [Element] = []
    for child in (element.attribute(Attribute<[AXUIElement]>(kAXChildrenAttribute)) ?? []).map(Element.init) {
        if child.role() == kAXToolbarRole {
            toolbars.append(child)
        } else {
            toolbars.append(contentsOf: findToolbars(child, depth: depth + 1))
        }
    }
    return toolbars
}

@MainActor
private func developerButton(in application: Element) -> Element? {
    var windows: [Element] = []
    if let focused = application.focusedWindow() {
        windows.append(focused)
    }
    for window in application.windows() ?? []
        where !windows.contains(window)
    {
        windows.append(window)
    }

    for window in windows {
        for toolbar in findToolbars(window) {
            if let button = findDeveloperButton(toolbar) {
                return button
            }
        }
    }
    return nil
}

@MainActor
private func openDeveloperSettings() async throws {
    guard AXPermissionHelpers.hasAccessibilityPermissions() else {
        throw SafariError.accessibilityPermissionRequired
    }

    let safari = try await activateSafari()
    try pressCommandComma(processIdentifier: safari.processIdentifier)

    let application = AXApp(safari).element
    let deadline = Date(timeIntervalSinceNow: 10)
    var button: Element?
    while button == nil && Date() < deadline {
        button = developerButton(in: application)
        if button == nil {
            try await Task.sleep(for: .milliseconds(100))
        }
    }

    guard let button else {
        throw SafariError.developerButtonNotFound
    }
    do {
        try button.performAction(.press)
    } catch let error as AccessibilitySystemError {
        throw SafariError.accessibility("Developer AXPress returned \(error.axError.rawValue)")
    }
}

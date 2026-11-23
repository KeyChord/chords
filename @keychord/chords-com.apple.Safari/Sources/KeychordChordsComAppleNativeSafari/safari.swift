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
    "moveTab": try NodeFunction { (direction: String) throws -> NodePromise in
        try mainActorPromise { try await moveSafariTab(direction) }
    },
    "moveTabGroup": try NodeFunction { (direction: String) throws -> NodePromise in
        try mainActorPromise { try await moveSafariTabGroup(direction) }
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

    if !safari.isActive {
        safari.activate()
        let deadline = Date(timeIntervalSinceNow: 2)
        while !safari.isActive && Date() < deadline {
            try await Task.sleep(for: .milliseconds(20))
        }
    }
    return safari
}

private func pressCommandComma() throws {
    guard
        let source = CGEventSource(stateID: .hidSystemState),
        let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 43, keyDown: true),
        let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 43, keyDown: false)
    else {
        throw SafariError.couldNotCreateKeyboardEvent
    }

    keyDown.flags = .maskCommand
    keyUp.flags = .maskCommand
    keyDown.post(tap: .cghidEventTap)
    keyUp.post(tap: .cghidEventTap)
}

private func settingAttribute<T>(_ element: AXUIElement, _ name: String) -> T? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else {
        return nil
    }
    return value as? T
}

@MainActor
private func settingsControl(in element: AXUIElement, roles: [String], label: String,
                             depth: Int = 0) -> AXUIElement? {
    guard depth <= 8 else { return nil }
    let role: String = settingAttribute(element, kAXRoleAttribute) ?? ""
    if roles.contains(role) {
        let labels = [kAXTitleAttribute, kAXDescriptionAttribute, kAXIdentifierAttribute]
        if labels.contains(where: { key in
            let name: String? = settingAttribute(element, key)
            return name?.localizedCaseInsensitiveCompare(label) == .orderedSame
        }) { return element }
    }
    let children: [AXUIElement] = settingAttribute(element, kAXChildrenAttribute) ?? []
    return children.lazy.compactMap {
        settingsControl(in: $0, roles: roles, label: label, depth: depth + 1)
    }.first
}

@MainActor
private func waitForSetting(timeout: TimeInterval = 10, _ find: @MainActor () -> AXUIElement?) async throws -> AXUIElement? {
    let deadline = Date(timeIntervalSinceNow: timeout)
    repeat {
        if let control = find() { return control }
        try await Task.sleep(for: .milliseconds(100))
    } while Date() < deadline
    return nil
}

private func pressSetting(_ control: AXUIElement, label: String) throws {
    let status = AXUIElementPerformAction(control, kAXPressAction as CFString)
    guard status == .success else {
        throw SafariError.accessibility("\(label) AXPress returned \(status.rawValue)")
    }
}

@MainActor
private func showSafariSettings(_ application: AXUIElement, safari: NSRunningApplication) throws {
    guard safari.isActive else { throw SafariError.accessibility("Safari did not receive focus") }
    func children(_ element: AXUIElement) -> [AXUIElement] {
        settingAttribute(element, kAXChildrenAttribute) ?? []
    }
    if let menuBar: AXUIElement = settingAttribute(application, kAXMenuBarAttribute),
       let appMenu = children(menuBar).first(where: { settingAttribute($0, kAXTitleAttribute) == "Safari" }),
       let menu = children(appMenu).first,
       let settings = children(menu).first(where: { item in
           let character: String? = settingAttribute(item, kAXMenuItemCmdCharAttribute)
           let modifiers: NSNumber? = settingAttribute(item, kAXMenuItemCmdModifiersAttribute)
           return character == "," && modifiers?.intValue == 0
       }),
       AXUIElementPerformAction(settings, kAXPressAction as CFString) == .success {
        return
    }
    try pressCommandComma()
}

@MainActor
private func openDeveloperSettings() async throws {
    guard AXPermissionHelpers.hasAccessibilityPermissions() else {
        throw SafariError.accessibilityPermissionRequired
    }

    let safari = try await activateSafari()
    let application = AXUIElementCreateApplication(safari.processIdentifier)
    AXUIElementSetMessagingTimeout(application, 0.8)
    let buttonRoles = [kAXButtonRole, kAXRadioButtonRole]
    func windows() -> [AXUIElement] { settingAttribute(application, kAXWindowsAttribute) ?? [] }
    func button(_ label: String, in window: AXUIElement) -> AXUIElement? {
        let children: [AXUIElement] = settingAttribute(window, kAXChildrenAttribute) ?? []
        for toolbar in children where
            (settingAttribute(toolbar, kAXRoleAttribute) as String?) == kAXToolbarRole {
            if let control = settingsControl(in: toolbar, roles: buttonRoles, label: label) {
                return control
            }
        }
        return nil
    }
    func button(_ label: String) -> AXUIElement? {
        windows().lazy.compactMap { button(label, in: $0) }.first
    }

    if button("Advanced") == nil { try showSafariSettings(application, safari: safari) }
    guard let advanced = try await waitForSetting({ button("Advanced") }) else {
        throw SafariError.accessibility("could not find the Advanced tab in Safari Settings")
    }
    if button("Developer") == nil {
        try pressSetting(advanced, label: "Advanced")
        guard let toggle = try await waitForSetting({
            windows().lazy.compactMap {
                settingsControl(in: $0, roles: [kAXCheckBoxRole], label: "Show features for web developers")
            }.first
        }) else {
            throw SafariError.accessibility("could not find the web developer features checkbox")
        }
        let checked: NSNumber? = settingAttribute(toggle, kAXValueAttribute)
        if checked?.boolValue != true {
            try pressSetting(toggle, label: "Show features for web developers")
        }
    }
    var developer = try await waitForSetting(timeout: 3) { button("Developer") }
    if developer == nil,
       let settings = windows().first(where: { button("Advanced", in: $0) != nil }),
       let close: AXUIElement = settingAttribute(settings, kAXCloseButtonAttribute) {
        // Some Safari versions rebuild the toolbar only when Settings is opened again.
        try pressSetting(close, label: "Close Settings")
        let deadline = ContinuousClock.now + .seconds(1)
        while windows().contains(where: { CFEqual($0, settings) }) && ContinuousClock.now < deadline {
            try await Task.sleep(for: .milliseconds(30))
        }
        try showSafariSettings(application, safari: safari)
        developer = try await waitForSetting { button("Developer") }
    }
    guard let developer else {
        throw SafariError.developerButtonNotFound
    }
    try pressSetting(developer, label: "Developer")
}

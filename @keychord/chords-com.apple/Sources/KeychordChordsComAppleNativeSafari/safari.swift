// Native Safari automation exported to `src/js/safari.ts` through NodeSwift.
//
// The add-on sends Safari's `do JavaScript` Apple event directly and uses the Accessibility API
// to open Safari Settings at its Developer pane. No `osascript` helper process is involved.

import AppKit
import ApplicationServices
import Carbon
import Foundation
import NodeAPI

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
    "openDeveloperSettings": try NodeFunction { () throws in
        try autoreleasepool {
            try openDeveloperSettings()
        }
        return try NodeUndefined()
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

private let safariEventClass = AEEventClass(0x73667269) // 'sfri'
private let doJavaScriptEvent = AEEventID(0x646F6A73) // 'dojs'
private let inParameter = AEKeyword(0x64636E6D) // 'dcnm'
private let windowClass = DescType(0x6377696E) // 'cwin'
private let currentTabProperty = DescType(0x63546162) // 'cTab'

private func objectSpecifier(
    desiredClass: DescType,
    container: NSAppleEventDescriptor?,
    keyForm: DescType,
    keyData: NSAppleEventDescriptor
) throws -> NSAppleEventDescriptor {
    let record = NSAppleEventDescriptor.record()
    record.setDescriptor(NSAppleEventDescriptor(typeCode: desiredClass), forKeyword: AEKeyword(keyAEDesiredClass))
    record.setDescriptor(NSAppleEventDescriptor(typeCode: keyForm), forKeyword: AEKeyword(keyAEKeyForm))
    record.setDescriptor(keyData, forKeyword: AEKeyword(keyAEKeyData))
    record.setDescriptor(container ?? NSAppleEventDescriptor.null(), forKeyword: AEKeyword(keyAEContainer))

    guard let descriptor = record.coerce(toDescriptorType: DescType(typeObjectSpecifier)) else {
        throw SafariError.appleEvent("could not create an object specifier")
    }
    return descriptor
}

private func runJavaScript(_ source: String) throws {
    guard !source.isEmpty else {
        throw SafariError.invalidJavaScript
    }

    let frontWindow = try objectSpecifier(
        desiredClass: windowClass,
        container: nil,
        keyForm: DescType(formAbsolutePosition),
        keyData: NSAppleEventDescriptor(int32: 1)
    )
    let currentTab = try objectSpecifier(
        desiredClass: DescType(typeProperty),
        container: frontWindow,
        keyForm: DescType(formPropertyID),
        keyData: NSAppleEventDescriptor(typeCode: currentTabProperty)
    )
    let target = NSAppleEventDescriptor(bundleIdentifier: safariBundleIdentifier)
    let event = NSAppleEventDescriptor(
        eventClass: safariEventClass,
        eventID: doJavaScriptEvent,
        targetDescriptor: target,
        returnID: AEReturnID(kAutoGenerateReturnID),
        transactionID: AETransactionID(kAnyTransactionID)
    )
    event.setParam(NSAppleEventDescriptor(string: source), forKeyword: AEKeyword(keyDirectObject))
    event.setParam(currentTab, forKeyword: inParameter)

    let reply: NSAppleEventDescriptor
    do {
        reply = try event.sendEvent(options: [.waitForReply], timeout: 60)
    } catch {
        throw SafariError.appleEvent(describe(error))
    }

    let errorNumber = reply.paramDescriptor(forKeyword: AEKeyword(keyErrorNumber))?.int32Value ?? 0
    if errorNumber != 0 {
        let message = reply.paramDescriptor(forKeyword: AEKeyword(keyErrorString))?.stringValue
            ?? "error \(errorNumber)"
        throw SafariError.appleEvent(message)
    }

    let result = reply.paramDescriptor(forKeyword: AEKeyword(keyDirectObject))?.stringValue ?? ""
    print("The title of the page is: \(result)")
}

// MARK: - Safari Developer settings

private func waitBriefly(_ interval: TimeInterval) {
    if Thread.isMainThread {
        RunLoop.main.run(until: Date(timeIntervalSinceNow: interval))
    } else {
        Thread.sleep(forTimeInterval: interval)
    }
}

private func runningSafari() -> NSRunningApplication? {
    NSRunningApplication.runningApplications(withBundleIdentifier: safariBundleIdentifier).first
}

private func activateSafari() throws -> NSRunningApplication {
    var safari = runningSafari()
    if safari == nil {
        guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: safariBundleIdentifier) else {
            throw SafariError.safariNotFound
        }
        NSWorkspace.shared.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration())

        let deadline = Date(timeIntervalSinceNow: 5)
        while safari == nil && Date() < deadline {
            waitBriefly(0.05)
            safari = runningSafari()
        }
    }

    guard let safari else {
        throw SafariError.safariDidNotLaunch
    }

    safari.activate()
    let deadline = Date(timeIntervalSinceNow: 2)
    while !safari.isActive && Date() < deadline {
        waitBriefly(0.02)
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

private func axValue(_ element: AXUIElement, _ attribute: String) -> AnyObject? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success else {
        return nil
    }
    return value
}

private func axElement(_ element: AXUIElement, _ attribute: String) -> AXUIElement? {
    guard let value = axValue(element, attribute), CFGetTypeID(value) == AXUIElementGetTypeID() else {
        return nil
    }
    return (value as! AXUIElement)
}

private func axChildren(_ element: AXUIElement, _ attribute: String = kAXChildrenAttribute) -> [AXUIElement] {
    guard let values = axValue(element, attribute) as? [AnyObject] else {
        return []
    }
    return values.compactMap { value in
        CFGetTypeID(value) == AXUIElementGetTypeID() ? (value as! AXUIElement) : nil
    }
}

private func axString(_ element: AXUIElement, _ attribute: String) -> String? {
    axValue(element, attribute) as? String
}

private func hasDeveloperLabel(_ element: AXUIElement) -> Bool {
    [kAXTitleAttribute, kAXDescriptionAttribute, kAXIdentifierAttribute].contains { attribute in
        axString(element, attribute)?.localizedCaseInsensitiveCompare("Developer") == .orderedSame
    }
}

private func findDeveloperButton(_ element: AXUIElement, depth: Int = 0) -> AXUIElement? {
    guard depth <= 8 else {
        return nil
    }

    if axString(element, kAXRoleAttribute) == kAXButtonRole, hasDeveloperLabel(element) {
        return element
    }
    for child in axChildren(element) {
        if let button = findDeveloperButton(child, depth: depth + 1) {
            return button
        }
    }
    return nil
}

private func findToolbars(_ element: AXUIElement, depth: Int = 0) -> [AXUIElement] {
    guard depth <= 6 else {
        return []
    }

    var toolbars: [AXUIElement] = []
    for child in axChildren(element) {
        if axString(child, kAXRoleAttribute) == kAXToolbarRole {
            toolbars.append(child)
        } else {
            toolbars.append(contentsOf: findToolbars(child, depth: depth + 1))
        }
    }
    return toolbars
}

private func developerButton(in application: AXUIElement) -> AXUIElement? {
    var windows: [AXUIElement] = []
    if let focused = axElement(application, kAXFocusedWindowAttribute) {
        windows.append(focused)
    }
    for window in axChildren(application, kAXWindowsAttribute)
        where !windows.contains(where: { CFEqual($0, window) })
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

private func openDeveloperSettings() throws {
    guard AXIsProcessTrusted() else {
        throw SafariError.accessibilityPermissionRequired
    }

    let safari = try activateSafari()
    try pressCommandComma(processIdentifier: safari.processIdentifier)

    let application = AXUIElementCreateApplication(safari.processIdentifier)
    let deadline = Date(timeIntervalSinceNow: 10)
    var button: AXUIElement?
    while button == nil && Date() < deadline {
        button = developerButton(in: application)
        if button == nil {
            waitBriefly(0.1)
        }
    }

    guard let button else {
        throw SafariError.developerButtonNotFound
    }
    let result = AXUIElementPerformAction(button, kAXPressAction as CFString)
    guard result == .success else {
        throw SafariError.accessibility("Developer AXPress returned \(result.rawValue)")
    }
}

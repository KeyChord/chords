// Native Chromium-family browser automation exported to `src/js/web.ts` through NodeSwift.
//
// The implementation sends the browser's `execute javascript` Apple event directly to the active
// tab of its front window. No `osascript` helper process is involved.
// Browser object interfaces are generated from Chromium.sdef by swift-scripting-bridge.

import AppKit
import Carbon
import CoreFoundation
import Foundation
import NodeAPI
import ScriptingBridge

private let supportedBrowserNames: Set<String> = [
    "Google Chrome",
    "Brave Browser",
    "Microsoft Edge",
    "Arc",
]

private enum WebError: Error, CustomStringConvertible {
    case invalidJavaScript
    case browserHasNoBundleIdentifier(String)
    case appleEvent(String)

    var description: String {
        switch self {
        case .invalidJavaScript:
            return "expected JavaScript source"
        case .browserHasNoBundleIdentifier(let name):
            return "frontmost browser \"\(name)\" has no bundle identifier"
        case .appleEvent(let detail):
            return "browser Apple event failed: \(detail)"
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
])

private func describe(_ error: Error) -> String {
    if let error = error as? WebError {
        return error.description
    }
    if let localized = error as? LocalizedError, let text = localized.errorDescription {
        return text
    }
    return String(describing: error)
}

// MARK: - Browser Apple event

// Scripting Bridge reports Apple-event failures through its delegate. Capture them
// so they become ordinary Swift/JavaScript errors instead of Objective-C exceptions.
private final class ScriptingErrors: NSObject, SBApplicationDelegate {
    var error: Error?

    func eventDidFail(_ event: UnsafePointer<AppleEvent>, withError error: Error) -> Any? {
        if self.error == nil { self.error = error }
        return nil
    }
}

// The generator does not handle commands whose direct parameter is their receiver.
// This is the tab selector emitted by Apple's sdp for Chromium's scripting dictionary.
@objc private protocol JavaScriptTab {
    @objc optional func executeJavascript(_ source: String) -> Any?
}
extension SBObject: JavaScriptTab {}

private func displayUnsupportedBrowser(_ name: String) {
    var responseFlags: CFOptionFlags = 0
    _ = CFUserNotificationDisplayAlert(
        0,
        CFOptionFlags(kCFUserNotificationPlainAlertLevel),
        nil,
        nil,
        nil,
        "Unsupported Browser" as CFString,
        "The frontmost app (\(name)) is not a supported browser." as CFString,
        "OK" as CFString,
        nil,
        nil,
        &responseFlags
    )
}

private func runJavaScript(_ source: String) throws {
    guard !source.isEmpty else {
        throw WebError.invalidJavaScript
    }

    guard let browser = NSWorkspace.shared.frontmostApplication else {
        displayUnsupportedBrowser("Unknown")
        return
    }
    let browserName = browser.localizedName ?? "Unknown"
    guard supportedBrowserNames.contains(browserName) else {
        displayUnsupportedBrowser(browserName)
        return
    }
    guard let bundleIdentifier = browser.bundleIdentifier else {
        throw WebError.browserHasNoBundleIdentifier(browserName)
    }

    guard let application = SBApplication(bundleIdentifier: bundleIdentifier) else {
        throw WebError.appleEvent("could not create the browser scripting interface")
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
    let scripting: Chromium.Application = application
    let tab = scripting.windows.first?.activeTab
    if let error = errors.error { throw WebError.appleEvent(describe(error)) }
    guard let tab else { throw WebError.appleEvent("the browser has no active tab") }
    guard let scriptableTab = tab as? JavaScriptTab, let execute = scriptableTab.executeJavascript else {
        throw WebError.appleEvent("the browser tab cannot execute JavaScript")
    }
    let result = execute(source)
    if let error = errors.error { throw WebError.appleEvent(describe(error)) }
    if let result {
        print(result)
    }
}

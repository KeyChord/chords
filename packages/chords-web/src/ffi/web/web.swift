// Native Chromium-family browser automation used by `src/js/web.ts` through Bun FFI.
//
// The implementation sends the browser's `execute javascript` Apple event directly to the active
// tab of its front window. No `osascript` helper process is involved.

import AppKit
import Carbon
import CoreFoundation
import Foundation

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

// MARK: - C ABI

/// Evaluates JavaScript in the active tab of the frontmost supported browser. Returns nil on
/// success or a heap-allocated error message that the caller releases with `chordsWebFree`.
@c
public func chordsWebRunJavaScript(
    _ source: UnsafePointer<CChar>?
) -> UnsafeMutablePointer<CChar>? {
    guard let source else {
        return strdup(WebError.invalidJavaScript.description)
    }

    return autoreleasepool {
        do {
            try runJavaScript(String(cString: source))
            return nil
        } catch {
            return strdup(describe(error))
        }
    }
}

@c
public func chordsWebFree(_ message: UnsafeMutablePointer<CChar>?) {
    free(message)
}

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

private let executeJavaScriptEventClass = AEEventClass(0x4372_5375) // 'CrSu'
private let executeJavaScriptEvent = AEEventID(0x4578_4A61) // 'ExJa'
private let javaScriptParameter = AEKeyword(0x4A76_5363) // 'JvSc'
private let windowClass = DescType(0x6377_696E) // 'cwin'
private let activeTabProperty = DescType(0x6163_5461) // 'acTa'

private func objectSpecifier(
    desiredClass: DescType,
    container: NSAppleEventDescriptor?,
    keyForm: DescType,
    keyData: NSAppleEventDescriptor
) throws -> NSAppleEventDescriptor {
    let record = NSAppleEventDescriptor.record()
    record.setDescriptor(
        NSAppleEventDescriptor(typeCode: desiredClass),
        forKeyword: AEKeyword(keyAEDesiredClass)
    )
    record.setDescriptor(
        NSAppleEventDescriptor(typeCode: keyForm),
        forKeyword: AEKeyword(keyAEKeyForm)
    )
    record.setDescriptor(keyData, forKeyword: AEKeyword(keyAEKeyData))
    record.setDescriptor(
        container ?? NSAppleEventDescriptor.null(),
        forKeyword: AEKeyword(keyAEContainer)
    )

    guard let descriptor = record.coerce(toDescriptorType: DescType(typeObjectSpecifier)) else {
        throw WebError.appleEvent("could not create an object specifier")
    }
    return descriptor
}

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

    let frontWindow = try objectSpecifier(
        desiredClass: windowClass,
        container: nil,
        keyForm: DescType(formAbsolutePosition),
        keyData: NSAppleEventDescriptor(int32: 1)
    )
    let activeTab = try objectSpecifier(
        desiredClass: DescType(typeProperty),
        container: frontWindow,
        keyForm: DescType(formPropertyID),
        keyData: NSAppleEventDescriptor(typeCode: activeTabProperty)
    )
    let target = NSAppleEventDescriptor(bundleIdentifier: bundleIdentifier)
    let event = NSAppleEventDescriptor(
        eventClass: executeJavaScriptEventClass,
        eventID: executeJavaScriptEvent,
        targetDescriptor: target,
        returnID: AEReturnID(kAutoGenerateReturnID),
        transactionID: AETransactionID(kAnyTransactionID)
    )
    event.setParam(activeTab, forKeyword: AEKeyword(keyDirectObject))
    event.setParam(NSAppleEventDescriptor(string: source), forKeyword: javaScriptParameter)

    let reply: NSAppleEventDescriptor
    do {
        reply = try event.sendEvent(options: [.waitForReply], timeout: 60)
    } catch {
        throw WebError.appleEvent(describe(error))
    }

    let errorNumber = reply.paramDescriptor(forKeyword: AEKeyword(keyErrorNumber))?.int32Value ?? 0
    if errorNumber != 0 {
        let message = reply.paramDescriptor(forKeyword: AEKeyword(keyErrorString))?.stringValue
            ?? "error \(errorNumber)"
        throw WebError.appleEvent(message)
    }

    if let result = reply.paramDescriptor(forKeyword: AEKeyword(keyDirectObject)) {
        print(result.stringValue ?? result.description)
    }
}

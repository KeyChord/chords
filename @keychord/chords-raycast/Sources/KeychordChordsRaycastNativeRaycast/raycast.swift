import AppKit
import ApplicationServices
import Foundation
import NodeAPI

#NodeModule(exports: [
    "readFocus": try NodeFunction { () throws -> NodePromise in
        try readFocusPromise()
    },
])

private struct Focus: Encodable {
    var bundleId: String?
    var role: String?
    var placeholder: String?
    var description: String?
    var focused: Bool = false
}

// Capture the calling JS queue before moving accessibility reads to MainActor.
// Complete on that queue explicitly: NodeSwift's default async executor cannot
// identify the originating environment when several addons are loaded.
@NodeActor
private func readFocusPromise() throws -> NodePromise {
    let deferred = try NodePromise.Deferred()
    let queue = try NodeAsyncQueue(label: "chord.raycast-focus").handle()
    Task { @MainActor in
        let result = Result { try readFocus() }
        do {
            try queue.queue.run { [queue] in
                _ = queue
                try deferred(result.map { $0 as NodeValueConvertible })
            }
        } catch {
            NSLog("Chord Raycast focus completion queue unavailable: %@", String(describing: error))
        }
    }
    return deferred.promise
}

private enum FocusError: Error, CustomStringConvertible {
    case accessibilityDenied
    case accessibility(AXError)

    var description: String {
        switch self {
        case .accessibilityDenied:
            return "Chord needs Accessibility access to check Raycast's input focus"
        case .accessibility(let error):
            return "Unable to read Raycast's input focus (AX error \(error.rawValue))"
        }
    }
}

@MainActor
private func attribute(_ element: AXUIElement, _ name: String) throws -> CFTypeRef? {
    var value: CFTypeRef?
    let error = AXUIElementCopyAttributeValue(element, name as CFString, &value)
    switch error {
    case .success:
        return value
    case .noValue, .attributeUnsupported, .invalidUIElement, .cannotComplete:
        // Raycast's window and its WebKit input can disappear between snapshots.
        return nil
    case .apiDisabled:
        throw FocusError.accessibilityDenied
    default:
        throw FocusError.accessibility(error)
    }
}

@MainActor
private func readFocus() throws -> String {
    guard AXIsProcessTrusted() else { throw FocusError.accessibilityDenied }
    let frontmost = NSWorkspace.shared.frontmostApplication
    var focus = Focus(bundleId: frontmost?.bundleIdentifier)
    if let frontmost, focus.bundleId == "com.raycast.macos" {
        let application = AXUIElementCreateApplication(frontmost.processIdentifier)
        AXUIElementSetMessagingTimeout(application, 0.1)
        if let value = try attribute(application, kAXFocusedUIElementAttribute),
           CFGetTypeID(value) == AXUIElementGetTypeID() {
            let element = unsafeDowncast(value, to: AXUIElement.self)
            AXUIElementSetMessagingTimeout(element, 0.1)
            focus.role = try attribute(element, kAXRoleAttribute) as? String
            focus.placeholder = try attribute(element, kAXPlaceholderValueAttribute) as? String
            focus.description = try attribute(element, kAXDescriptionAttribute) as? String
            focus.focused = try attribute(element, kAXFocusedAttribute) as? Bool ?? false
            // Raycast's WebKit controls can be hosted by another process; querying
            // the app's focused element establishes ownership without relying on
            // that element's PID. Reject a concurrent foreground-app change.
            if NSWorkspace.shared.frontmostApplication?.processIdentifier != frontmost.processIdentifier {
                focus.focused = false
            }
        }
    }
    return String(decoding: try JSONEncoder().encode(focus), as: UTF8.self)
}

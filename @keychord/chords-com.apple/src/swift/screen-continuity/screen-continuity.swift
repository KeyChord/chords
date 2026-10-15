// iPhone Mirroring renders the phone in its main window. AX supplies that window's
// geometry and connection state. Device coordinates exclude its toolbar and bezel.
// Mouse input is shared through Rust's `chord.click`.
import AppKit
import ApplicationServices
import CoreGraphics
import Foundation
import NodeAPI

private let mirroringBundleID = "com.apple.ScreenContinuity"

private struct MirroringError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

private struct ScreenBounds: Codable, Equatable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
    var windowId: UInt32 = 0
    var windowBounds: WindowBounds?

    var rect: CGRect { CGRect(x: x, y: y, width: width, height: height) }
    var isValid: Bool {
        [x, y, width, height].allSatisfy(\.isFinite) && width >= 1 && height >= 1
    }
}

private struct WindowBounds: Codable, Equatable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double

    init(_ rect: CGRect) {
        x = rect.minX
        y = rect.minY
        width = rect.width
        height = rect.height
    }
}

#NodeModule(exports: [
    "getScreenBounds": try NodeFunction { () throws -> NodePromise in
        try mainActorPromise { try getScreenBounds() }
    },
    "validateScreenBounds": try NodeFunction { (request: String) throws -> NodePromise in
        try mainActorPromise {
            let decoded = try JSONDecoder().decode(ScreenBounds.self, from: Data(request.utf8))
            try validateScreenBounds(decoded)
            return nil
        }
    },
])

private func axValue(_ element: AXUIElement, _ attribute: String) -> CFTypeRef? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success else {
        return nil
    }
    return value
}

private func axChildren(_ element: AXUIElement, attribute: String = kAXChildrenAttribute) -> [AXUIElement] {
    guard let values = axValue(element, attribute) as? [AXUIElement] else { return [] }
    return values
}

private func screenWindow(_ application: AXUIElement) throws -> AXUIElement {
    // Settings and connection dialogs also belong to this process. Select only the phone window.
    guard let window = axChildren(application, attribute: kAXWindowsAttribute).first(where: {
        axValue($0, kAXIdentifierAttribute) as? String == "iphone-mirroring-main"
    }) else {
        throw MirroringError("Could not find the mirrored iPhone window; open iPhone Mirroring and connect your iPhone")
    }
    return window
}

private func bounds(of window: AXUIElement) throws -> ScreenBounds {
    guard
        let rawPosition = axValue(window, kAXPositionAttribute),
        let rawSize = axValue(window, kAXSizeAttribute),
        CFGetTypeID(rawPosition) == AXValueGetTypeID(),
        CFGetTypeID(rawSize) == AXValueGetTypeID()
    else {
        throw MirroringError("Could not read the mirrored iPhone screen bounds")
    }
    var position = CGPoint.zero
    var size = CGSize.zero
    guard
        AXValueGetValue(rawPosition as! AXValue, .cgPoint, &position),
        AXValueGetValue(rawSize as! AXValue, .cgSize, &size)
    else {
        throw MirroringError("Could not decode the mirrored iPhone screen bounds")
    }
    let result = ScreenBounds(x: position.x, y: position.y, width: size.width, height: size.height)
    guard result.isValid else { throw MirroringError("The mirrored iPhone screen has invalid bounds") }
    return result
}

private func hasConnectionOverlay(_ element: AXUIElement, depth: Int = 0) -> Bool {
    guard depth < 10 else { return false }
    let role = axValue(element, kAXRoleAttribute) as? String
    if role == kAXToolbarRole { return false }
    // The live phone stream is opaque to AX. Paused, timed-out and connection screens
    // contain native text. Detect those without depending on their localized wording.
    if role == kAXStaticTextRole || role == kAXTextFieldRole || role == kAXSheetRole { return true }
    return axChildren(element).contains { hasConnectionOverlay($0, depth: depth + 1) }
}

private func mirroringApplication() throws -> (NSRunningApplication, AXUIElement) {
    guard AXIsProcessTrusted() else {
        throw MirroringError("Accessibility permission is required to click the mirrored iPhone screen")
    }
    guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: mirroringBundleID).first else {
        throw MirroringError("Open iPhone Mirroring and connect your iPhone before clicking")
    }
    return (app, AXUIElementCreateApplication(app.processIdentifier))
}

@MainActor
private func getScreenBounds() throws -> String {
    let (app, application) = try mirroringApplication()
    let window = try screenWindow(application)
    guard !hasConnectionOverlay(window) else {
        throw MirroringError("iPhone Mirroring is not connected; connect your iPhone before clicking")
    }
    let screen = try screenBounds(window, processIdentifier: app.processIdentifier)
    return String(decoding: try JSONEncoder().encode(screen), as: UTF8.self)
}

private func screenBounds(_ element: AXUIElement, processIdentifier: pid_t) throws -> ScreenBounds {
    let screen = try bounds(of: element)
    guard let windows = CGWindowListCopyWindowInfo(.optionOnScreenOnly, kCGNullWindowID) as? [[String: Any]] else {
        throw MirroringError("Could not enumerate the mirrored iPhone window")
    }
    for window in windows where window[kCGWindowLayer as String] as? Int == 0 {
        guard window[kCGWindowOwnerPID as String] as? Int32 == processIdentifier,
              let rawBounds = window[kCGWindowBounds as String] as? NSDictionary,
              let frame = CGRect(dictionaryRepresentation: rawBounds),
              abs(frame.minX - screen.x) < 1, abs(frame.minY - screen.y) < 1,
              abs(frame.width - screen.width) < 1, abs(frame.height - screen.height) < 1,
              let id = window[kCGWindowNumber as String] as? UInt32 else { continue }
        // Match the exact AX phone window, even when other windows cover it.
        // Retain WindowServer geometry for routing, independently of the device viewport.
        guard let device = deviceScreenRect(window: frame) else {
            throw MirroringError("Could not determine the mirrored iPhone device bounds: invalid window geometry (\(frame))")
        }
        return ScreenBounds(x: device.minX, y: device.minY, width: device.width, height: device.height,
                            windowId: id, windowBounds: WindowBounds(frame))
    }
    throw MirroringError("The mirrored iPhone window is not on-screen")
}

@MainActor
private func validateScreenBounds(_ expected: ScreenBounds) throws {
    guard expected.isValid, expected.windowId != 0, expected.windowBounds != nil else {
        throw MirroringError("Invalid mirrored iPhone window")
    }
    let (app, application) = try mirroringApplication()
    let window = try screenWindow(application)

    guard try screenBounds(window, processIdentifier: app.processIdentifier) == expected else {
        throw MirroringError("The mirrored iPhone window moved, resized or was replaced; retry the click sequence")
    }
    guard !hasConnectionOverlay(window) else {
        throw MirroringError("iPhone Mirroring disconnected during the click sequence")
    }
}

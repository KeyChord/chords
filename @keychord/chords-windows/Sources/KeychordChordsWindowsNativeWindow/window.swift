import AppKit
import AXorcistRuntime
import ApplicationServices
import ChordNodeSupport
import Foundation
import NodeAPI

#NodeModule(exports: [
    "runWindowAction": try NodeFunction {
        (bundleId: String?, action: String, request: String) throws -> NodePromise in
        try mainActorPromise {
            try await runWindowAction(bundleId: bundleId, action: action, request: request)
        }
    },
])

private struct WindowError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

private struct Dimension: Decodable {
    let value: Double
    let unit: String

    func resolve(_ extent: CGFloat) throws -> CGFloat {
        let result: Double
        switch unit {
        case "pixels": result = value
        case "fraction": result = Double(extent) * value
        case "divisor": result = Double(extent) / value
        default: throw WindowError("Unknown window dimension unit")
        }
        guard value.isFinite, result.isFinite, abs(result) <= 9_007_199_254_740_991 else {
            throw WindowError("Window dimension is outside the safe numeric range")
        }
        return CGFloat(result)
    }
}

private struct Dimensions: Decodable {
    let width: Dimension?
    let height: Dimension?
    let left: Dimension?
    let top: Dimension?
    let right: Bool?
    let preset: String?
}

@MainActor
private func windowElement(_ app: Element) throws -> Element {
    guard let window = app.focusedWindow() ?? app.mainWindow() else {
        throw WindowError("The target application has no focused or main window")
    }
    return window
}

/// AppKit uses bottom-left coordinates; AX positions use top-left coordinates on the primary display.
@MainActor
private func screenBounds(for window: CGRect) throws -> CGRect {
    let screens = NSScreen.screens
    guard let primary = screens.first else { throw WindowError("No screen is available") }
    func global(_ frame: CGRect) -> CGRect {
        CGRect(x: frame.minX, y: primary.frame.maxY - frame.maxY, width: frame.width, height: frame.height)
    }
    func overlap(_ screen: NSScreen) -> CGFloat {
        let intersection = window.intersection(global(screen.frame))
        return intersection.isNull ? 0 : intersection.width * intersection.height
    }
    func distance(_ screen: NSScreen) -> CGFloat {
        let frame = global(screen.frame)
        return hypot(window.midX - frame.midX, window.midY - frame.midY)
    }
    // Prefer the display containing most of the window, even when the pointer is elsewhere.
    let screen = screens.max {
        overlap($0) == overlap($1) ? distance($0) > distance($1) : overlap($0) < overlap($1)
    }!
    return global(screen.visibleFrame)
}

@MainActor
private func requireSettable(_ window: Element, _ name: String) throws {
    guard window.isAttributeSettable(named: name) else {
        throw WindowError("The target window does not allow changing \(name)")
    }
}

@MainActor
private func checkGeometryChange(_ error: AXError, attribute: String) throws {
    guard error == .success else {
        throw WindowError("Could not set \(attribute) (AX error \(error.rawValue))")
    }
}

@MainActor
private func readSize(_ window: Element) throws -> CGSize {
    guard let size = window.size() else { throw WindowError("Could not read the window size") }
    return size
}

@MainActor
private func readPosition(_ window: Element) throws -> CGPoint {
    guard let point = window.position() else { throw WindowError("Could not read the window position") }
    return point
}

private func matches(_ actual: CGSize, _ expected: CGSize) -> Bool {
    abs(actual.width - expected.width) <= 1 && abs(actual.height - expected.height) <= 1
}

@MainActor
private func settledSize(_ window: Element, expected: CGSize) async throws -> CGSize {
    let deadline = ContinuousClock.now + .milliseconds(150)
    var size = try readSize(window)
    while !matches(size, expected), ContinuousClock.now < deadline {
        try await Task.sleep(for: .milliseconds(20))
        size = try readSize(window)
    }
    return size
}

@MainActor
private func verifyPosition(_ window: Element, expected: CGPoint) async throws {
    let deadline = ContinuousClock.now + .milliseconds(150)
    var point = try readPosition(window)
    func matches() -> Bool { abs(point.x - expected.x) <= 1 && abs(point.y - expected.y) <= 1 }
    while !matches(), ContinuousClock.now < deadline {
        try await Task.sleep(for: .milliseconds(20))
        point = try readPosition(window)
    }
    guard matches() else {
        throw WindowError("The application constrained the window position to \(point.x),\(point.y); requested \(expected.x),\(expected.y)")
    }
}

/// AXSize may be capped at the room remaining beyond the current origin. Resize
/// at an origin with enough room, then restore the requested origin to allow overflow.
@MainActor
private func resizeWindow(_ window: Element, to target: CGSize, at origin: CGPoint, screen: CGRect) async throws {
    try requireSettable(window, kAXSizeAttribute)
    var failure: Error?
    do {
        try checkGeometryChange(window.setSize(target), attribute: kAXSizeAttribute)
        var actual = try await settledSize(window, expected: target)
        // AppKit may keep a strip of the current window visible at the staging
        // origin. Each successful expansion makes more room for the next retry.
        for _ in 0..<12 {
            if matches(actual, target) || (actual.width >= target.width && actual.height >= target.height) { break }
            let staging = CGPoint(x: min(origin.x, screen.maxX - target.width), y: min(origin.y, screen.maxY - target.height))
            if staging == origin { break }
            try requireSettable(window, kAXPositionAttribute)
            try checkGeometryChange(window.setPosition(staging), attribute: kAXPositionAttribute)
            try checkGeometryChange(window.setSize(target), attribute: kAXSizeAttribute)
            let expanded = try await settledSize(window, expected: target)
            if expanded.width <= actual.width + 1 && expanded.height <= actual.height + 1 { break }
            actual = expanded
        }
    } catch { failure = error }
    // Restore on success and failure, including application-driven origin changes.
    do {
        if try readPosition(window) != origin {
            try checkGeometryChange(window.setPosition(origin), attribute: kAXPositionAttribute)
        }
    } catch {
        throw WindowError("Could not restore the window position after resizing: \(error)\(failure.map { "; resize failed: \($0)" } ?? "")")
    }
    if let failure { throw failure }
    let applied = try await settledSize(window, expected: target)
    guard matches(applied, target) else {
        throw WindowError("The application limited the window size to \(applied.width)x\(applied.height); requested \(target.width)x\(target.height)")
    }
    try await verifyPosition(window, expected: origin)
}

@MainActor
private func runWindowAction(bundleId: String?, action: String, request: String) async throws {
    guard ["SIZE", "POSITION", "FRAME", "PRESET"].contains(action) else { throw WindowError("Unknown window action") }
    let dimensions = try JSONDecoder().decode(Dimensions.self, from: Data(request.utf8))
    guard dimensions.width != nil || dimensions.height != nil || dimensions.preset != nil || (action == "FRAME" && dimensions.left != nil && dimensions.top != nil) else {
        throw WindowError("Expected window dimensions")
    }
    guard AXPermissionHelpers.hasAccessibilityPermissions() else { throw WindowError("Accessibility permission is required to manage windows") }
    let target: NSRunningApplication?
    if let bundleId {
        target = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first
    } else {
        target = NSWorkspace.shared.frontmostApplication
    }
    guard let target else { throw WindowError("The target application is not running") }
    let app = AXApp(target).element
    app.setMessagingTimeout(2)
    let window = try windowElement(app)
    var size = try readSize(window)
    var position = try readPosition(window)
    let screen = try screenBounds(for: CGRect(origin: position, size: size))
    if action == "PRESET" {
        guard let preset = dimensions.preset, let frame = windowPresetFrame(preset, window: CGRect(origin: position, size: size), screen: screen) else {
            throw WindowError("Unknown window preset")
        }
        let resizing = ["HORIZONTAL", "VERTICAL", "FILL"].contains(preset)
        try requireSettable(window, kAXPositionAttribute)
        if resizing { try requireSettable(window, kAXSizeAttribute) }
        position = frame.origin
        try checkGeometryChange(window.setPosition(position), attribute: kAXPositionAttribute)
        if resizing { try await resizeWindow(window, to: frame.size, at: position, screen: screen) }
        else { try await verifyPosition(window, expected: position) }
        return
    }
    let horizontal = try dimensions.width?.resolve(screen.width)
    let vertical = try dimensions.height?.resolve(screen.height)
    if action == "FRAME" {
        guard let left = dimensions.left, let top = dimensions.top else { throw WindowError("Expected left and top offsets") }
        size = CGSize(width: horizontal ?? size.width, height: vertical ?? size.height)
        guard size.width > 0, size.height > 0 else { throw WindowError("Window sizes must be positive") }
        position = CGPoint(x: screen.minX + (try left.resolve(screen.width)), y: screen.minY + (try top.resolve(screen.height)))
        let resizing = horizontal != nil || vertical != nil
        if resizing { try requireSettable(window, kAXSizeAttribute) }
        try requireSettable(window, kAXPositionAttribute)
        // Move first so full-screen-sized windows are not limited by their previous origin.
        // Both dimensions and offsets use the same captured display bounds.
        try checkGeometryChange(window.setPosition(position), attribute: kAXPositionAttribute)
        if resizing { try await resizeWindow(window, to: size, at: position, screen: screen) }
        else { try await verifyPosition(window, expected: position) }
        return
    }
    let name = action == "SIZE" ? kAXSizeAttribute : kAXPositionAttribute
    try requireSettable(window, name)
    if action == "SIZE" {
        size = CGSize(width: horizontal ?? size.width, height: vertical ?? size.height)
        guard size.width > 0, size.height > 0 else { throw WindowError("Window sizes must be positive") }
        try await resizeWindow(window, to: size, at: position, screen: screen)
        return
    } else {
        if let horizontal { position.x = screen.minX + horizontal - (dimensions.right == true ? size.width : 0) }
        if let vertical { position.y = screen.minY + vertical }
    }
    try checkGeometryChange(window.setPosition(position), attribute: kAXPositionAttribute)
    try await verifyPosition(window, expected: position)
}

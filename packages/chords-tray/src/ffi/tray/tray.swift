// Native macOS menu-bar-extra scanner used by `src/js/tray.ts` through Bun FFI.
//
// macOS has no public API for enumerating status items. This preserves the existing handler's
// strategy: inspect Accessibility elements along the main menu bar, select one by position, use
// AXPress for a left click when available, and otherwise post a mouse click at its center.

import ApplicationServices
import CoreGraphics
import Foundation

private enum TrayClickType: String {
    case left
    case right
}

private enum TrayError: Error, CustomStringConvertible {
    case invalidClickType(String)
    case accessibilityPermissionRequired
    case couldNotCreateMouseEvent(String)

    var description: String {
        switch self {
        case .invalidClickType(let value):
            return "invalid tray click type \"\(value)\" (expected \"left\" or \"right\")"
        case .accessibilityPermissionRequired:
            return "Accessibility permission is required to interact with menu bar items"
        case .couldNotCreateMouseEvent(let event):
            return "could not create the \(event) mouse event"
        }
    }
}

// MARK: - C ABI

/// Runs one tray action. Returns nil on success or a heap-allocated error message that the caller
/// releases with `chordsTrayFree`.
@c
public func chordsTrayRun(
    _ trayIndex: Int32,
    _ clickTypeValue: UnsafePointer<CChar>?
) -> UnsafeMutablePointer<CChar>? {
    let rawClickType = clickTypeValue.map { String(cString: $0) } ?? TrayClickType.left.rawValue

    return autoreleasepool {
        do {
            guard let clickType = TrayClickType(rawValue: rawClickType) else {
                throw TrayError.invalidClickType(rawClickType)
            }
            try runTrayAction(trayIndex: Int(trayIndex), clickType: clickType)
            return nil
        } catch {
            return strdup(describe(error))
        }
    }
}

@c
public func chordsTrayFree(_ message: UnsafeMutablePointer<CChar>?) {
    free(message)
}

private func describe(_ error: Error) -> String {
    if let error = error as? TrayError {
        return error.description
    }
    if let localized = error as? LocalizedError, let text = localized.errorDescription {
        return text
    }
    return String(describing: error)
}

// MARK: - Accessibility values

private func axValue(_ element: AXUIElement, _ attribute: String) -> AnyObject? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success else {
        return nil
    }
    return value
}

private func axString(_ element: AXUIElement, _ attribute: String) -> String? {
    axValue(element, attribute) as? String
}

private func axPoint(_ element: AXUIElement, _ attribute: String) -> CGPoint? {
    guard let value = axValue(element, attribute), CFGetTypeID(value) == AXValueGetTypeID() else {
        return nil
    }

    let axValue = value as! AXValue
    guard AXValueGetType(axValue) == .cgPoint else {
        return nil
    }
    var point = CGPoint.zero
    guard AXValueGetValue(axValue, .cgPoint, &point) else {
        return nil
    }
    return point
}

private func axSize(_ element: AXUIElement, _ attribute: String) -> CGSize? {
    guard let value = axValue(element, attribute), CFGetTypeID(value) == AXValueGetTypeID() else {
        return nil
    }

    let axValue = value as! AXValue
    guard AXValueGetType(axValue) == .cgSize else {
        return nil
    }
    var size = CGSize.zero
    guard AXValueGetValue(axValue, .cgSize, &size) else {
        return nil
    }
    return size
}

private func actionNames(_ element: AXUIElement) -> [String] {
    var names: CFArray?
    guard AXUIElementCopyActionNames(element, &names) == .success else {
        return []
    }
    return names as? [String] ?? []
}

private func element(atX x: CGFloat, y: CGFloat, systemWide: AXUIElement) -> AXUIElement? {
    var element: AXUIElement?
    guard AXUIElementCopyElementAtPosition(systemWide, Float(x), Float(y), &element) == .success else {
        return nil
    }
    return element
}

private func isMenuBar(_ element: AXUIElement?) -> Bool {
    guard let element else {
        return false
    }
    return axString(element, kAXRoleAttribute) == kAXMenuBarRole
}

// MARK: - Item discovery

private struct TrayElement {
    let element: AXUIElement
    let x: CGFloat
}

private func firstItemFromLeft(
    bounds: CGRect,
    y: CGFloat,
    systemWide: AXUIElement
) -> TrayElement? {
    var x = bounds.midX
    var increment = bounds.width / 4

    // Find the right edge of the application-menu AXMenuBar region.
    while increment >= 1 {
        while isMenuBar(element(atX: x + increment, y: y, systemWide: systemWide)) {
            x += increment
        }
        increment /= 2
    }

    let item = element(atX: x + 1, y: y, systemWide: systemWide)
    guard let item, !isMenuBar(item), let position = axPoint(item, kAXPositionAttribute) else {
        return nil
    }
    return TrayElement(element: item, x: position.x)
}

private func firstItemFromRight(
    bounds: CGRect,
    y: CGFloat,
    systemWide: AXUIElement,
    increment: CGFloat
) -> TrayElement? {
    var x = bounds.maxX - increment
    while x >= bounds.minX {
        if let item = element(atX: x, y: y, systemWide: systemWide),
           !isMenuBar(item),
           let position = axPoint(item, kAXPositionAttribute)
        {
            return TrayElement(element: item, x: position.x)
        }
        x -= increment
    }
    return nil
}

private func trayElement(at index: Int, bounds: CGRect, y: CGFloat) -> TrayElement? {
    let increment: CGFloat = 10
    let systemWide = AXUIElementCreateSystemWide()
    let direction: CGFloat = index < 0 ? -1 : 1
    let steps = index < 0 ? abs(index) - 1 : index

    guard var current = direction == 1
        ? firstItemFromLeft(bounds: bounds, y: y, systemWide: systemWide)
        : firstItemFromRight(bounds: bounds, y: y, systemWide: systemWide, increment: increment)
    else {
        print("Could not find starting tray item for trayIndex \(index)")
        return nil
    }

    var x = current.x
    for _ in 0..<steps {
        while true {
            x += direction * increment
            if x > bounds.maxX || x < bounds.minX {
                print("Reached end of menu bar while looking for tray index \(index) (tried up to x=\(x))")
                return nil
            }

            guard
                let item = element(atX: x, y: y, systemWide: systemWide),
                !isMenuBar(item),
                let position = axPoint(item, kAXPositionAttribute),
                position.x != current.x
            else {
                continue
            }

            current = TrayElement(element: item, x: position.x)
            break
        }
    }
    return current
}

// MARK: - Activation

private func waitBriefly(_ interval: TimeInterval) {
    if Thread.isMainThread {
        RunLoop.main.run(until: Date(timeIntervalSinceNow: interval))
    } else {
        Thread.sleep(forTimeInterval: interval)
    }
}

private func click(at point: CGPoint, type: TrayClickType) throws {
    let isLeft = type == .left
    let button: CGMouseButton = isLeft ? .left : .right
    let downType: CGEventType = isLeft ? .leftMouseDown : .rightMouseDown
    let upType: CGEventType = isLeft ? .leftMouseUp : .rightMouseUp

    CGWarpMouseCursorPosition(point)
    waitBriefly(0.02)

    guard let move = CGEvent(
        mouseEventSource: nil,
        mouseType: .mouseMoved,
        mouseCursorPosition: point,
        mouseButton: button
    ) else {
        throw TrayError.couldNotCreateMouseEvent("move")
    }
    move.post(tap: .cghidEventTap)
    waitBriefly(0.03)

    guard let down = CGEvent(
        mouseEventSource: nil,
        mouseType: downType,
        mouseCursorPosition: point,
        mouseButton: button
    ) else {
        throw TrayError.couldNotCreateMouseEvent("button-down")
    }
    guard let up = CGEvent(
        mouseEventSource: nil,
        mouseType: upType,
        mouseCursorPosition: point,
        mouseButton: button
    ) else {
        throw TrayError.couldNotCreateMouseEvent("button-up")
    }

    down.post(tap: .cghidEventTap)
    waitBriefly(0.06)
    up.post(tap: .cghidEventTap)
}

private func activate(_ item: TrayElement, y: CGFloat, clickType: TrayClickType) throws {
    if clickType == .left && actionNames(item.element).contains(kAXPressAction) {
        let result = AXUIElementPerformAction(item.element, kAXPressAction as CFString)
        print("AXPress: \(result.rawValue)")
        return
    }

    if clickType == .left {
        print("AXPress not available, falling back to cursor click")
    } else {
        print("Right click requested, using cursor click")
    }

    guard let size = axSize(item.element, kAXSizeAttribute) else {
        print("Could not determine width for fallback click at x=\(item.x)")
        return
    }
    try click(at: CGPoint(x: item.x + size.width / 2, y: y), type: clickType)
}

private func runTrayAction(trayIndex: Int, clickType: TrayClickType) throws {
    guard AXIsProcessTrusted() else {
        throw TrayError.accessibilityPermissionRequired
    }

    let bounds = CGDisplayBounds(CGMainDisplayID())
    let y = bounds.minY + 20
    guard let item = trayElement(at: trayIndex, bounds: bounds, y: y) else {
        return
    }
    try activate(item, y: y, clickType: clickType)
}

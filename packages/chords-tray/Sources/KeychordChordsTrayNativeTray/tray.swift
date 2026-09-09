// Native macOS menu-bar-extra scanner exported to `src/js/tray.ts` through NodeSwift.
//
// macOS has no public API for enumerating status items. This preserves the existing handler's
// strategy: inspect Accessibility elements along the main menu bar, select one by position, use
// AXPress for a left click when available, and otherwise post a mouse click at its center.
//
// Accessibility access goes through AXorcist, matching `chords-menu`. AXorcist's accessors are
// MainActor-isolated, so the exported function is async; NodeSwift bridges it to a JS Promise and
// both the desktop app and the Chord CLI service the main run loop.

import AXorcist
import ApplicationServices
import CoreGraphics
import Foundation
import NodeAPI

private enum TrayClickType: String {
    case left
    case right

    /// CGEvent types for a click of this kind. AXorcist models the same mapping in
    /// `MouseButton.eventKinds`, but that property is internal to the module.
    var eventKinds: (button: CGMouseButton, down: CGEventType, up: CGEventType) {
        switch self {
        case .left: (.left, .leftMouseDown, .leftMouseUp)
        case .right: (.right, .rightMouseDown, .rightMouseUp)
        }
    }
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

#NodeModule(exports: [
    "runTrayAction": try NodeFunction {
        (trayIndex: Int, clickTypeValue: String) async throws -> Void in
        guard let clickType = TrayClickType(rawValue: clickTypeValue) else {
            throw TrayError.invalidClickType(clickTypeValue)
        }
        try await runTrayAction(trayIndex: trayIndex, clickType: clickType)
    },
])

// MARK: - Item discovery

private struct TrayElement {
    let element: Element
    /// AXFrame at discovery time; `x` drives the scan, `width` centers the fallback click.
    let frame: CGRect
}

@MainActor
private func trayElement(atX x: CGFloat, y: CGFloat) -> TrayElement? {
    guard let element = Element.elementAtPoint(CGPoint(x: x, y: y)),
          !element.isMenuBar(),
          let frame = element.frame()
    else {
        return nil
    }
    return TrayElement(element: element, frame: frame)
}

@MainActor
private func isMenuBar(atX x: CGFloat, y: CGFloat) -> Bool {
    Element.elementAtPoint(CGPoint(x: x, y: y))?.isMenuBar() ?? false
}

@MainActor
private func firstItemFromLeft(bounds: CGRect, y: CGFloat) -> TrayElement? {
    var x = bounds.midX
    var increment = bounds.width / 4

    // Find the right edge of the application-menu AXMenuBar region.
    while increment >= 1 {
        while isMenuBar(atX: x + increment, y: y) {
            x += increment
        }
        increment /= 2
    }

    return trayElement(atX: x + 1, y: y)
}

@MainActor
private func firstItemFromRight(bounds: CGRect, y: CGFloat, increment: CGFloat) -> TrayElement? {
    var x = bounds.maxX - increment
    while x >= bounds.minX {
        if let item = trayElement(atX: x, y: y) {
            return item
        }
        x -= increment
    }
    return nil
}

@MainActor
private func trayElement(at index: Int, bounds: CGRect, y: CGFloat) -> TrayElement? {
    let increment: CGFloat = 10
    let direction: CGFloat = index < 0 ? -1 : 1
    let steps = index < 0 ? abs(index) - 1 : index

    guard var current = direction == 1
        ? firstItemFromLeft(bounds: bounds, y: y)
        : firstItemFromRight(bounds: bounds, y: y, increment: increment)
    else {
        print("Could not find starting tray item for trayIndex \(index)")
        return nil
    }

    var x = current.frame.origin.x
    for _ in 0..<steps {
        while true {
            x += direction * increment
            if x > bounds.maxX || x < bounds.minX {
                print("Reached end of menu bar while looking for tray index \(index) (tried up to x=\(x))")
                return nil
            }

            guard let item = trayElement(atX: x, y: y),
                  item.frame.origin.x != current.frame.origin.x
            else {
                continue
            }

            current = item
            break
        }
    }
    return current
}

// MARK: - Activation

/// Posts a real cursor click. AXorcist's `Element.clickAt` only sends button down/up; menu bar
/// extras additionally need the pointer parked over the item, so keep the warp, the synthetic
/// move, and the settle delays here.
@MainActor
private func click(at point: CGPoint, type: TrayClickType) async throws {
    let eventKinds = type.eventKinds

    CGWarpMouseCursorPosition(point)
    try await Task.sleep(for: .milliseconds(20))

    try InputDriver.move(to: point)
    try await Task.sleep(for: .milliseconds(30))

    guard let down = CGEvent(
        mouseEventSource: nil,
        mouseType: eventKinds.down,
        mouseCursorPosition: point,
        mouseButton: eventKinds.button
    ) else {
        throw TrayError.couldNotCreateMouseEvent("button-down")
    }
    guard let up = CGEvent(
        mouseEventSource: nil,
        mouseType: eventKinds.up,
        mouseCursorPosition: point,
        mouseButton: eventKinds.button
    ) else {
        throw TrayError.couldNotCreateMouseEvent("button-up")
    }

    down.post(tap: .cghidEventTap)
    try await Task.sleep(for: .milliseconds(60))
    up.post(tap: .cghidEventTap)
}

@MainActor
private func activate(_ item: TrayElement, y: CGFloat, clickType: TrayClickType) async throws {
    if clickType == .left, item.element.isActionSupported(kAXPressAction) {
        do {
            try item.element.performAction(.press)
            print("AXPress: succeeded")
        } catch let error as AccessibilitySystemError {
            print("AXPress: \(error.axError.rawValue)")
        }
        return
    }

    if clickType == .left {
        print("AXPress not available, falling back to cursor click")
    } else {
        print("Right click requested, using cursor click")
    }

    try await click(
        at: CGPoint(x: item.frame.midX, y: y),
        type: clickType
    )
}

@MainActor
private func runTrayAction(trayIndex: Int, clickType: TrayClickType) async throws {
    guard AXIsProcessTrusted() else {
        throw TrayError.accessibilityPermissionRequired
    }

    let bounds = CGDisplayBounds(CGMainDisplayID())
    let y = bounds.minY + 20
    guard let item = trayElement(at: trayIndex, bounds: bounds, y: y) else {
        return
    }
    try await activate(item, y: y, clickType: clickType)
}

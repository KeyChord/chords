import AppKit
import Algorithms
import AXorcistRuntime
import ApplicationServices
import CoreGraphics

/// Select within application menus or tray extras, keeping all steps inside that group.
struct MenuBarSelection: Sendable {
    enum Scope: String { case menu = "MENU", tray = "TRAY" }
    let scope: Scope
    let index: Int
    let steps: String
    let clickType: TrayClickType?

    init(scope: String, index: String, steps: String, clickType: String) throws {
        guard let scope = Scope(rawValue: scope),
              let index = Int(index), index != Int.min,
              steps.allSatisfy({ $0 == "[" || $0 == "]" }),
              clickType.isEmpty || TrayClickType(rawValue: clickType) != nil
        else { throw TrayError.invalidMenuBarSelection }
        self.scope = scope
        self.index = index
        self.steps = steps
        self.clickType = TrayClickType(rawValue: clickType)
    }

    @MainActor
    func run(focusedAppId: String?) async throws {
        guard AXPermissionHelpers.hasAccessibilityPermissions() else { throw TrayError.accessibilityPermissionRequired }
        let bounds = CGDisplayBounds(CGMainDisplayID())
        var menus: [TrayElement] = []
        if scope == .menu {
            let target: NSRunningApplication?
            if let focusedAppId {
                target = NSRunningApplication.runningApplications(withBundleIdentifier: focusedAppId)
                    .first(where: \.isActive)
                    ?? NSRunningApplication.runningApplications(withBundleIdentifier: focusedAppId).first
            } else {
                target = NSWorkspace.shared.frontmostApplication
            }
            guard let target else { throw TrayError.controlNotFound("application menu bar") }
            if !target.isActive {
                target.activate()
                let deadline = ContinuousClock.now + .seconds(1)
                while !target.isActive && ContinuousClock.now < deadline {
                    try await Task.sleep(for: .milliseconds(20))
                }
            }
            let app = AXApp(target).element
            guard let menuBar = app.menuBar() else { throw TrayError.controlNotFound("application menu bar") }
            menus = visibleMenuBarItems(in: menuBar, bounds: bounds)
            guard !menus.isEmpty else { throw TrayError.controlNotFound("application menu bar items") }
        }

        var extras: [TrayElement] = []
        if scope == .tray {
            for app in NSWorkspace.shared.runningApplications {
                let owner = AXApp(app).element
                var attributes = [kAXExtrasMenuBarAttribute]
                // These agents expose status items through AXMenuBar on some macOS versions.
                if ["com.apple.controlcenter", "com.apple.MenuBarAgent", "com.apple.systemuiserver"].contains(app.bundleIdentifier ?? "") {
                    attributes.append(kAXMenuBarAttribute)
                }
                for attribute in attributes {
                    if let bar = owner.attribute(Attribute<AXUIElement>(attribute)) {
                        extras += visibleMenuBarItems(in: Element(bar), bounds: bounds)
                    }
                }
            }
        }
        // The same status item may be exposed by more than one system agent.
        let items = (menus + extras).sorted { $0.frame.minX < $1.frame.minX }
            .uniqued(on: \.frame.minX)
        var offset = index < 0 ? items.count + index : index
        guard items.indices.contains(offset) else {
            throw TrayError.controlNotFound("\(scope.rawValue) menu bar item at index \(index); found \(items.count) items")
        }
        for step in steps {
            offset = min(items.count - 1, max(0, offset + (step == "[" ? -1 : 1)))
        }
        let item = items[offset]
        let y = item.frame.midY
        if let clickType {
            try await activate(item, y: y, clickType: clickType)
        } else {
            let point = CGPoint(x: item.frame.midX, y: y)
            CGWarpMouseCursorPosition(point)
            try InputDriver.move(to: point)
        }
    }
}

@MainActor
private func visibleMenuBarItems(in bar: Element, bounds: CGRect) -> [TrayElement] {
    let children = bar.attribute(Attribute<[AXUIElement]>(kAXChildrenAttribute)) ?? []
    return children.compactMap { child in
        let element = Element(child)
        guard element.role() == kAXMenuBarItemRole,
              let frame = element.frame(), !frame.isEmpty,
              frame.minX >= bounds.minX, frame.maxX <= bounds.maxX,
              frame.minY >= bounds.minY, frame.minY < bounds.minY + NSStatusBar.system.thickness
        else { return nil }
        return TrayElement(element: element, frame: frame)
    }
}

@MainActor
func runNotchAction() async throws {
    guard AXPermissionHelpers.hasAccessibilityPermissions() else { throw TrayError.accessibilityPermissionRequired }
    let displayID = CGMainDisplayID()
    guard let screen = NSScreen.screens.first(where: {
        ($0.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber)?.uint32Value == displayID
    }), screen.safeAreaInsets.top > 0,
          let left = screen.auxiliaryTopLeftArea, let right = screen.auxiliaryTopRightArea,
          right.minX > left.maxX
    else { throw TrayError.controlNotFound("notch on the main display") }
    let bounds = CGDisplayBounds(displayID)
    // NSScreen uses bottom-left coordinates; CGEvent uses a top-left origin.
    let x = bounds.minX + (left.maxX + right.minX) / 2 - screen.frame.minX
    try await click(at: CGPoint(x: x, y: bounds.minY + screen.safeAreaInsets.top / 2), type: .left)
}

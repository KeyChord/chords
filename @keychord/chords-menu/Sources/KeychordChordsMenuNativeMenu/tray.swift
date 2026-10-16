// Native macOS menu-bar-extra scanner exported to `src/js/tray.ts` through NodeSwift.
//
// macOS has no public API for enumerating status items. This preserves the existing handler's
// strategy: inspect Accessibility elements along the main menu bar, select one by position, use
// AXPress for a left click when available, and otherwise post a mouse click at its center.
//
// Accessibility access goes through AXorcist, matching `chords-menu`. AXorcist's accessors are
// MainActor-isolated. The JS entrypoint returns a Promise whose completion is explicitly sent
// back to its originating JS queue; the desktop app and Chord CLI service the main run loop.

import AppKit
import AXorcistRuntime
import ApplicationServices
import ChordNodeSupport
import CoreGraphics
import Foundation
import NodeAPI

enum TrayClickType: String {
    case left = "LEFT"
    case right = "RIGHT"

    /// CGEvent types for a click of this kind. AXorcist models the same mapping in
    /// `MouseButton.eventKinds`, but that property is internal to the module.
    var eventKinds: (button: CGMouseButton, down: CGEventType, up: CGEventType) {
        switch self {
        case .left: (.left, .leftMouseDown, .leftMouseUp)
        case .right: (.right, .rightMouseDown, .rightMouseUp)
        }
    }
}

enum TrayError: Error, CustomStringConvertible {
    case invalidAction(String)
    case invalidSystemItemAction(type: String, value: String, action: String)
    case invalidIndex(String)
    case invalidControlCenterAction(section: String, action: String)
    case invalidClickType(String)
    case accessibilityPermissionRequired
    case couldNotCreateMouseEvent(String)
    case controlNotFound(String)
    case controlDisabled(String)
    case invalidSliderValue
    case invalidMenuBarSelection

    var description: String {
        switch self {
        case .invalidAction(let value):
            return "unknown tray action \"\(value)\" (expected \"ITEM\", \"HOVER\", \"BATTERY\", \"DATE_TIME\", \"WIFI\", or \"CONTROL_CENTER\")"
        case .invalidSystemItemAction(let type, let value, let action):
            return "invalid \(type) tray action \"\(value) > \(action)\""
        case .invalidIndex(let value):
            return "invalid tray index \"\(value)\""
        case .invalidControlCenterAction(let section, let action):
            return "invalid Control Center action \"\(section) > \(action)\""
        case .invalidClickType(let value):
            return "invalid tray click type \"\(value)\" (expected \"left\" or \"right\")"
        case .accessibilityPermissionRequired:
            return "Accessibility permission is required to interact with menu bar items"
        case .couldNotCreateMouseEvent(let event):
            return "could not create the \(event) mouse event"
        case .controlNotFound(let name):
            return "could not find \(name) (it may be hidden or unavailable on this Mac)"
        case .controlDisabled(let name):
            return "Control Center control \"\(name)\" is disabled"
        case .invalidSliderValue:
            return "Control Center slider does not expose a valid numeric range"
        case .invalidMenuBarSelection:
            return "invalid menu bar selection (expected menu/tray, an integer index, bracket steps, and an optional left/right click)"
        }
    }
}

private enum SystemTrayItem: String {
    case battery = "BATTERY"
    case dateTime = "DATE_TIME"
    case wifi = "WIFI"

    var identifiers: [String] {
        switch self {
        case .battery: ["com.apple.menuextra.battery"]
        case .dateTime: ["com.apple.menuextra.clock"]
        case .wifi: ["com.apple.menuextra.airport", "com.apple.menuextra.wifi"]
        }
    }
}

private enum ControlCenterSection: String {
    case display = "DISPLAY"
    case sound = "SOUND"
    case wifi = "WIFI"

    var identifier: String {
        switch self {
        case .display: "controlcenter-display"
        case .sound: "controlcenter-volume"
        case .wifi: "controlcenter-wifi"
        }
    }

    var sliderIdentifier: String? {
        switch self {
        case .display: "controlcenter-display-brightness-slider"
        case .sound: "controlcenter-volume-slider"
        case .wifi: nil
        }
    }

    var settingsTitle: String {
        switch self {
        case .display: "Display Settings"
        case .sound: "Sound Settings"
        case .wifi: "Wi-Fi Settings"
        }
    }
}

private enum ControlCenterAction: String {
    case click = "CLICK"
    case decrease = "DECREASE"
    case increase = "INCREASE"
    case darkMode = "DARK_MODE"
    case nightShift = "NIGHT_SHIFT"
    case trueTone = "TRUE_TONE"
    case settings = "SETTINGS"
    case toggle = "TOGGLE"

    var identifier: String? {
        switch self {
        case .darkMode: "display-setting-dark-mode"
        case .nightShift: "display-setting-night-shift"
        case .trueTone: "display-setting-true-tone"
        default: nil
        }
    }
}

/// Validate before moving to MainActor or touching the system UI.
private enum TrayAction: Sendable {
    case item(Int, TrayClickType)
    case hover(Int)
    case notch
    case systemItem(SystemTrayItem, toggle: Bool)
    case controlCenter(ControlCenterSection?, ControlCenterAction)

    init(type: String, value: String, action: String) throws {
        switch type {
        case "ITEM":
            guard let index = Int(value), index != Int.min else {
                throw TrayError.invalidIndex(value)
            }
            guard let clickType = TrayClickType(rawValue: action) else {
                throw TrayError.invalidClickType(action)
            }
            self = .item(index, clickType)
        case "HOVER":
            guard let index = Int(value), index != Int.min else {
                throw TrayError.invalidIndex(value)
            }
            guard action.isEmpty else {
                throw TrayError.invalidSystemItemAction(type: type, value: value, action: action)
            }
            self = .hover(index)
        case "NOTCH":
            guard value.isEmpty, action.isEmpty else {
                throw TrayError.invalidSystemItemAction(type: type, value: value, action: action)
            }
            self = .notch
        case "BATTERY", "DATE_TIME", "WIFI":
            guard let item = SystemTrayItem(rawValue: type), action.isEmpty,
                  value.isEmpty || (item == .wifi && value == "TOGGLE")
            else {
                throw TrayError.invalidSystemItemAction(type: type, value: value, action: action)
            }
            self = .systemItem(item, toggle: value == "TOGGLE")
        case "CONTROL_CENTER":
            if value.isEmpty && action.isEmpty {
                self = .controlCenter(nil, .click)
                return
            }
            guard let section = ControlCenterSection(rawValue: value),
                  let command = ControlCenterAction(rawValue: action.isEmpty ? "CLICK" : action),
                  (section == .display && command != .toggle)
                    || (section == .sound && [.click, .decrease, .increase].contains(command))
                    || (section == .wifi && [.click, .toggle].contains(command))
            else {
                throw TrayError.invalidControlCenterAction(section: value, action: action)
            }
            self = .controlCenter(section, command)
        default:
            throw TrayError.invalidAction(type)
        }
    }
}

@NodeActor
func menuBarActionPromise(focusedAppId: String?, scope: String, index: String, steps: String, clickType: String) throws -> NodePromise {
        let selection: MenuBarSelection
        do {
            selection = try MenuBarSelection(scope: scope, index: index, steps: steps, clickType: clickType)
        } catch {
            let deferred = try NodePromise.Deferred()
            try deferred(.failure(error) as Result<Void, Error>)
            return deferred.promise
        }
        return try mainActorPromise {
            try await selection.run(focusedAppId: focusedAppId)
        }
}

@NodeActor
func trayActionPromise(type: String, value: String, action: String) throws -> NodePromise {
        let command: TrayAction
        do {
            command = try TrayAction(type: type, value: value, action: action)
        } catch {
            let deferred = try NodePromise.Deferred()
            try deferred(.failure(error) as Result<Void, Error>)
            return deferred.promise
        }
        return try mainActorPromise {
            switch command {
            case .item(let index, let clickType):
                try await runTrayItemAction(trayIndex: index, clickType: clickType)
            case .hover(let index):
                try await runTrayItemAction(trayIndex: index, clickType: nil)
            case .notch:
                try await runNotchAction()
            case .systemItem(let item, let toggle):
                try await runSystemTrayAction(item, toggle: toggle)
            case .controlCenter(let section, let command):
                try await runControlCenterAction(section: section, action: command)
            }
        }
}
// MARK: - Item discovery

struct TrayElement {
    let element: Element
    /// AXFrame at discovery time; `x` drives the scan, `width` centers the fallback click.
    let frame: CGRect
}

// MARK: - Activation

/// Posts a real cursor click. AXorcist's `Element.clickAt` only sends button down/up; menu bar
/// extras additionally need the pointer parked over the item, so keep the warp, the synthetic
/// move, and the settle delays here.
@MainActor
func click(at point: CGPoint, type: TrayClickType) async throws {
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
func activate(_ item: TrayElement, y: CGFloat, clickType: TrayClickType) async throws {
    if clickType == .left, item.element.isActionSupported(kAXPressAction) {
        do {
            try item.element.performAction(.press)
            print("AXPress: succeeded")
        } catch let error as AccessibilitySystemError {
            throw error
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
private func runTrayItemAction(trayIndex: Int, clickType: TrayClickType?) async throws {
    let selection = try MenuBarSelection(scope: "TRAY", index: String(trayIndex), steps: "", clickType: clickType?.rawValue ?? "")
    try await selection.run(focusedAppId: nil)
}

// MARK: - Control Center

@MainActor
private func children(of element: Element) -> [Element] {
    let children = element.attribute(Attribute<[AXUIElement]>(kAXChildrenAttribute)) ?? []
    return children.map(Element.init)
}

@MainActor
private func windows(of application: Element) -> [Element] {
    application.windows() ?? []
}

@MainActor
private func find(in roots: [Element], matching predicate: (Element) -> Bool) -> Element? {
    var visited = Set<Element>()
    func walk(_ element: Element, depth: Int) -> Element? {
        guard depth < 30, visited.insert(element).inserted else { return nil }
        if predicate(element) { return element }
        for child in children(of: element) {
            if let match = walk(child, depth: depth + 1) { return match }
        }
        return nil
    }
    for root in roots {
        if let match = walk(root, depth: 0) { return match }
    }
    return nil
}

@MainActor
private func waitForControl(_ name: String, find lookup: () -> Element?) async throws -> Element {
    let deadline = ContinuousClock.now + .seconds(3)
    repeat {
        if let element = lookup() { return element }
        try await Task.sleep(for: .milliseconds(50))
    } while ContinuousClock.now < deadline
    throw TrayError.controlNotFound(name)
}

@MainActor
private func press(_ element: Element, name: String) async throws {
    guard element.isEnabled() != false else { throw TrayError.controlDisabled(name) }
    if element.isActionSupported(kAXPressAction) {
        try element.performAction(.press)
    } else if let frame = element.frame(), !frame.isEmpty {
        try await click(at: CGPoint(x: frame.midX, y: frame.midY), type: .left)
    } else {
        throw TrayError.controlNotFound(name)
    }
}

@MainActor
private func menuBarItem(identifiers: [String]) -> Element? {
    let owners = ["com.apple.controlcenter", "com.apple.MenuBarAgent", "com.apple.systemuiserver"]
        .flatMap { NSRunningApplication.runningApplications(withBundleIdentifier: $0) }
        .map { AXApp($0).element }
    let roots = owners.flatMap { owner in
        // Menu bars are not always included in the application's AXChildren.
        [kAXMenuBarAttribute, kAXExtrasMenuBarAttribute].compactMap { name in
            owner.attribute(Attribute<AXUIElement>(name)).map(Element.init)
        } + [owner]
    }
    return find(in: roots) { identifiers.contains($0.identifier() ?? "") }
}

@MainActor
private func runSystemTrayAction(_ item: SystemTrayItem, toggle: Bool) async throws {
    guard AXPermissionHelpers.hasAccessibilityPermissions() else { throw TrayError.accessibilityPermissionRequired }
    if item == .wifi && toggle {
        try await runControlCenterAction(section: .wifi, action: .toggle)
    } else if let element = menuBarItem(identifiers: item.identifiers) {
        try await press(element, name: "\(item.rawValue) menu bar item")
    } else if item == .wifi {
        try await runControlCenterAction(section: .wifi, action: .click)
    } else {
        throw TrayError.controlNotFound("\(item.rawValue) menu bar item")
    }
}

@MainActor
private func settingsButton(in application: Element, section: ControlCenterSection) -> Element? {
    find(in: windows(of: application)) { element in
        // These footer buttons have no AXIdentifier. Titles/descriptions vary by macOS version.
        element.role() == kAXButtonRole
            && [element.title(), element.descriptionText()].compactMap { $0 }.contains {
                $0.hasPrefix(section.settingsTitle) || $0.hasPrefix(section.settingsTitle.replacingOccurrences(of: "Settings", with: "Preferences"))
            }
    }
}

@MainActor
private func expandedSection(in application: Element, section: ControlCenterSection) -> Bool {
    find(in: windows(of: application)) { element in
        switch section {
        case .display:
            return element.identifier() == "display-setting-dark-mode"
                || (element.role() == kAXGroupRole && element.identifier()?.hasPrefix("controlcenter-display-") == true)
        case .sound:
            return element.identifier() == "controlcenter-volume" && element.role() == kAXStaticTextRole
                || element.identifier()?.hasPrefix("sound-device-") == true
        case .wifi:
            return ["wifi-header", "controlcenter-wifi"].contains(element.identifier() ?? "")
                && element.role() == kAXStaticTextRole
        }
    } != nil || settingsButton(in: application, section: section) != nil
}

@MainActor
private func overviewControl(in application: Element) -> Element? {
    find(in: windows(of: application)) { element in
        (element.role() == kAXButtonRole || element.role() == kAXCheckBoxRole)
            && (element.identifier() == "controlcenter-display" || element.identifier() == "controlcenter-volume")
    }
}

@MainActor
private func wifiPowerControl(in application: Element) -> Element? {
    find(in: windows(of: application)) { element in
        guard [kAXCheckBoxRole, "AXSwitch"].contains(element.role() ?? "") else { return false }
        let identifier = element.identifier()?.lowercased() ?? ""
        // Network rows are also checkboxes. Never mistake one for the radio's power control.
        guard !identifier.contains("network"), !identifier.contains("hotspot") else { return false }
        if ["wifi-header", "controlcenter-wifi"].contains(identifier)
            || (identifier.contains("wifi") && (identifier.contains("power") || identifier.contains("toggle"))) {
            return true
        }
        return [element.title(), element.descriptionText()].compactMap { $0 }.contains {
            let label = $0.replacingOccurrences(of: "‑", with: "-")
            return label == "Wi-Fi" || label.hasPrefix("Wi-Fi,")
        }
    }
}

@MainActor
private func openControlCenter(_ application: Element) async throws {
    if overviewControl(in: application) != nil { return }
    let item = try await waitForControl("Control Center menu bar item") {
        menuBarItem(identifiers: ["com.apple.menuextra.controlcenter"])
    }
    // AXPress on this menu extra returns from an expanded section to the overview as well.
    try await press(item, name: "Control Center")
    do {
        _ = try await waitForControl("Control Center overview") {
            overviewControl(in: application)
        }
    } catch TrayError.controlNotFound(_) {
        // macOS can accept AXPress without opening the panel while another menu extra closes.
        // Recheck the UI and use the current AXFrame for a real click if the press had no effect.
        if overviewControl(in: application) != nil { return }
        guard let frame = menuBarItem(identifiers: ["com.apple.menuextra.controlcenter"])?.frame(),
              !frame.isEmpty else { throw TrayError.controlNotFound("Control Center menu bar item") }
        try await click(at: CGPoint(x: frame.midX, y: frame.midY), type: .left)
        _ = try await waitForControl("Control Center overview") {
            overviewControl(in: application)
        }
    }
}

@MainActor
private func expand(_ section: ControlCenterSection, in application: Element) async throws {
    if expandedSection(in: application, section: section) { return }
    try await openControlCenter(application)
    let button = try await waitForControl(section.rawValue) {
        find(in: windows(of: application)) { $0.identifier() == section.identifier }
    }
    // AXPress on the heading/chevron expands the section; it does not click its slider.
    // Wi-Fi's overview checkbox also opens the section; its power toggle is `wifi-header`.
    try await press(button, name: section.rawValue)
    _ = try await waitForControl("expanded \(section.rawValue)") {
        expandedSection(in: application, section: section) ? button : nil
    }
}

@MainActor
private func adjust(_ slider: Element, increase: Bool) async throws {
    guard slider.isEnabled() != false else { throw TrayError.controlDisabled("slider") }
    let action = increase ? kAXIncrementAction : kAXDecrementAction
    if slider.isActionSupported(action) {
        try slider.performAction(action)
        return
    }
    // Some Control Center sliders expose read-only AXValue, but provide adjacent +/- buttons.
    if let parent = slider.parent() {
        let siblings = children(of: parent)
        if let index = siblings.firstIndex(of: slider) {
            let neighbor = increase
                ? siblings.dropFirst(index + 1).first
                : siblings.prefix(index).last
            if let neighbor, neighbor.role() == kAXButtonRole {
                try await press(neighbor, name: increase ? "increase slider" : "decrease slider")
                return
            }
        }
    }
    guard let value = slider.attribute(Attribute<NSNumber>(kAXValueAttribute))?.doubleValue,
          let minimum = slider.attribute(Attribute<NSNumber>(kAXMinValueAttribute))?.doubleValue,
          let maximum = slider.attribute(Attribute<NSNumber>(kAXMaxValueAttribute))?.doubleValue,
          value.isFinite, minimum.isFinite, maximum.isFinite, maximum > minimum
    else { throw TrayError.invalidSliderValue }
    let increment = slider.attribute(Attribute<NSNumber>(kAXValueIncrementAttribute))?.doubleValue ?? (maximum - minimum) / 16
    guard increment.isFinite, increment > 0 else { throw TrayError.invalidSliderValue }
    let next = min(maximum, max(minimum, value + (increase ? increment : -increment)))
    try slider.setAttributeValue(next, forAttribute: kAXValueAttribute)
}

@MainActor
private func runControlCenterAction(section: ControlCenterSection?, action: ControlCenterAction) async throws {
    guard AXPermissionHelpers.hasAccessibilityPermissions() else { throw TrayError.accessibilityPermissionRequired }
    guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.controlcenter").first else {
        throw TrayError.controlNotFound("Control Center application")
    }
    let application = AXApp(app).element
    guard let section else {
        try await openControlCenter(application)
        return
    }
    try await expand(section, in: application)
    switch action {
    case .click:
        return
    case .decrease, .increase:
        guard let identifier = section.sliderIdentifier else {
            throw TrayError.invalidControlCenterAction(section: section.rawValue, action: action.rawValue)
        }
        let slider = try await waitForControl("\(section.rawValue) slider") {
            find(in: windows(of: application)) { $0.identifier() == identifier }
        }
        try await adjust(slider, increase: action == .increase)
    case .settings:
        let button = try await waitForControl(section.settingsTitle) {
            settingsButton(in: application, section: section)
        }
        try await press(button, name: section.settingsTitle)
    case .darkMode, .nightShift, .trueTone:
        let button = try await waitForControl(action.rawValue) {
            find(in: windows(of: application)) { $0.identifier() == action.identifier }
        }
        try await press(button, name: action.rawValue)
    case .toggle:
        let button = try await waitForControl("Wi-Fi power toggle") {
            wifiPowerControl(in: application)
        }
        try await press(button, name: "Wi-Fi power toggle")
    }
}

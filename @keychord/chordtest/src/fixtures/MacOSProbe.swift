import AppKit
import ApplicationServices
import Darwin

struct ProbeError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

func attribute<T>(_ element: AXUIElement, _ name: String) -> T? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
    return value as? T
}

func children(_ element: AXUIElement) -> [AXUIElement] {
    attribute(element, kAXChildrenAttribute) ?? []
}

func find(_ root: AXUIElement, depth: Int, where predicate: (AXUIElement) -> Bool) -> AXUIElement? {
    if predicate(root) { return root }
    guard depth > 0 else { return nil }
    for child in children(root) {
        if let match = find(child, depth: depth - 1, where: predicate) { return match }
    }
    return nil
}

func click(_ element: AXUIElement) throws {
    guard let position: AXValue = attribute(element, kAXPositionAttribute),
          let extent: AXValue = attribute(element, kAXSizeAttribute) else {
        throw ProbeError("The control has no visible bounds")
    }
    var origin = CGPoint.zero
    var size = CGSize.zero
    guard AXValueGetValue(position, .cgPoint, &origin),
          AXValueGetValue(extent, .cgSize, &size), size.width > 0, size.height > 0 else {
        throw ProbeError("The control has no visible bounds")
    }
    try click(CGPoint(x: origin.x + size.width / 2, y: origin.y + size.height / 2))
}

func click(_ point: CGPoint) throws {
    guard point.x.isFinite, point.y.isFinite else { throw ProbeError("Invalid control position") }
    guard CGWarpMouseCursorPosition(point) == .success else {
        throw ProbeError("Cannot move the pointer to the control")
    }
    for type in [CGEventType.mouseMoved, .leftMouseDown, .leftMouseUp] {
        guard let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point,
                                  mouseButton: .left) else { throw ProbeError("Cannot create a mouse event") }
        event.setIntegerValueField(.mouseEventClickState, value: 1)
        event.post(tap: .cghidEventTap)
        if type != .leftMouseUp { Thread.sleep(forTimeInterval: 0.04) }
    }
}

func application(_ bundleId: String) throws -> AXUIElement {
    guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first else {
        throw ProbeError("\(bundleId) is not running")
    }
    let root = AXUIElementCreateApplication(app.processIdentifier)
    AXUIElementSetMessagingTimeout(root, 0.8)
    return root
}

func node(_ element: AXUIElement, depth: Int, menu: Bool = false) -> [String: Any] {
    var result: [String: Any] = [:]
    for (key, attributeName) in [
        ("role", kAXRoleAttribute), ("subrole", kAXSubroleAttribute), ("title", kAXTitleAttribute),
        ("id", kAXIdentifierAttribute), ("description", kAXDescriptionAttribute),
        ("mark", kAXMenuItemMarkCharAttribute), ("key", kAXMenuItemCmdCharAttribute),
    ] {
        if let value: String = attribute(element, attributeName), !value.isEmpty { result[key] = value }
    }
    for (key, attributeName) in [
        ("enabled", kAXEnabledAttribute), ("selected", kAXSelectedAttribute),
        ("minimized", kAXMinimizedAttribute), ("focused", kAXFocusedAttribute),
        ("keyModifiers", kAXMenuItemCmdModifiersAttribute), ("keyGlyph", kAXMenuItemCmdGlyphAttribute),
        ("keyVirtual", kAXMenuItemCmdVirtualKeyAttribute),
    ] {
        if let value: NSNumber = attribute(element, attributeName) { result[key] = value }
    }
    if !menu {
        if let url: URL = attribute(element, kAXURLAttribute) { result["url"] = url.absoluteString }
        let value: AnyObject? = attribute(element, kAXValueAttribute)
        if let value = value as? String { result["value"] = value }
        else if let value = value as? NSNumber, value.doubleValue.isFinite { result["value"] = value }
        if let position: AXValue = attribute(element, kAXPositionAttribute) {
            var point = CGPoint.zero
            if AXValueGetValue(position, .cgPoint, &point), point.x.isFinite, point.y.isFinite {
                result["position"] = [point.x, point.y]
            }
        }
        if let value: AXValue = attribute(element, kAXSizeAttribute) {
            var size = CGSize.zero
            if AXValueGetValue(value, .cgSize, &size), size.width.isFinite, size.height.isFinite {
                result["size"] = [size.width, size.height]
            }
        }
    }
    if depth > 0 {
        let contents = children(element).map { node($0, depth: depth - 1, menu: menu) }
        if !contents.isEmpty { result["children"] = contents }
    }
    return result
}

func writeJSON(_ value: Any) throws {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed, .sortedKeys])
    print(String(decoding: data, as: UTF8.self))
}

func menuItem(_ root: AXUIElement, path: [String]) throws -> AXUIElement {
    guard let bar: AXUIElement = attribute(root, kAXMenuBarAttribute) else {
        throw ProbeError("The app has no menu bar")
    }
    return try path.enumerated().reduce(bar) { parent, part in
        let (index, title) = part
        let entries = index == 0 ? children(parent) : children(parent).flatMap(children)
        guard let target = entries.first(where: { attribute($0, kAXTitleAttribute) == title }) else {
            let titles: [String] = entries.compactMap { attribute($0, kAXTitleAttribute) }
            throw ProbeError("Menu item \(title) unavailable among \(titles)")
        }
        return target
    }
}

func desktopState() throws -> (desktops: [UInt64], active: UInt64) {
    typealias Connection = @convention(c) () -> Int32
    typealias CopySpaces = @convention(c) (Int32) -> Unmanaged<CFArray>?
    typealias ActiveSpace = @convention(c) (Int32) -> UInt64
    guard let library = dlopen("/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight", RTLD_LAZY) else {
        throw ProbeError("SkyLight unavailable")
    }
    defer { dlclose(library) }
    guard let connectionSymbol = dlsym(library, "SLSMainConnectionID"),
          let displaysSymbol = dlsym(library, "SLSCopyManagedDisplaySpaces"),
          let activeSymbol = dlsym(library, "SLSGetActiveSpace") else {
        throw ProbeError("Cannot read desktop state")
    }
    let connection = unsafeBitCast(connectionSymbol, to: Connection.self)()
    let copy = unsafeBitCast(displaysSymbol, to: CopySpaces.self)
    let active = unsafeBitCast(activeSymbol, to: ActiveSpace.self)
    let displays = copy(connection)?.takeRetainedValue() as? [[String: Any]] ?? []
    let desktops = displays.flatMap { display in
        (display["Spaces"] as? [[String: Any]] ?? []).compactMap { space in
            (space["type"] as? NSNumber)?.intValue == 0
                ? (space["id64"] as? NSNumber)?.uint64Value : nil
        }
    }
    return (desktops, active(connection))
}

func prepareDesktops(_ count: Int) throws {
    if try desktopState().desktops.count >= count { return }
    typealias Notify = @convention(c) (CFString, Int32) -> Int32
    guard let symbol = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CoreDockSendNotification"),
          unsafeBitCast(symbol, to: Notify.self)("com.apple.expose.awake" as CFString, 0) == 0 else {
        throw ProbeError("Cannot open Mission Control to create test desktops")
    }
    defer {
        for down in [true, false] { CGEvent(keyboardEventSource: nil, virtualKey: 53, keyDown: down)?.post(tap: .cghidEventTap) }
    }
    let apps = ["com.apple.WindowManager", "com.apple.dock"].compactMap { try? application($0) }
    let deadline = Date.now.addingTimeInterval(35)
    var current = try desktopState().desktops.count
    while current < count, Date.now < deadline {
        let button = apps.lazy.compactMap { app in
            find(app, depth: 6) {
                attribute($0, kAXIdentifierAttribute) == "mc.spaces.add" ||
                    attribute($0, kAXDescriptionAttribute) == "add desktop"
            }
        }.first
        if let button {
            guard AXUIElementPerformAction(button, kAXPressAction as CFString) == .success else {
                throw ProbeError("Cannot add a test desktop")
            }
            while Date.now < deadline, try desktopState().desktops.count <= current {
                Thread.sleep(forTimeInterval: 0.05)
            }
            current = try desktopState().desktops.count
        } else { Thread.sleep(forTimeInterval: 0.05) }
    }
    if current < count { throw ProbeError("Created \(current) of \(count) test desktops") }
}

func inspect(_ args: [String]) throws {
    switch args[0] {
    case "desktops":
        let state = try desktopState()
        try writeJSON(["desktops": state.desktops, "activeSpace": state.active])
    case "prepare-desktops":
        try prepareDesktops(Int(args[1])!)
    case "front":
        try writeJSON(NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "")
    case "screen-locked":
        let session = CGSessionCopyCurrentDictionary() as? [String: Any]
        try writeJSON(session?["CGSSessionScreenIsLocked"] as? Bool ?? false)
    case "running":
        try writeJSON(NSRunningApplication.runningApplications(withBundleIdentifier: args[1]).first != nil)
    case "hidden":
        try writeJSON(NSRunningApplication.runningApplications(withBundleIdentifier: args[1]).first?.isHidden == true)
    case "cursor":
        let location = CGEvent(source: nil)!.location
        try writeJSON([location.x, location.y])
    case "click-point":
        try click(CGPoint(x: Double(args[1])!, y: Double(args[2])!))
    case "window-order":
        let apps = Dictionary(uniqueKeysWithValues: NSWorkspace.shared.runningApplications.compactMap { app in
            app.bundleIdentifier.map { (app.processIdentifier, $0) }
        })
        let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
            as? [[String: Any]] ?? []
        try writeJSON(windows.compactMap { window -> String? in
            guard (window[kCGWindowLayer as String] as? NSNumber)?.intValue == 0,
                  let pid = (window[kCGWindowOwnerPID as String] as? NSNumber)?.int32Value else { return nil }
            return apps[pid]
        })
    case "screen-windows":
        let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
            as? [[String: Any]] ?? []
        try writeJSON(windows.compactMap { window -> [String: Any]? in
            guard let owner = window[kCGWindowOwnerName as String] as? String,
                  let number = window[kCGWindowNumber as String] as? NSNumber else { return nil }
            return [
                "owner": owner,
                "number": number,
                "title": window[kCGWindowName as String] as? String ?? "",
            ]
        })
    case "tree":
        try writeJSON(node(application(args[1]), depth: Int(args[2])!))
    case "menu":
        let root = try application(args[1])
        let target = try menuItem(root, path: Array(args.dropFirst(2)))
        try writeJSON(node(target, depth: 4, menu: true))
    case "press":
        let target = try menuItem(application(args[1]), path: Array(args.dropFirst(2)))
        let status = AXUIElementPerformAction(target, kAXPressAction as CFString)
        guard status == .success else { throw ProbeError("AXPress failed: \(status.rawValue)") }
    case "press-control", "click-control":
        let root = try application(args[1])
        guard let target = find(root, depth: 10, where: { element in
            attribute(element, kAXRoleAttribute) == args[2] &&
                [kAXTitleAttribute, kAXDescriptionAttribute, kAXIdentifierAttribute, kAXValueAttribute].contains {
                    attribute(element, $0) == args[3]
                }
        }) else { throw ProbeError("Cannot find \(args[2]) with label \(args[3])") }
        if args[0] == "click-control" {
            try click(target)
            break
        }
        let status = AXUIElementPerformAction(target, kAXPressAction as CFString)
        guard status == .success else { throw ProbeError("AXPress failed: \(status.rawValue)") }
    case "select-row":
        let root = try application(args[1])
        guard let row = find(root, depth: 8, where: { element in
            attribute(element, kAXRoleAttribute) == kAXRowRole &&
                find(element, depth: 3) { child in
                    if let value: NSNumber = attribute(child, kAXValueAttribute) {
                        return value.stringValue == args[2]
                    }
                    return attribute(child, kAXValueAttribute) == args[2] ||
                        attribute(child, kAXTitleAttribute) == args[2]
                } != nil
        }) else { throw ProbeError("Cannot find a row for \(args[2])") }
        let status = AXUIElementSetAttributeValue(row, kAXSelectedAttribute as CFString, kCFBooleanTrue)
        if status != .success {
            try click(row)
        }
    case "windows":
        let root = try application(args[1])
        let windows: [AXUIElement] = attribute(root, kAXWindowsAttribute) ?? []
        try writeJSON(windows.map { node($0, depth: Int(args[2])!, menu: false) })
    case "raise-window":
        let root = try application(args[1])
        let windows: [AXUIElement] = attribute(root, kAXWindowsAttribute) ?? []
        guard let target = windows.first(where: {
            attribute($0, kAXIdentifierAttribute) == args[2] || attribute($0, kAXTitleAttribute) == args[2]
        }) else { throw ProbeError("No window matches \(args[2])") }
        _ = AXUIElementSetAttributeValue(target, kAXMainAttribute as CFString, kCFBooleanTrue)
        let status = AXUIElementPerformAction(target, kAXRaiseAction as CFString)
        guard status == .success else { throw ProbeError("Cannot raise the window (AX error \(status.rawValue))") }
    case "window":
        let root = try application(args[1])
        let window: AXUIElement? = attribute(root, kAXFocusedWindowAttribute)
        try writeJSON(window.map { node($0, depth: Int(args[2])!) } ?? [:])
    case "focus":
        let root = try application(args[1])
        let target: AXUIElement? = attribute(root, kAXFocusedUIElementAttribute)
        try writeJSON(target.map { node($0, depth: 0) } ?? [:])
    case "move":
        let root = try application(args[1])
        guard let window: AXUIElement = attribute(root, kAXFocusedWindowAttribute),
              let target = find(window, depth: 8, where: {
                  attribute($0, kAXTitleAttribute) == args[2] &&
                      attribute($0, kAXRoleAttribute) == "AXImage"
              }) else {
            throw ProbeError("Cannot find Finder icon \(args[2])")
        }
        var point = CGPoint(x: Double(args[3])!, y: Double(args[4])!)
        let value = AXValueCreate(.cgPoint, &point)!
        let geometry = node(target, depth: 0)
        let status = AXUIElementSetAttributeValue(target, kAXPositionAttribute as CFString, value)
        if status == .success {
            Thread.sleep(forTimeInterval: 0.1)
            if node(target, depth: 0)["position"] as? [CGFloat] != geometry["position"] as? [CGFloat] {
                break
            }
        }
        guard let origin = geometry["position"] as? [CGFloat], let size = geometry["size"] as? [CGFloat] else {
            throw ProbeError("Finder icon has no position")
        }
        let from = CGPoint(x: origin[0] + size[0] / 2, y: origin[1] + size[1] / 2)
        let to = CGPoint(x: point.x + size[0] / 2, y: point.y + size[1] / 2)
        let middle = CGPoint(x: (from.x + to.x) / 2, y: (from.y + to.y) / 2)
        for (type, position) in [(CGEventType.mouseMoved, from), (.leftMouseDown, from),
                                 (.leftMouseDragged, middle), (.leftMouseDragged, to), (.leftMouseUp, to)] {
            _ = CGWarpMouseCursorPosition(position)
            let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: position,
                                mouseButton: .left)
            event?.setIntegerValueField(.mouseEventClickState, value: 1)
            event?.post(tap: .cghidEventTap)
            Thread.sleep(forTimeInterval: 0.07)
        }
    case "key":
        let key = CGKeyCode(args[1])!
        let flags = CGEventFlags(rawValue: UInt64(args[2])!)
        for down in [true, false] {
            let event = CGEvent(keyboardEventSource: nil, virtualKey: key, keyDown: down)!
            event.flags = flags
            event.post(tap: .cghidEventTap)
        }
    default:
        throw ProbeError("Unknown probe command: \(args[0])")
    }
}

do {
    try inspect(Array(CommandLine.arguments.dropFirst()))
} catch {
    FileHandle.standardError.write(Data("\(error)\n".utf8))
    exit(1)
}

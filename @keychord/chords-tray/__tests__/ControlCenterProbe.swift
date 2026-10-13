// Read live accessibility evidence for the VM-only Bun UI tests.
import AppKit
import ApplicationServices

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
    var value: CFTypeRef?
    return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}

func descendants(_ element: AXUIElement, depth: Int = 0) -> [AXUIElement] {
    guard depth < 30 else { return [] }
    return [element] + (attribute(element, kAXChildrenAttribute) as? [AXUIElement] ?? [])
        .flatMap { descendants($0, depth: depth + 1) }
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data(message.utf8))
    exit(1)
}

var modelSize = 0
guard sysctlbyname("hw.model", nil, &modelSize, nil, 0) == 0, modelSize > 0 else {
    fail("Could not determine Mac hardware model")
}
var model = [CChar](repeating: 0, count: modelSize)
guard sysctlbyname("hw.model", &model, &modelSize, nil, 0) == 0 else {
    fail("Could not read Mac hardware model")
}
guard String(cString: model).hasPrefix("VirtualMac") else {
    fail("Refusing to inspect or interact with the host Mac")
}

guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.controlcenter").first else {
    fail("Control Center is not running")
}
let application = AXUIElementCreateApplication(app.processIdentifier)
// The icon can belong to MenuBarAgent even though the panel belongs to Control Center.
let owners = NSWorkspace.shared.runningApplications.filter {
    ["com.apple.controlcenter", "com.apple.MenuBarAgent", "com.apple.systemuiserver"].contains($0.bundleIdentifier ?? "")
}
    .map { AXUIElementCreateApplication($0.processIdentifier) }
let elements = owners.flatMap { owner in
    let menuBars = [kAXMenuBarAttribute, kAXExtrasMenuBarAttribute].compactMap { name -> AXUIElement? in
        guard let value = attribute(owner, name), CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
        return unsafeBitCast(value, to: AXUIElement.self)
    }
    return (menuBars + [owner]).flatMap { descendants($0) }
}
let arguments = Array(CommandLine.arguments.dropFirst())
if arguments.first == "frontmost" {
    print(NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "")
    exit(0)
}
if arguments.first == "activate", arguments.count == 2 {
    NSRunningApplication.runningApplications(withBundleIdentifier: arguments[1]).first?.activate()
    exit(0)
}
if arguments.first == "close" {
    let windows = attribute(application, kAXWindowsAttribute) as? [AXUIElement] ?? []
    if !windows.isEmpty,
       let item = elements.first(where: { attribute($0, kAXIdentifierAttribute) as? String == "com.apple.menuextra.controlcenter" }) {
        _ = AXUIElementPerformAction(item, kAXPressAction as CFString)
    }
} else {
    let target: AXUIElement
    if arguments.first == "windows", arguments.count == 2,
       let app = NSRunningApplication.runningApplications(withBundleIdentifier: arguments[1]).first {
        target = AXUIElementCreateApplication(app.processIdentifier)
    } else {
        target = application
    }
    let windows = attribute(target, kAXWindowsAttribute) as? [AXUIElement] ?? []
    let roots = arguments.first == "menu-bar" ? elements : windows.flatMap { descendants($0) }
    let snapshot = roots.map { element -> [String: Any] in
        var actions: CFArray?
        _ = AXUIElementCopyActionNames(element, &actions)
        var entry: [String: Any] = ["actions": actions as? [String] ?? []]
        for (key, name) in [("role", kAXRoleAttribute), ("identifier", kAXIdentifierAttribute),
                            ("title", kAXTitleAttribute), ("description", kAXDescriptionAttribute),
                            ("value", kAXValueAttribute), ("minimum", kAXMinValueAttribute),
                            ("maximum", kAXMaxValueAttribute), ("enabled", kAXEnabledAttribute)] {
            if let value = attribute(element, name), value is String || value is NSNumber {
                entry[key] = value
            }
        }
        return entry
    }
    let data = try JSONSerialization.data(withJSONObject: snapshot, options: [.sortedKeys])
    print(String(decoding: data, as: UTF8.self))
}

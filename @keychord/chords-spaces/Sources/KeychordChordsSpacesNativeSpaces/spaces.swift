import AppKit
import ApplicationServices
import ChordNodeSupport
import Darwin
import NodeAPI

#NodeModule(exports: [
    "switchSpace": try NodeFunction { (command: String) throws -> NodePromise in
        try mainActorPromise { try await switchSpace(command) }
    },
])

private struct SpaceError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

private struct ManagedDisplay {
    struct Space {
        let id: UInt64
        let isDesktop: Bool
    }

    let identifier: String
    let current: UInt64
    let spaces: [Space]
}

private final class SpaceLayout {
    private let library: UnsafeMutableRawPointer
    private typealias Connection = @convention(c) () -> Int32
    private typealias ActiveSpace = @convention(c) (Int32) -> UInt64
    private typealias CopyDisplays = @convention(c) (Int32) -> Unmanaged<CFArray>?
    private let connection: Int32
    private let getActiveSpace: ActiveSpace
    private let copyDisplays: CopyDisplays

    init() throws {
        guard let library = dlopen("/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight", RTLD_LAZY) else {
            throw SpaceError("Could not load macOS Space layout")
        }
        guard let connection = dlsym(library, "SLSMainConnectionID"),
              let active = dlsym(library, "SLSGetActiveSpace"),
              let displays = dlsym(library, "SLSCopyManagedDisplaySpaces") else {
            dlclose(library)
            throw SpaceError("This version of macOS does not expose the Space layout")
        }
        self.library = library
        self.connection = unsafeBitCast(connection, to: Connection.self)()
        self.getActiveSpace = unsafeBitCast(active, to: ActiveSpace.self)
        self.copyDisplays = unsafeBitCast(displays, to: CopyDisplays.self)
    }

    deinit { dlclose(library) }

    var active: UInt64 { getActiveSpace(connection) }

    func displays() throws -> [ManagedDisplay] {
        guard let rows = copyDisplays(connection)?.takeRetainedValue() as? [[String: Any]], !rows.isEmpty else {
            throw SpaceError("Could not read macOS Spaces")
        }
        return try rows.map { row in
            guard let identifier = row["Display Identifier"] as? String,
                  let current = (row["Current Space"] as? [String: Any])?["id64"] as? NSNumber,
                  let spaces = row["Spaces"] as? [[String: Any]] else {
                throw SpaceError("The macOS display has an unexpected Space layout")
            }
            return ManagedDisplay(identifier: identifier, current: current.uint64Value, spaces: try spaces.map { space in
                guard let id = space["id64"] as? NSNumber, let type = space["type"] as? NSNumber else {
                    throw SpaceError("Could not identify a macOS Space")
                }
                return ManagedDisplay.Space(id: id.uint64Value, isDesktop: type.intValue == 0)
            })
        }
    }
}

private func attribute<T>(_ element: AXUIElement, _ key: String) -> T? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, key as CFString, &value) == .success else { return nil }
    return value as? T
}

private func elements(_ root: AXUIElement, identifiedBy identifier: String, depth: Int) -> [AXUIElement] {
    if attribute(root, kAXIdentifierAttribute) == identifier { return [root] }
    guard depth > 0 else { return [] }
    let children: [AXUIElement] = attribute(root, kAXChildrenAttribute) ?? []
    return children.flatMap { elements($0, identifiedBy: identifier, depth: depth - 1) }
}

private func bounds(of element: AXUIElement) -> CGRect? {
    guard let position: AXValue = attribute(element, kAXPositionAttribute),
          let sizeValue: AXValue = attribute(element, kAXSizeAttribute) else { return nil }
    var origin = CGPoint.zero
    var size = CGSize.zero
    guard AXValueGetValue(position, .cgPoint, &origin), AXValueGetValue(sizeValue, .cgSize, &size) else { return nil }
    return CGRect(origin: origin, size: size)
}

@MainActor
private func displayBounds(_ identifier: String) -> CGRect? {
    if identifier == "Main" { return CGDisplayBounds(CGMainDisplayID()) }
    for screen in NSScreen.screens {
        guard let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber,
              let uuid = CGDisplayCreateUUIDFromDisplayID(number.uint32Value)?.takeRetainedValue(),
              let name = CFUUIDCreateString(nil, uuid) as String?,
              name.caseInsensitiveCompare(identifier) == .orderedSame else { continue }
        return CGDisplayBounds(number.uint32Value)
    }
    return nil
}

@MainActor
private func missionControlDisplays() -> [AXUIElement] {
    // macOS 27 moved Mission Control from Dock to WindowManager.
    for bundleId in ["com.apple.WindowManager", "com.apple.dock"] {
        guard let process = NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first else { continue }
        let app = AXUIElementCreateApplication(process.processIdentifier)
        AXUIElementSetMessagingTimeout(app, 0.25)
        let displays = elements(app, identifiedBy: "mc.display", depth: 3)
        if !displays.isEmpty { return displays }
    }
    return []
}

private func openMissionControl() throws {
    typealias Notify = @convention(c) (CFString, Int32) -> Int32
    guard let pointer = dlsym(UnsafeMutableRawPointer(bitPattern: -2), "CoreDockSendNotification"),
          unsafeBitCast(pointer, to: Notify.self)("com.apple.expose.awake" as CFString, 0) == 0 else {
        throw SpaceError("Could not open Mission Control")
    }
}

@MainActor
private func switchSpace(_ command: String) async throws {
    guard AXIsProcessTrusted() else { throw SpaceError("Grant Chord Accessibility access to switch Spaces") }
    let layout = try SpaceLayout()
    let displays = try layout.displays()
    let target: (display: ManagedDisplay, index: Int)
    if let number = Int(command), number > 0 {
        let desktops = displays.flatMap { display in
            display.spaces.indices.filter { display.spaces[$0].isDesktop }.map { (display, $0) }
        }
        guard desktops.indices.contains(number - 1) else { throw SpaceError("Desktop \(number) does not exist") }
        target = desktops[number - 1]
    } else {
        guard command == "PREVIOUS" || command == "NEXT" else { throw SpaceError("Unknown Space command: \(command)") }
        let active = layout.active
        guard let display = displays.first(where: { $0.current == active }),
              let current = display.spaces.firstIndex(where: { $0.id == active }) else {
            throw SpaceError("Could not identify the active Space")
        }
        let index = current + (command == "PREVIOUS" ? -1 : 1)
        guard display.spaces.indices.contains(index) else { return }
        target = (display, index)
    }
    let destination = target.display.spaces[target.index].id
    guard destination != target.display.current else { return }

    let opened = missionControlDisplays().isEmpty
    if opened { try openMissionControl() }
    var switched = false
    defer {
        if opened && !switched {
            for down in [true, false] {
                CGEvent(keyboardEventSource: nil, virtualKey: 53, keyDown: down)?.post(tap: .cghidEventTap)
            }
        }
    }
    let frame = displayBounds(target.display.identifier)
    let deadline = ContinuousClock.now + .seconds(6)
    while ContinuousClock.now < deadline {
        let groups = missionControlDisplays()
        let group = groups.count == 1 && displays.count == 1 ? groups.first : groups.first { group in
            guard let frame, let actual = bounds(of: group) else { return false }
            return frame.contains(CGPoint(x: actual.midX, y: actual.midY))
        }
        if let group, let list = elements(group, identifiedBy: "mc.spaces.list", depth: 3).first {
            let children: [AXUIElement] = attribute(list, kAXChildrenAttribute) ?? []
            let buttons = children.filter { attribute($0, kAXRoleAttribute) == kAXButtonRole }
            // The list includes fullscreen Spaces. Wait for all buttons before selecting by index.
            if buttons.count == target.display.spaces.count {
                // The thumbnails can be exposed before their transition accepts presses.
                let positioned = buttons.compactMap { button in bounds(of: button).map { (button, $0) } }
                guard positioned.count == buttons.count else {
                    try await Task.sleep(for: .milliseconds(30))
                    continue
                }
                let ordered = positioned.sorted { $0.1.midX < $1.1.midX }
                try await Task.sleep(for: .milliseconds(220))
                let button = ordered[target.index].0
                let status = AXUIElementPerformAction(button, kAXPressAction as CFString)
                guard status == .success else { throw SpaceError("Could not select the Space (AX error \(status.rawValue))") }
                let activationDeadline = ContinuousClock.now + .seconds(4)
                var retryAt = ContinuousClock.now + .milliseconds(600)
                while ContinuousClock.now < activationDeadline {
                    if try layout.displays().contains(where: { $0.identifier == target.display.identifier && $0.current == destination }) {
                        switched = true
                        // Wait for the panel to close before allowing the next queued switch.
                        while ContinuousClock.now < activationDeadline, !missionControlDisplays().isEmpty {
                            try await Task.sleep(for: .milliseconds(30))
                        }
                        return
                    }
                    if ContinuousClock.now >= retryAt, !missionControlDisplays().isEmpty {
                        _ = AXUIElementPerformAction(button, kAXPressAction as CFString)
                        retryAt = ContinuousClock.now + .milliseconds(600)
                    }
                    try await Task.sleep(for: .milliseconds(30))
                }
                throw SpaceError("Mission Control did not switch from Space \(target.display.current) to \(destination)")
            }
        }
        try await Task.sleep(for: .milliseconds(30))
    }
    throw SpaceError("Mission Control did not expose the requested Space")
}

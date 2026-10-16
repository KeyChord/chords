import AppKit
import AXorcistRuntime
import ApplicationServices
import Darwin
import ObjectiveC

/// Private Space APIs are resolved at runtime so removed symbols produce errors, not load failures.
@MainActor
private struct WindowSpacesAPI {
    typealias MainConnection = @convention(c) () -> Int32
    typealias CopyDisplays = @convention(c) (Int32) -> Unmanaged<CFArray>?
    typealias CopyWindowSpaces = @convention(c) (Int32, Int32, CFArray) -> Unmanaged<CFArray>?
    typealias MoveWindows = @convention(c) (Int32, CFArray, UInt64) -> Void
    typealias SetCompatID = @convention(c) (Int32, UInt64, Int32) -> Int32
    typealias SetWorkspace = @convention(c) (Int32, UnsafePointer<UInt32>, Int32, Int32) -> Int32
    typealias PerformOperation = @convention(c) (AnyObject, Selector) -> Void

    let library: UnsafeMutableRawPointer
    let connection: Int32
    let copyDisplays: CopyDisplays
    let copyWindowSpaces: CopyWindowSpaces

    init() throws {
        guard let library = dlopen("/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight", RTLD_LAZY) else {
            throw WindowError("Could not load the macOS Spaces API")
        }
        self.library = library
        do {
            func load<T>(_ name: String, _: T.Type) throws -> T {
                guard let symbol = dlsym(library, name) else { throw WindowError("The macOS Spaces API is unavailable: \(name)") }
                return unsafeBitCast(symbol, to: T.self)
            }
            connection = try load("SLSMainConnectionID", MainConnection.self)()
            copyDisplays = try load("SLSCopyManagedDisplaySpaces", CopyDisplays.self)
            copyWindowSpaces = try load("SLSCopySpacesForWindows", CopyWindowSpaces.self)
        } catch {
            dlclose(library)
            throw error
        }
    }

    func spaces(for window: CGWindowID) throws -> [UInt64] {
        guard let result = copyWindowSpaces(connection, 7, [NSNumber(value: window)] as CFArray)?.takeRetainedValue(),
              let spaces = result as? [NSNumber] else { throw WindowError("Could not read the window's Spaces") }
        return spaces.map(\.uint64Value)
    }

    func desktops() throws -> [[UInt64]] {
        guard let result = copyDisplays(connection)?.takeRetainedValue(),
              let displays = result as? [[String: Any]] else { throw WindowError("Could not read the macOS desktops") }
        return try displays.map { display in
            guard let spaces = display["Spaces"] as? [[String: Any]] else { throw WindowError("Could not read the display's Spaces") }
            return try spaces.compactMap { space in
                guard let type = space["type"] as? NSNumber else { throw WindowError("Could not read a Space type") }
                guard type.intValue == 0 else { return nil } // Ordinary desktops, excluding full-screen Spaces.
                guard let id = (space["id64"] ?? space["ManagedSpaceID"]) as? NSNumber else { throw WindowError("Could not read a Space ID") }
                return id.uint64Value
            }
        }
    }

    func move(_ window: CGWindowID, to destination: UInt64) throws {
        let windows = [NSNumber(value: window)] as CFArray
        // Invoke the bridged operation through its selector. Its C helper is not exported.
        if let cls = NSClassFromString("SLSBridgedMoveWindowsToManagedSpaceOperation"),
           let allocMethod = class_getClassMethod(cls, NSSelectorFromString("alloc")),
           let initMethod = class_getInstanceMethod(cls, NSSelectorFromString("initWithWindows:spaceID:")),
           let performMethod = class_getInstanceMethod(cls, NSSelectorFromString("performWithWMBridgeDelegate")) {
            typealias Allocate = @convention(c) (AnyClass, Selector) -> UnsafeMutableRawPointer?
            typealias Initialize = @convention(c) (UnsafeMutableRawPointer, Selector, CFArray, UInt64) -> Unmanaged<AnyObject>?
            let allocate = unsafeBitCast(method_getImplementation(allocMethod), to: Allocate.self)
            let initialize = unsafeBitCast(method_getImplementation(initMethod), to: Initialize.self)
            guard let instance = allocate(cls, NSSelectorFromString("alloc")),
                  let operation = initialize(instance, NSSelectorFromString("initWithWindows:spaceID:"), windows, destination)?.takeRetainedValue() else {
                throw WindowError("Could not create the macOS Space move operation")
            }
            let perform = unsafeBitCast(method_getImplementation(performMethod), to: PerformOperation.self)
            perform(operation, NSSelectorFromString("performWithWMBridgeDelegate"))
        } else if #available(macOS 14.5, *) {
            guard let compatSymbol = dlsym(library, "SLSSpaceSetCompatID"),
                  let workspaceSymbol = dlsym(library, "SLSSetWindowListWorkspace") else {
                throw WindowError("This macOS version does not provide a window Space move API")
            }
            let setCompatID = unsafeBitCast(compatSymbol, to: SetCompatID.self)
            let setWorkspace = unsafeBitCast(workspaceSymbol, to: SetWorkspace.self)
            let compatID: Int32 = 0x79616265
            guard setCompatID(connection, destination, compatID) == 0 else { throw WindowError("Could not prepare the destination Space") }
            // Always remove the temporary compatibility mapping, including on a failed move.
            let result = withUnsafePointer(to: window) { setWorkspace(connection, $0, 1, compatID) }
            let cleanup = setCompatID(connection, destination, 0)
            guard result == 0, cleanup == 0 else { throw WindowError("Could not move the window to the destination Space (\(result), \(cleanup))") }
        } else {
            guard let symbol = dlsym(library, "SLSMoveWindowsToManagedSpace") else { throw WindowError("The window Space move API is unavailable") }
            unsafeBitCast(symbol, to: MoveWindows.self)(connection, windows, destination)
        }
    }
}

@MainActor
func moveWindowToSpace(bundleId: String?, windowId: Int?, command: String) async throws {
    let target = try targetWindow(bundleId: bundleId, windowId: windowId)
    // A selected window that an earlier repetition moved off the visible Space has no
    // Accessibility element; the Space checks below still apply to it.
    if let window = target.element {
        guard window.subrole() == kAXStandardWindowSubrole,
              window.isMinimized() != true, window.isFullScreen() != true else {
            throw WindowError("Only regular, non-minimized windows can move between desktop Spaces")
        }
    }
    guard let id = target.id else { throw WindowError("Could not identify the target window") }
    let api = try WindowSpacesAPI()
    defer { dlclose(api.library) }
    let current = try api.spaces(for: id)
    guard current.count == 1 else { throw WindowError("The window must belong to exactly one desktop Space") }
    let desktops = try api.desktops()
    guard let display = desktops.first(where: { $0.contains(current[0]) }),
          let sourceIndex = display.firstIndex(of: current[0]) else { throw WindowError("The window is not on an ordinary desktop Space") }
    let destination: UInt64
    if command == "NEXT" || command == "PREVIOUS" {
        let index = sourceIndex + (command == "NEXT" ? 1 : -1)
        guard display.indices.contains(index) else { throw WindowError("There is no \(command == "NEXT" ? "next" : "previous") desktop Space on this display") }
        destination = display[index]
    } else {
        let all = desktops.flatMap { $0 }
        guard let number = Int(command), number > 0, number <= all.count else { throw WindowError("Desktop Space \(command) does not exist") }
        destination = all[number - 1]
    }
    if destination == current[0] { return }
    try api.move(id, to: destination)
    let deadline = ContinuousClock.now + .seconds(2)
    repeat {
        if try api.spaces(for: id) == [destination] { return }
        try await Task.sleep(for: .milliseconds(20))
    } while ContinuousClock.now < deadline
    throw WindowError("macOS did not move the window to the requested desktop Space")
}

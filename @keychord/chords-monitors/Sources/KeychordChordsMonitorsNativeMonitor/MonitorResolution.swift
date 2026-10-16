import CoreGraphics
import Foundation

struct MonitorMode {
    let id: Int32
    let width: Int
    let height: Int
    let pixelWidth: Int
    let pixelHeight: Int
    let refreshRate: Double
    let usable: Bool

    init(_ mode: CGDisplayMode) {
        self.init(id: mode.ioDisplayModeID, width: mode.width, height: mode.height,
                  pixelWidth: mode.pixelWidth, pixelHeight: mode.pixelHeight,
                  refreshRate: mode.refreshRate, usable: mode.isUsableForDesktopGUI())
    }

    init(id: Int32, width: Int, height: Int, pixelWidth: Int, pixelHeight: Int, refreshRate: Double, usable: Bool = true) {
        self.id = id
        self.width = width
        self.height = height
        self.pixelWidth = pixelWidth
        self.pixelHeight = pixelHeight
        self.refreshRate = refreshRate
        self.usable = usable
    }

    var valid: Bool {
        usable && width > 0 && height > 0 && pixelWidth > 0 && pixelHeight > 0
            && refreshRate.isFinite && refreshRate >= 0
    }
}

/// Select an exact desktop resolution, retaining Retina density and refresh rate when possible.
func monitorModeIndex(width: Int, height: Int, modes: [MonitorMode], current: MonitorMode) throws -> Int {
    guard width > 0, height > 0 else { throw MonitorError("Monitor resolutions must be positive absolute integers") }
    guard current.valid else { throw MonitorError("The current monitor mode is invalid") }
    let candidates = modes.indices.filter { modes[$0].valid && modes[$0].width == width && modes[$0].height == height }
    guard !candidates.isEmpty else {
        let available = Set(modes.filter(\.valid).map { "\($0.width)x\($0.height)" }).sorted().joined(separator: ", ")
        throw MonitorError("Unsupported monitor resolution \(width)x\(height). Available resolutions: \(available.isEmpty ? "none" : available)")
    }
    if let index = candidates.first(where: { modes[$0].id == current.id }) { return index }
    func densityDifference(_ mode: MonitorMode) -> Double {
        abs(Double(mode.pixelWidth) / Double(mode.width) - Double(current.pixelWidth) / Double(current.width))
            + abs(Double(mode.pixelHeight) / Double(mode.height) - Double(current.pixelHeight) / Double(current.height))
    }
    return candidates.min { left, right in
        let lhs = modes[left], rhs = modes[right]
        let lhsDensity = densityDifference(lhs), rhsDensity = densityDifference(rhs)
        if lhsDensity != rhsDensity { return lhsDensity < rhsDensity }
        let lhsRefresh = abs(lhs.refreshRate - current.refreshRate), rhsRefresh = abs(rhs.refreshRate - current.refreshRate)
        if lhsRefresh != rhsRefresh { return lhsRefresh < rhsRefresh }
        if lhs.refreshRate != rhs.refreshRate { return lhs.refreshRate > rhs.refreshRate }
        return lhs.id < rhs.id
    }!
}

/// Use Core Graphics' live display list so a preceding resolution change cannot leave cached frames.
func monitorContainingPointer() throws -> CGDirectDisplayID {
    guard let pointer = CGEvent(source: nil)?.location else { throw MonitorError("Could not read the pointer position") }
    var display: CGDirectDisplayID = 0
    var count: UInt32 = 0
    let error = CGGetDisplaysWithPoint(pointer, 1, &display, &count)
    guard error == .success, count > 0 else {
        throw MonitorError("No connected monitor contains the pointer (Core Graphics error \(error.rawValue))")
    }
    return display
}

@MainActor
func setMonitorResolution(width: Int, height: Int) throws {
    guard width > 0, height > 0 else { throw MonitorError("Monitor resolutions must be positive absolute integers") }
    let display = try monitorContainingPointer()
    guard let current = CGDisplayCopyDisplayMode(display) else { throw MonitorError("Could not read the monitor's current mode") }
    // Selecting the current dimensions must not replace their density or refresh rate.
    if current.width == width, current.height == height { return }
    let options = [kCGDisplayShowDuplicateLowResolutionModes as String: true] as CFDictionary
    guard let modes = CGDisplayCopyAllDisplayModes(display, options) as? [CGDisplayMode] else {
        throw MonitorError("Could not read the monitor's supported resolutions")
    }
    let index = try monitorModeIndex(width: width, height: height, modes: modes.map(MonitorMode.init), current: MonitorMode(current))
    // This mode lasts for the Chord process's lifetime; do not overwrite the saved display settings.
    let error = CGDisplaySetDisplayMode(display, modes[index], nil)
    guard error == .success else { throw MonitorError("Could not set monitor resolution \(width)x\(height) (Core Graphics error \(error.rawValue))") }
    guard let applied = CGDisplayCopyDisplayMode(display), applied.width == width, applied.height == height else {
        throw MonitorError("macOS did not apply the requested monitor resolution \(width)x\(height)")
    }
}

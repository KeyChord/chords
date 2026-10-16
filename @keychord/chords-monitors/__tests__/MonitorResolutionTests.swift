import CoreGraphics
import Foundation

@main
struct MonitorResolutionTests {
    static func main() throws {
        func mode(_ id: Int32, _ width: Int, _ height: Int, scale: Int = 2, hz: Double = 60, usable: Bool = true) -> MonitorMode {
            MonitorMode(id: id, width: width, height: height, pixelWidth: width * scale, pixelHeight: height * scale, refreshRate: hz, usable: usable)
        }
        let current = mode(1, 1440, 900)
        let modes = [mode(2, 1920, 1080, scale: 1), mode(3, 1920, 1080, hz: 120), mode(4, 1920, 1080), mode(5, 1920, 1080, usable: false), current]
        let selected = try monitorModeIndex(width: 1920, height: 1080, modes: modes, current: current)
        precondition(selected == 2)
        let unchanged = try monitorModeIndex(width: 1440, height: 900, modes: modes, current: current)
        precondition(unchanged == 4)
        let standard = try monitorModeIndex(width: 1920, height: 1080, modes: modes, current: mode(9, 1440, 900, scale: 1))
        precondition(standard == 0)
        let highRefresh = try monitorModeIndex(width: 1920, height: 1080, modes: modes, current: mode(9, 1440, 900, hz: 120))
        precondition(highRefresh == 1)
        for (width, height) in [(2000, 200), (0, 200), (-2, 200)] {
            do { _ = try monitorModeIndex(width: width, height: height, modes: modes, current: current); preconditionFailure("Accepted unsupported resolution") }
            catch let error as MonitorError {
                if width == 2000 { precondition(error.description.contains("Available resolutions") && error.description.contains("1920x1080")) }
            }
        }
        do { _ = try monitorModeIndex(width: 1920, height: 1080, modes: [mode(8, 1920, 1080, usable: false)], current: current); preconditionFailure("Accepted unusable mode") }
        catch is MonitorError {}
        print("monitor-resolution-selection-ok")
    }
}

import Foundation

@main
struct MonitorLayoutTests {
    static func main() throws {
        let primary = CGRect(x: 0, y: 0, width: 1440, height: 900)
        let left = CGRect(x: -1920, y: -100, width: 1920, height: 1080)
        let top = CGRect(x: 100, y: -1200, width: 1600, height: 1200)
        let right = CGRect(x: 1440, y: 0, width: 2560, height: 1440)
        let layout = MonitorLayout(frames: [primary, left, top, right])
        let pointer = CGPoint(x: 300, y: 300)
        func check(_ command: String, _ expected: Int, at point: CGPoint? = nil) throws {
            let result = try layout.target(command, pointer: point ?? pointer)
            precondition(result == expected, "\(command): \(result), expected \(expected)")
        }
        try check("1", 0)
        try check("4", 3)
        try check("PREVIOUS", 3)
        try check("NEXT", 1)
        try check("LEFT", 1)
        try check("RIGHT", 3)
        try check("UP", 2)
        try check("DOWN", 0, at: CGPoint(x: 300, y: -500))
        try check("NEXT", 0, at: CGPoint(x: 2000, y: 300))
        // Pointer outside every display falls back to the nearest display center.
        try check("NEXT", 2, at: CGPoint(x: -2500, y: 300))
        precondition(layout.monitor(for: CGRect(x: 1300, y: 200, width: 400, height: 300)) == 3)
        precondition(layout.monitor(for: CGRect(x: -100, y: 200, width: 400, height: 300)) == 0)
        precondition(layout.monitor(for: CGRect(x: 8000, y: 8000, width: 100, height: 100)) == nil)
        let single = MonitorLayout(frames: [primary])
        let next = try single.target("NEXT", pointer: pointer)
        let previous = try single.target("PREVIOUS", pointer: pointer)
        precondition(next == 0 && previous == 0)
        for command in ["0", "5", "9999999999999999999999999", "sideways"] {
            do { _ = try layout.target(command, pointer: pointer); preconditionFailure("Accepted \(command)") }
            catch is MonitorError {}
        }
        do { _ = try single.target("RIGHT", pointer: pointer); preconditionFailure("No right monitor") }
        catch is MonitorError {}
        do { _ = try MonitorLayout(frames: []).target("1", pointer: pointer); preconditionFailure("No monitors") }
        catch is MonitorError {}
        print("monitor-layout-ok")
    }
}

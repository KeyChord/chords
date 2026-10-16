import Foundation
import CoreGraphics

struct MonitorError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

/// Frames and pointer positions use global top-left macOS logical points.
struct MonitorLayout {
    let frames: [CGRect]

    private func distance(_ index: Int, from point: CGPoint) -> CGFloat {
        let frame = frames[index]
        return hypot(frame.midX - point.x, frame.midY - point.y)
    }

    func target(_ command: String, pointer: CGPoint) throws -> Int {
        guard !frames.isEmpty else { throw MonitorError("No monitor is available") }
        if let number = Int(command) {
            guard number > 0, number <= frames.count else {
                throw MonitorError("Monitor \(command) does not exist (\(frames.count) connected)")
            }
            return number - 1
        }
        let current = frames.firstIndex(where: { $0.contains(pointer) }) ?? frames.indices.min {
            distance($0, from: pointer) < distance($1, from: pointer)
        }!
        switch command {
        case "PREVIOUS": return (current + frames.count - 1) % frames.count
        case "NEXT": return (current + 1) % frames.count
        case "LEFT", "RIGHT", "UP", "DOWN":
            let origin = frames[current]
            let candidates = frames.indices.filter { index in
                guard index != current else { return false }
                let dx = frames[index].midX - origin.midX
                let dy = frames[index].midY - origin.midY
                // A slightly offset display above us is still above, not right.
                switch command {
                case "LEFT": return dx < 0 && abs(dx) >= abs(dy)
                case "RIGHT": return dx > 0 && abs(dx) >= abs(dy)
                case "UP": return dy < 0 && abs(dy) >= abs(dx)
                default: return dy > 0 && abs(dy) >= abs(dx)
                }
            }
            guard let index = candidates.min(by: {
                distance($0, from: CGPoint(x: origin.midX, y: origin.midY)) <
                    distance($1, from: CGPoint(x: origin.midX, y: origin.midY))
            }) else { throw MonitorError("No monitor to the \(command)") }
            return index
        default: throw MonitorError("Unknown monitor target: \(command)")
        }
    }

    /// Assign spanning windows to the display containing the largest portion.
    func monitor(for window: CGRect) -> Int? {
        let areas = frames.map { frame -> CGFloat in
            let overlap = frame.intersection(window)
            return overlap.isNull ? 0 : overlap.width * overlap.height
        }
        guard let index = areas.indices.max(by: { areas[$0] < areas[$1] }), areas[index] > 0 else { return nil }
        return index
    }
}

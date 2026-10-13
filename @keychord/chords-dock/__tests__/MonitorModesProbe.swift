import CoreGraphics
import Foundation

let pointer = CGEvent(source: nil)!.location
var display: CGDirectDisplayID = 0
var count: UInt32 = 0
guard CGGetDisplaysWithPoint(pointer, 1, &display, &count) == .success, count == 1,
      let current = CGDisplayCopyDisplayMode(display),
      let modes = CGDisplayCopyAllDisplayModes(display, [kCGDisplayShowDuplicateLowResolutionModes: true] as CFDictionary) as? [CGDisplayMode] else {
    fatalError("Could not inspect pointer display modes")
}
let result: [String: Any] = [
    "display": display,
    "current": [current.width, current.height],
    "available": modes.filter { $0.isUsableForDesktopGUI() }.map { [$0.width, $0.height] },
]
print(String(data: try JSONSerialization.data(withJSONObject: result), encoding: .utf8)!)

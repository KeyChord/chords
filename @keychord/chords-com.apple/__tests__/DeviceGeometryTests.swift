import CoreGraphics

@main
enum DeviceGeometryTests {
    static func main() {
        // Actual Mirroring layout, including a display above the primary.
        // No AX toolbar is needed, whether or not its controls are exposed.
        let window = CGRect(x: -400, y: -200, width: 380, height: 834)
        precondition(deviceScreenRect(window: window)
                     == CGRect(x: -392, y: -162, width: 364, height: 788))

        // Zoom changes the stream dimensions, while chrome remains in Mac points.
        precondition(deviceScreenRect(window: CGRect(x: 100, y: 200, width: 500, height: 1000))
                     == CGRect(x: 108, y: 238, width: 484, height: 954))

        // Landscape uses the same screen inset, without assuming a device aspect ratio.
        precondition(deviceScreenRect(window: CGRect(x: 0, y: 0, width: 834, height: 380))
                     == CGRect(x: 8, y: 38, width: 818, height: 334))

        // The smallest accepted window still has a valid one-point viewport.
        precondition(deviceScreenRect(window: CGRect(x: 0, y: 0, width: 17, height: 47))
                     == CGRect(x: 8, y: 38, width: 1, height: 1))
        for invalid in [
            CGRect(x: 0, y: 0, width: 16, height: 834),
            CGRect(x: 0, y: 0, width: 380, height: 46),
            CGRect(x: 0, y: 0, width: -380, height: 834),
            CGRect(x: 0, y: 0, width: 380, height: -834),
            CGRect(x: CGFloat.nan, y: 0, width: 380, height: 834),
            CGRect(x: 0, y: CGFloat.infinity, width: 380, height: 834),
            CGRect(x: 0, y: 0, width: CGFloat.infinity, height: 834),
            CGRect(x: 0, y: 0, width: 380, height: CGFloat.nan),
        ] {
            precondition(deviceScreenRect(window: invalid) == nil)
        }
        print("device-geometry-ok")
    }
}

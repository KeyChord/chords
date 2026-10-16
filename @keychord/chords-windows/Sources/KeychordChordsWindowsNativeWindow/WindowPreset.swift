import CoreGraphics

func windowPresetFrame(_ preset: String, window: CGRect, screen: CGRect) -> CGRect? {
    var frame = window
    switch preset {
    case "LEFT": frame.origin.x = screen.minX
    case "RIGHT": frame.origin.x = screen.maxX - frame.width
    case "TOP": frame.origin.y = screen.minY
    case "BOTTOM": frame.origin.y = screen.maxY - frame.height
    case "TOP_LEFT": frame.origin = screen.origin
    case "TOP_RIGHT": frame.origin = CGPoint(x: screen.maxX - frame.width, y: screen.minY)
    case "BOTTOM_LEFT": frame.origin = CGPoint(x: screen.minX, y: screen.maxY - frame.height)
    case "BOTTOM_RIGHT": frame.origin = CGPoint(x: screen.maxX - frame.width, y: screen.maxY - frame.height)
    case "HORIZONTAL": frame.origin.x = screen.minX; frame.size.width = screen.width
    case "VERTICAL": frame.origin.y = screen.minY; frame.size.height = screen.height
    case "CENTER": frame.origin = CGPoint(x: screen.midX - frame.width / 2, y: screen.midY - frame.height / 2)
    case "FILL": frame = screen
    default: return nil
    }
    return frame
}

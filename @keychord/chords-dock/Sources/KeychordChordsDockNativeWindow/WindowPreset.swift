import CoreGraphics

func windowPresetFrame(_ preset: String, window: CGRect, screen: CGRect) -> CGRect? {
    var frame = window
    switch preset {
    case "left": frame.origin.x = screen.minX
    case "right": frame.origin.x = screen.maxX - frame.width
    case "top": frame.origin.y = screen.minY
    case "bottom": frame.origin.y = screen.maxY - frame.height
    case "top-left": frame.origin = screen.origin
    case "top-right": frame.origin = CGPoint(x: screen.maxX - frame.width, y: screen.minY)
    case "bottom-left": frame.origin = CGPoint(x: screen.minX, y: screen.maxY - frame.height)
    case "bottom-right": frame.origin = CGPoint(x: screen.maxX - frame.width, y: screen.maxY - frame.height)
    case "horizontal": frame.origin.x = screen.minX; frame.size.width = screen.width
    case "vertical": frame.origin.y = screen.minY; frame.size.height = screen.height
    case "center": frame.origin = CGPoint(x: screen.midX - frame.width / 2, y: screen.midY - frame.height / 2)
    case "fill": frame = screen
    default: return nil
    }
    return frame
}

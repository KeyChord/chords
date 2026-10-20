import CoreGraphics

/// Mirroring's windowMargins are eight logical points at every zoom level.
/// Its 30-point toolbar plus the top margin occupy 38 points. These are Mac
/// points, independent of the device's zoom, orientation and display scale.
/// AX omits the toolbar outside its hover state, so it is not a geometry source.
func deviceScreenRect(window: CGRect) -> CGRect? {
    let margin: CGFloat = 8
    let topInset: CGFloat = 38
    guard [window.origin.x, window.origin.y, window.size.width, window.size.height].allSatisfy(\.isFinite),
          window.size.width >= 2 * margin + 1,
          window.size.height >= topInset + margin + 1 else { return nil }
    return CGRect(x: window.origin.x + margin, y: window.origin.y + topInset,
                  width: window.size.width - 2 * margin, height: window.size.height - topInset - margin)
}

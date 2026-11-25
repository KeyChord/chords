import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let dates = ["2019:04:17 10:15:00", "2023:09:12 14:30:00", "2025:02:23 12:45:00"]

for (index, date) in dates.enumerated() {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let context = CGContext(
        data: nil, width: 320, height: 240, bitsPerComponent: 8, bytesPerRow: 0,
        space: colorSpace, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
    ) else { throw CocoaError(.fileWriteUnknown) }
    context.setFillColor(red: CGFloat(index + 1) / 4, green: 0.5, blue: 0.75, alpha: 1)
    context.fill(CGRect(x: 0, y: 0, width: 320, height: 240))
    let url = directory.appendingPathComponent("Chordtest Photo \(index + 1).jpg")
    guard let image = context.makeImage(),
          let destination = CGImageDestinationCreateWithURL(
            url as CFURL, UTType.jpeg.identifier as CFString, 1, nil
          ) else { throw CocoaError(.fileWriteUnknown) }
    CGImageDestinationAddImage(destination, image, [
        kCGImagePropertyExifDictionary: [kCGImagePropertyExifDateTimeOriginal: date],
        kCGImagePropertyTIFFDictionary: [kCGImagePropertyTIFFDateTime: date],
    ] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { throw CocoaError(.fileWriteUnknown) }
}

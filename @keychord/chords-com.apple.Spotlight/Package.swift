// swift-tools-version: 6.2
//
// NodeSwift addon for `@keychord/chords-com.apple.Spotlight`. `@keychord/config` builds the
// dynamic product and stages it as `spotlight.node`. Product names are the Swift module names
// `#NodeModule` registers, and must stay unique across every chord package loaded together.
import PackageDescription

let package = Package(
    name: "ChordsComAppleSpotlight",
    platforms: [.macOS("14.0")],
    products: [
        .library(name: "KeychordChordsComAppleNativeSpotlight", type: .dynamic,
                 targets: ["KeychordChordsComAppleNativeSpotlight"]),
    ],
    dependencies: [
        .package(url: "https://github.com/kabiroberai/node-swift.git", exact: "1.5.1"),
        .package(url: "https://github.com/KeyChord/config.git", exact: "0.0.10"),
    ],
    targets: [
        .target(name: "KeychordChordsComAppleNativeSpotlight", dependencies: [
            .product(name: "NodeAPI", package: "node-swift"),
            .product(name: "NodeModuleSupport", package: "node-swift"),
            .product(name: "ChordNodeSupport", package: "config"),
        ]),
    ],
    swiftLanguageModes: [.v6]
)

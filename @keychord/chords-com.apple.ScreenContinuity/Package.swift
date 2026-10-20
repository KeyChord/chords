// swift-tools-version: 6.2
//
// NodeSwift addon for the `@keychord/chords-com.apple.ScreenContinuity` chord package.
//
// `@keychord/config` builds each dynamic library product with NodeSwift and stages the
// resulting addon at `target/<triple>/<name>/<name>.node` alongside `libNodeAPI.dylib`.
// NodeAPI stays dynamic on purpose: Chord loads several addons into one process, and
// statically linking it would register duplicate Swift/Objective-C classes.
//
// Product names are the Swift module names `#NodeModule` registers, and must stay unique
// across every chord package loaded together.
import PackageDescription

let package = Package(
    name: "ChordsComAppleScreenContinuity",
    platforms: [.macOS("14.0")],
    products: [
        .library(name: "KeychordChordsComAppleNativeScreenContinuity", type: .dynamic, targets: ["KeychordChordsComAppleNativeScreenContinuity"]),
    ],
    dependencies: [
        .package(url: "https://github.com/kabiroberai/node-swift.git", exact: "1.5.1"),
        .package(url: "https://github.com/KeyChord/config.git", exact: "0.0.10"),
    ],
    targets: [
        .target(
            name: "KeychordChordsComAppleNativeScreenContinuity",
            dependencies: [
                .product(name: "NodeAPI", package: "node-swift"),
                .product(name: "NodeModuleSupport", package: "node-swift"),
                .product(name: "AXorcistRuntime", package: "config"),
                .product(name: "ChordNodeSupport", package: "config"),
            ],
            path: "src/swift/screen-continuity"
        ),
    ],
    swiftLanguageModes: [.v5]
)

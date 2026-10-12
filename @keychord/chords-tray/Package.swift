// swift-tools-version: 6.2
//
// NodeSwift addon for the `@keychord/chords-tray` chord package.
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
    name: "ChordsTray",
    platforms: [.macOS("14.0")],
    products: [
        .library(name: "KeychordChordsTrayNativeTray", type: .dynamic, targets: ["KeychordChordsTrayNativeTray"]),
    ],
    dependencies: [
        .package(url: "https://github.com/kabiroberai/node-swift.git", exact: "1.5.1"),
        .package(url: "https://github.com/openclaw/AXorcist.git", revision: "aa07d72fbb1861b56f5833b4cff8d9101c8dfbb3"),
    ],
    targets: [
        .target(
            name: "KeychordChordsTrayNativeTray",
            dependencies: [
                .product(name: "NodeAPI", package: "node-swift"),
                .product(name: "NodeModuleSupport", package: "node-swift"),
                .product(name: "AXorcist", package: "AXorcist"),
            ]
        ),
    ],
    swiftLanguageModes: [.v6]
)

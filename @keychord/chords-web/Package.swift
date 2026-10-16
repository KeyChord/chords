// swift-tools-version: 6.1
//
// NodeSwift addon for the `@keychord/chords-web` chord package.
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
    name: "ChordsWeb",
    platforms: [.macOS("13.0")],
    products: [
        .library(name: "KeychordChordsWebNativeWeb", type: .dynamic, targets: ["KeychordChordsWebNativeWeb"]),
    ],
    dependencies: [
        .package(url: "https://github.com/kabiroberai/node-swift.git", exact: "1.5.1"),
        // The next upstream revision declares a SystemEventsScripting target without sources.
        .package(url: "https://github.com/rhx/swift-scripting-bridge.git", revision: "1934001eaccb2fe15fb8dbf71b570b8805432326"),
    ],
    targets: [
        .target(
            name: "KeychordChordsWebNativeWeb",
            dependencies: [
                .product(name: "NodeAPI", package: "node-swift"),
                .product(name: "NodeModuleSupport", package: "node-swift"),
            ],
            plugins: [.plugin(name: "GenerateScriptingInterface", package: "swift-scripting-bridge")]
        ),
    ],
    swiftLanguageModes: [.v5]
)

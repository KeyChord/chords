// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "ChordsDock",
    platforms: [.macOS("14.0")],
    products: [
        .library(name: "KeychordChordsDockNativeWindow", type: .dynamic, targets: ["KeychordChordsDockNativeWindow"]),
        .library(name: "KeychordChordsDockNativeMonitor", type: .dynamic, targets: ["KeychordChordsDockNativeMonitor"]),
    ],
    dependencies: [
        .package(url: "https://github.com/kabiroberai/node-swift.git", exact: "1.5.1"),
    ],
    targets: [
        .target(
            name: "KeychordChordsDockNativeMonitor",
            dependencies: [
                .product(name: "NodeAPI", package: "node-swift"),
                .product(name: "NodeModuleSupport", package: "node-swift"),
            ]
        ),
        .target(
            name: "KeychordChordsDockNativeWindow",
            dependencies: [
                .product(name: "NodeAPI", package: "node-swift"),
                .product(name: "NodeModuleSupport", package: "node-swift"),
            ]
        ),
    ],
    swiftLanguageModes: [.v6]
)

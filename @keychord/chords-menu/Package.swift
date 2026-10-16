// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "ChordsMenu",
    platforms: [.macOS("14.0")],
    products: [
        .library(name: "KeychordChordsMenuNativeMenu", type: .dynamic, targets: ["KeychordChordsMenuNativeMenu"]),
    ],
    dependencies: [
        .package(url: "https://github.com/kabiroberai/node-swift.git", exact: "1.5.1"),
        .package(url: "https://github.com/apple/swift-algorithms.git", exact: "1.2.1"),
        .package(url: "https://github.com/KeyChord/config.git", exact: "0.0.10"),
    ],
    targets: [
        .target(
            name: "KeychordChordsMenuNativeMenu",
            dependencies: [
                .product(name: "NodeAPI", package: "node-swift"),
                .product(name: "NodeModuleSupport", package: "node-swift"),
                .product(name: "Algorithms", package: "swift-algorithms"),
                .product(name: "AXorcistRuntime", package: "config"),
                .product(name: "ChordNodeSupport", package: "config"),
            ]
        ),
    ],
    swiftLanguageModes: [.v6]
)

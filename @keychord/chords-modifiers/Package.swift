// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "ChordsModifiers",
    platforms: [.macOS("14.0")],
    products: [
        .library(name: "KeychordChordsModifiersNativeKeys", type: .dynamic, targets: ["KeychordChordsModifiersNativeKeys"]),
    ],
    dependencies: [
        .package(url: "https://github.com/kabiroberai/node-swift.git", exact: "1.5.1"),
        .package(url: "https://github.com/KeyChord/config.git", exact: "0.0.10"),
    ],
    targets: [
        .target(
            name: "KeychordChordsModifiersNativeKeys",
            dependencies: [
                .product(name: "NodeAPI", package: "node-swift"),
                .product(name: "NodeModuleSupport", package: "node-swift"),
                .product(name: "ChordNodeSupport", package: "config"),
            ]
        ),
    ],
    swiftLanguageModes: [.v6]
)

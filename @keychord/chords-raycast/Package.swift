// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "ChordsRaycast",
    platforms: [.macOS("14.0")],
    products: [
        .library(name: "KeychordChordsRaycastNativeRaycast", type: .dynamic,
                 targets: ["KeychordChordsRaycastNativeRaycast"]),
    ],
    dependencies: [
        .package(url: "https://github.com/kabiroberai/node-swift.git", exact: "1.5.1"),
    ],
    targets: [
        .target(name: "KeychordChordsRaycastNativeRaycast", dependencies: [
            .product(name: "NodeAPI", package: "node-swift"),
            .product(name: "NodeModuleSupport", package: "node-swift"),
        ]),
    ],
    swiftLanguageModes: [.v6]
)

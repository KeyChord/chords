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
        .package(url: "https://github.com/openclaw/AXorcist.git", revision: "aa07d72fbb1861b56f5833b4cff8d9101c8dfbb3"),
    ],
    targets: [
        .target(
            name: "KeychordChordsMenuNativeMenu",
            dependencies: [
                .product(name: "NodeAPI", package: "node-swift"),
                .product(name: "NodeModuleSupport", package: "node-swift"),
                .product(name: "AXorcist", package: "AXorcist"),
            ]
        ),
    ],
    swiftLanguageModes: [.v6]
)

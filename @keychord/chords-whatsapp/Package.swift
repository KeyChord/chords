// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "ChordsWhatsApp",
    platforms: [.macOS("14.0")],
    products: [
        .library(name: "KeychordChordsWhatsAppNativeWhatsapp", type: .dynamic, targets: ["KeychordChordsWhatsAppNativeWhatsapp"]),
    ],
    dependencies: [
        .package(url: "https://github.com/kabiroberai/node-swift.git", exact: "1.5.1"),
    ],
    targets: [
        .target(name: "KeychordChordsWhatsAppNativeWhatsapp", dependencies: [
            .product(name: "NodeAPI", package: "node-swift"),
            .product(name: "NodeModuleSupport", package: "node-swift"),
        ]),
    ],
    swiftLanguageModes: [.v6]
)

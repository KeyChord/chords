import AppKit

@MainActor
final class Fixture: NSObject, NSApplicationDelegate, NSMenuDelegate {
    var window: NSWindow?
    let output = ProcessInfo.processInfo.environment["MENU_FIXTURE_OUTPUT"]!

    func record(_ value: String) {
        try! value.write(toFile: output, atomically: true, encoding: .utf8)
    }

    @objc func invoke(_ sender: NSMenuItem) { record(sender.title) }
    func menuWillOpen(_ menu: NSMenu) { record("opened:\(menu.title)") }

    func item(_ title: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: #selector(invoke(_:)), keyEquivalent: "")
        item.target = self
        return item
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let bar = NSMenu()
        for title in ["MenuFixture", "File", "Format"] {
            let top = NSMenuItem(title: title, action: nil, keyEquivalent: "")
            let menu = NSMenu(title: title)
            menu.autoenablesItems = false
            menu.delegate = self
            top.submenu = menu
            bar.addItem(top)
            if title == "File" {
                menu.addItem(item("Zoom Out"))
                menu.addItem(.separator())
                menu.addItem(item("Zoom Original"))
                let nested = NSMenuItem(title: "Submenu", action: nil, keyEquivalent: "")
                let submenu = NSMenu(title: "Submenu")
                submenu.autoenablesItems = false
                submenu.addItem(item("Zoom Outer"))
                nested.submenu = submenu
                menu.addItem(nested)
                let disabled = item("Disabled")
                disabled.isEnabled = false
                menu.addItem(disabled)
                menu.addItem(item("\u{200B}Clean Title"))
            } else {
                menu.addItem(item("Fixture Action"))
            }
        }
        NSApplication.shared.mainMenu = bar
        window = NSWindow(contentRect: NSRect(x: 100, y: 100, width: 320, height: 160),
                          styleMask: [.titled], backing: .buffered, defer: false)
        window?.title = "Chord menu regression fixture"
        window?.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
        try! String(ProcessInfo.processInfo.processIdentifier).write(toFile: output + ".pid", atomically: true, encoding: .utf8)
        record("ready")
    }
}

@main
struct MenuFixture {
    @MainActor
    static func main() {
        let app = NSApplication.shared
        let fixture = Fixture()
        app.setActivationPolicy(.regular)
        app.delegate = fixture
        withExtendedLifetime(fixture) { app.run() }
    }
}

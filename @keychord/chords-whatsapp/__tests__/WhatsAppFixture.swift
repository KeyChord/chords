import AppKit

@MainActor
final class ClickableText: NSView {
    let label: String
    let invoke: () -> Void
    init(label: String, frame: NSRect, invoke: @escaping () -> Void) {
        self.label = label
        self.invoke = invoke
        super.init(frame: frame)
        setAccessibilityElement(true)
        setAccessibilityRole(.staticText)
        setAccessibilityLabel(label)
    }
    required init?(coder: NSCoder) { fatalError("unused") }
    override func mouseDown(with event: NSEvent) { invoke() }
    override func draw(_ dirtyRect: NSRect) { (label as NSString).draw(at: .zero, withAttributes: [.foregroundColor: NSColor.labelColor]) }
}

@MainActor
final class PaletteButton: NSButton {
    override func accessibilityValue() -> Any? { "Fixture colour or image" }
}

@MainActor
final class Fixture: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var phase = "MAIN"
    var request = 0
    var sequence = 0
    var timer: Timer?
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!

    func record(_ action: String) {
        sequence += 1
        let active = NSWorkspace.shared.frontmostApplication?.processIdentifier == ProcessInfo.processInfo.processIdentifier
        let data = try! JSONSerialization.data(withJSONObject: ["action": action, "active": active, "phase": phase, "request": request, "sequence": sequence])
        try! data.write(to: URL(fileURLWithPath: output), options: .atomic)
    }

    func invoke(_ id: String) {
        switch id {
        case "group_info": showInfo()
        case "settings": showSettings()
        case "open_main_window", "chats": showMain()
        case "info_theme": showTheme()
        case "theme_bubble": showBubble()
        case "theme_wallpaper": showWallpaper()
        case "bubble_more":
            let menu = NSMenu()
            let reset = NSMenuItem(title: "Localized reset", action: #selector(menuAction(_:)), keyEquivalent: "")
            reset.identifier = NSUserInterfaceItemIdentifier("reset_chat_bubble")
            reset.target = self
            menu.addItem(reset)
            DispatchQueue.main.async { [weak self] in
                menu.popUp(positioning: nil, at: NSPoint(x: 700, y: 550), in: self?.window.contentView)
            }
        case "BackButton":
            let fromTheme = phase == "THEME"
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
                guard let self else { return }
                if fromTheme { self.showInfo() } else { self.showTheme() }
                self.record(id)
            }
            return
        default: break
        }
        record(id)
    }

    @objc func menuAction(_ sender: NSMenuItem) {
        let id = sender.identifier!.rawValue.replacingOccurrences(of: "\u{200E}", with: "")
        let toggles = ["pin": "unpin", "unpin": "pin", "archive": "unarchive", "unarchive": "archive", "mark_as_unread": "mark_as_read", "mark_as_read": "mark_as_unread", "turn_off_camera": "turn_on_camera", "turn_on_camera": "turn_off_camera", "mute_microphone": "unmute_microphone", "unmute_microphone": "mute_microphone", "raise_hand": "lower_hand", "lower_hand": "raise_hand", "start_screen_sharing": "stop_screen_sharing", "stop_screen_sharing": "start_screen_sharing", "show_participants": "hide_participants", "hide_participants": "show_participants"]
        if let next = toggles[id] { sender.identifier = NSUserInterfaceItemIdentifier(next); sender.title = "Localized \(next)" }
        invoke(id)
    }

    @objc func buttonAction(_ sender: NSButton) { invoke(sender.identifier!.rawValue) }

    func group(_ id: String, frame: NSRect, parent: NSView) -> NSView {
        let view = NSView(frame: frame)
        view.identifier = NSUserInterfaceItemIdentifier(id)
        view.setAccessibilityElement(true)
        view.setAccessibilityRole(.group)
        parent.addSubview(view)
        return view
    }

    func button(_ id: String, _ label: String, frame: NSRect, parent: NSView) {
        let button = NSButton(title: label, target: self, action: #selector(buttonAction(_:)))
        button.identifier = NSUserInterfaceItemIdentifier(id)
        button.frame = frame
        parent.addSubview(button)
    }

    func root(_ phase: String, heading: String? = nil) -> NSView {
        self.phase = phase
        let view = NSView(frame: NSRect(x: 0, y: 0, width: 900, height: 620))
        window.contentView = view
        if let heading {
            let title = NSTextField(labelWithString: heading)
            title.setAccessibilityRole(NSAccessibility.Role(rawValue: "AXHeading"))
            title.setAccessibilityLabel(heading)
            title.frame = NSRect(x: 100, y: 575, width: 500, height: 30)
            view.addSubview(title)
            button("BackButton", "Back", frame: NSRect(x: 10, y: 575, width: 80, height: 30), parent: view)
        }
        return view
    }

    func showMain() {
        let view = root("MAIN")
        button("SidebarButton_Archived", "Localized Archived", frame: NSRect(x: 20, y: 530, width: 220, height: 30), parent: view)
        button("SidebarButton_Starred", "Localized Starred", frame: NSRect(x: 270, y: 530, width: 220, height: 30), parent: view)
        let list = group("ChatListView_TableView", frame: NSRect(x: 20, y: 80, width: 300, height: 420), parent: view)
        _ = group("ChatListView_chipButtonsCell", frame: NSRect(x: 0, y: 390, width: 300, height: 25), parent: list)
        _ = group("ChatListView_archiveCell", frame: NSRect(x: 0, y: 360, width: 300, height: 25), parent: list)
        for index in 1...9 { button("chat_\(index)", "Fixture Chat \(index)", frame: NSRect(x: 0, y: 350 - index * 32, width: 250, height: 28), parent: list) }
    }

    func showSettings() {
        let view = root("SETTINGS")
        let duplicate = group("SettingsView_ProfileCell", frame: NSRect(x: 20, y: 400, width: 300, height: 50), parent: view)
        button("SettingsView_ProfileCell", "Localized Profile", frame: duplicate.bounds, parent: duplicate)
    }

    func showInfo() {
        let view = root("INFO")
        let header = group("contact-info-view-content-stack-view", frame: NSRect(x: 10, y: 500, width: 860, height: 100), parent: view)
        button("contact-info-header-profile-image", "Profile picture", frame: NSRect(x: 0, y: 40, width: 200, height: 30), parent: header)
        for (index, pair) in [("info_audio", "Audio call"), ("info_video", "Video call"), ("info_search", "Search")].enumerated() {
            button(pair.0, pair.1, frame: NSRect(x: index * 230, y: 0, width: 220, height: 30), parent: header)
        }
        let rows: [(String, String, Bool)] = [
            ("info_gallery", "Media, links and docs, 53", true), ("info_starred", "Starred, None", true),
            ("mute_dialog", "Mute, No", false), ("mute_status", "Mute status notifications, Yes", false),
            ("info_theme", "Chat theme", true), ("info_downloads", "More options", false),
            ("info_disappearing", "Disappearing messages, Off", true), ("info_privacy", "Advanced chat privacy", false),
            ("info_encryption", "Encryption", false), ("info_details", "Contact details", false),
            ("info_group_create", "Create group with Fixture Contact", false), ("info_group_add", "Add to group", false),
            ("Share_Contact", "Share contact", false), ("Contact_Info_Favorite_Action", "Add to Favourites", false),
            ("info_export", "Export chat", false), ("info_clear", "Clear chat", false),
            ("info_block", "Block Fixture Contact", false), ("info_report", "Report Fixture Contact", false),
        ]
        for (index, row) in rows.enumerated() {
            let frame = NSRect(x: 10 + (index % 3) * 290, y: 440 - (index / 3) * 55, width: 270, height: 40)
            if row.2 {
                let text = ClickableText(label: row.1, frame: frame) { [weak self] in self?.invoke(row.0) }
                text.identifier = NSUserInterfaceItemIdentifier(row.0)
                view.addSubview(text)
            } else { button(row.0, row.1, frame: frame, parent: view) }
        }
    }

    func showTheme() {
        let view = root("THEME", heading: "Chat theme")
        button("theme_bubble", "Chat bubble", frame: NSRect(x: 20, y: 440, width: 250, height: 40), parent: view)
        button("theme_wallpaper", "Wallpaper", frame: NSRect(x: 20, y: 380, width: 250, height: 40), parent: view)
        // Selecting a preset theme would change settings. It must not satisfy
        // the Chat theme navigation row, despite sharing its accessible label.
        for index in 0..<3 { button("theme_preset_\(index)", "Chat theme", frame: NSRect(x: 350, y: 440 - index * 55, width: 250, height: 40), parent: view) }
    }

    func palette(_ label: String, prefix: String, parent: NSView) {
        // Intentionally insert out of visual order. Selection must use AX
        // geometry and ignore the navigation button with the same label.
        button("navigation_decoy", label, frame: NSRect(x: 10, y: 530, width: 200, height: 30), parent: parent)
        for row in (1...3).reversed() {
            for column in (1...4).reversed() {
                let button = PaletteButton(title: label, target: self, action: #selector(buttonAction(_:)))
                button.identifier = NSUserInterfaceItemIdentifier("\(prefix)_\(row)_\(column)")
                button.frame = NSRect(x: 330 + column * 90, y: 500 - row * 90, width: 70, height: 70)
                parent.addSubview(button)
            }
        }
    }
    func showBubble() {
        let view = root("BUBBLE", heading: "Chat bubble")
        button("bubble_more", "More", frame: NSRect(x: 700, y: 575, width: 150, height: 30), parent: view)
        palette("Chat bubble", prefix: "bubble", parent: view)
    }
    func showWallpaper() {
        let view = root("WALLPAPER", heading: "Wallpaper")
        button("wallpaper_photo", "Choose photo", frame: NSRect(x: 20, y: 440, width: 250, height: 40), parent: view)
        button("wallpaper_colour", "Set a colour", frame: NSRect(x: 20, y: 380, width: 250, height: 40), parent: view)
        palette("Wallpaper", prefix: "wallpaper", parent: view)
    }

    func menus(mode: String) {
        let specs: [(String, [String])] = [
            ("com.apple.menu.application", ["settings", "open_main_window"]),
            ("com.apple.menu.file", ["new_chat", "new_call...", "new_group_call", "new_call_link"]),
            ("UIMenuChatListIdentifier", ["close_chat", "\u{200E}group_info", "search_chat", "video_call", "voice_call", "mark_as_unread", "archive", "pin", "8_hours", "1_week", "send_emoji", "send_gifs", "send_stickers", "export_chat", "clear_chat", "delete_chat", "block_dynamic"]),
            ("com.whatsapp.menu.call", ["turn_off_camera", "mute_microphone", "react", "raise_hand", "start_screen_sharing", "show_participants", "end_call", "always_on_top"]),
            ("com.apple.menu.view", ["chats", "calls", "updates", "previous_chat", "next_chat", "make_text_bigger", "make_text_smaller", "make_text_normal_size"]),
        ]
        let bar = NSMenu()
        for (scope, ids) in specs {
            let top = NSMenuItem(title: scope, action: nil, keyEquivalent: "")
            top.identifier = NSUserInterfaceItemIdentifier(scope)
            let menu = NSMenu(title: scope)
            menu.autoenablesItems = false
            for id in ids + (scope == "com.whatsapp.menu.call" && mode == "AMBIGUOUS" ? ["react"] : []) {
                if id == "delete_chat" && mode == "MISSING" { continue }
                let item = NSMenuItem(title: id == "block_dynamic" ? "\u{200E}Block Fixture Contact…" : "Localized \(id)", action: #selector(menuAction(_:)), keyEquivalent: "")
                item.identifier = NSUserInterfaceItemIdentifier(id)
                item.target = self
                item.isEnabled = id != "end_call" || mode != "DISABLED"
                menu.addItem(item)
            }
            top.submenu = menu
            bar.addItem(top)
        }
        NSApp.mainMenu = bar
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 50, y: 60, width: 900, height: 620), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "WhatsApp Chord Fixture"
        menus(mode: "DEFAULT")
        showMain()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        record("READY")
        try! String(ProcessInfo.processInfo.processIdentifier).write(toFile: output + ".pid", atomically: true, encoding: .utf8)
        timer = Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self, let data = try? Data(contentsOf: URL(fileURLWithPath: self.output + ".request")),
                      let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let token = request["token"] as? Int, token != self.request else { return }
                self.request = token
                self.menus(mode: request["mode"] as? String ?? "DEFAULT")
                self.showMain()
                self.record("READY")
            }
        }
    }
}

@main struct WhatsAppFixture {
    @MainActor static func main() {
        let app = NSApplication.shared
        let fixture = Fixture()
        app.setActivationPolicy(.regular)
        app.delegate = fixture
        withExtendedLifetime(fixture) { app.run() }
    }
}

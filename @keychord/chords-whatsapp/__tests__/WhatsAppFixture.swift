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
final class DevicePopover: NSView {
    var dismiss: (() -> Void)?
    override func accessibilityPerformCancel() -> Bool { dismiss?(); return true }
}

@MainActor
final class Fixture: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var chatWindow: NSWindow?
    var phase = "MAIN"
    var request = 0
    var sequence = 0
    var timer: Timer?
    var chatVisible = false
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!

    func record(_ action: String) {
        sequence += 1
        let active = NSWorkspace.shared.frontmostApplication?.processIdentifier == ProcessInfo.processInfo.processIdentifier
        let data = try! JSONSerialization.data(withJSONObject: ["action": action, "active": active, "phase": phase, "request": request, "sequence": sequence, "chatVisible": chatVisible, "chatWindowOpen": chatWindow?.isVisible == true])
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
        case "NavigationBar_MoreButton":
            let menu = NSMenu()
            let item = NSMenuItem(title: "\u{200E}Open in new window", action: #selector(openChatWindow(_:)), keyEquivalent: "")
            item.identifier = NSUserInterfaceItemIdentifier("com.apple.action.dynamic.\(UUID())")
            item.target = self
            menu.addItem(item)
            DispatchQueue.main.async { [weak self] in
                menu.popUp(positioning: nil, at: NSPoint(x: 700, y: 530), in: self?.window.contentView)
            }
        case "camera_open": showDevices(camera: true)
        case "audio_open": showDevices(camera: false)
        case "reactions_open": showReactions()
        case "call_chat": chatVisible.toggle()
        case "CallUI_DeclineButton", "CallUI_AcceptButton": showCall()
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

    @objc func buttonAction(_ sender: NSButton) {
        let id = sender.identifier!.rawValue
        if id == "ReactionsTray_ReactionButton" { showCall(); record("reaction_\(sender.tag)") }
        else { invoke(id) }
    }

    @objc func openChatWindow(_ sender: NSMenuItem) {
        let chat = NSWindow(contentRect: NSRect(x: 120, y: 120, width: 500, height: 500), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        chat.isReleasedWhenClosed = false
        chat.title = "Fixture Chat"
        chat.makeKeyAndOrderFront(nil)
        chatWindow = chat
        record("open_chat_window")
    }

    func group(_ id: String, frame: NSRect, parent: NSView) -> NSView {
        let view = NSView(frame: frame)
        view.identifier = NSUserInterfaceItemIdentifier(id)
        view.setAccessibilityElement(true)
        view.setAccessibilityRole(.group)
        parent.addSubview(view)
        return view
    }

    @discardableResult
    func button(_ id: String, _ label: String, frame: NSRect, parent: NSView) -> NSButton {
        let button = NSButton(title: label, target: self, action: #selector(buttonAction(_:)))
        button.identifier = NSUserInterfaceItemIdentifier(id)
        button.frame = frame
        parent.addSubview(button)
        return button
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
        button("TabBarButton_More", "More", frame: NSRect(x: 510, y: 530, width: 160, height: 30), parent: view)
        button("NavigationBar_MoreButton", "More", frame: NSRect(x: 700, y: 530, width: 160, height: 30), parent: view)
        let list = group("ChatListView_TableView", frame: NSRect(x: 20, y: 80, width: 300, height: 420), parent: view)
        _ = group("ChatListView_chipButtonsCell", frame: NSRect(x: 0, y: 390, width: 300, height: 25), parent: list)
        _ = group("ChatListView_archiveCell", frame: NSRect(x: 0, y: 360, width: 300, height: 25), parent: list)
        for index in 1...12 { button("chat_\(index)", "Fixture Chat \(index)", frame: NSRect(x: 0, y: 350 - index * 26, width: 250, height: 24), parent: list) }
    }

    func showSettings() {
        let view = root("SETTINGS")
        let duplicate = group("SettingsView_ProfileCell", frame: NSRect(x: 20, y: 400, width: 300, height: 50), parent: view)
        button("SettingsView_ProfileCell", "Localized Profile", frame: duplicate.bounds, parent: duplicate)
    }

    func showIncomingCall() {
        let view = root("INCOMING_CALL")
        button("CallUI_DeclineButton", "hang up", frame: NSRect(x: 100, y: 100, width: 200, height: 100), parent: view)
        button("CallUI_AcceptButton", "\u{200E}Accept call", frame: NSRect(x: 500, y: 100, width: 200, height: 100), parent: view)
    }

    func showCall() {
        let view = root("CALL")
        view.identifier = NSUserInterfaceItemIdentifier("Calling_Window")
        view.setAccessibilityElement(true)
        view.setAccessibilityRole(.group)
        for (index, item) in [("camera_open", "Video device selection"), ("audio_open", "Audio device selection"), ("reactions_open", "reaction"), ("add_people", "Add people"), ("call_chat", "Chat")].enumerated() {
            button(item.0, item.1, frame: NSRect(x: 20 + index * 170, y: 20, width: 160, height: 40), parent: view)
        }
    }

    func showDevices(camera: Bool) {
        showCall()
        let view = window.contentView!
        let popover = DevicePopover(frame: NSRect(x: 200, y: 100, width: 480, height: 480))
        popover.setAccessibilityElement(true)
        popover.setAccessibilityRole(NSAccessibility.Role(rawValue: "AXPopover"))
        popover.dismiss = { [weak self] in self?.showCall() }
        view.addSubview(popover)
        for (sectionIndex, section) in (camera ? ["Camera"] : ["Microphone", "Speaker"]).enumerated() {
            let heading = group("device_heading_\(section)", frame: NSRect(x: 10, y: 420 - sectionIndex * 220, width: 450, height: 30), parent: popover)
            heading.setAccessibilityRole(NSAccessibility.Role(rawValue: "AXHeading"))
            // Match the empty outer heading used by Catalyst's camera/mic menus.
            let text = NSTextField(labelWithString: section)
            text.frame = heading.bounds
            if section == "Speaker" { text.setAccessibilityRole(NSAccessibility.Role(rawValue: "AXHeading")); text.setAccessibilityLabel(section) }
            heading.addSubview(text)
            for index in 1...3 {
                let control = "\(section.lowercased())_\(index)"
                let text = ClickableText(label: "\(index == 1 ? "✓, " : "")Fixture \(section) \(index)", frame: NSRect(x: 20, y: 420 - sectionIndex * 220 - index * 45, width: 420, height: 35)) { [weak self] in
                    self?.showCall()
                    self?.record(control)
                }
                popover.addSubview(text)
            }
        }
    }

    func showReactions() {
        showCall()
        let view = window.contentView!
        let emoji = ["👍", "❤️", "😂", "😮", "😢", "🙏", "👏", "🥰", "🥹", "😭", "🔥", "🤣"]
        for (index, label) in emoji.enumerated() {
            button("ReactionsTray_ReactionButton", label, frame: NSRect(x: 20 + (index % 6) * 130, y: 400 - (index / 6) * 100, width: 100, height: 80), parent: view).tag = index + 1
        }
        button("ReactionsTray_PlusSign", "Add custom reaction", frame: NSRect(x: 800, y: 300, width: 80, height: 80), parent: view)
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
                self.chatWindow?.close()
                self.chatWindow = nil
                let mode = request["mode"] as? String ?? "DEFAULT"
                self.menus(mode: mode)
                self.chatVisible = false
                if mode == "INCOMING_CALL" { self.showIncomingCall() }
                else if mode == "CALL_CAMERA_OPEN" { self.showDevices(camera: true) }
                else if mode == "CALL_AUDIO_OPEN" { self.showDevices(camera: false) }
                else if mode == "CALL_REACTIONS_OPEN" { self.showReactions() }
                else if mode == "CALL" { self.showCall() }
                else { self.showMain() }
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

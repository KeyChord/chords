import AppKit

@MainActor
final class DismissWindow: NSWindow {
    var escape: (() -> Void)?
    override func cancelOperation(_ sender: Any?) { escape?() }
}

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

// Render a clickable row without publishing an accessibility element, as
// WhatsApp currently does for Group permissions, privacy, and encryption.
@MainActor
final class InaccessibleRow: NSView {
    let label: String
    let invoke: () -> Void
    init(_ label: String, frame: NSRect, invoke: @escaping () -> Void) {
        self.label = label
        self.invoke = invoke
        super.init(frame: frame)
        setAccessibilityElement(false)
    }
    required init?(coder: NSCoder) { fatalError("unused") }
    override func mouseDown(with event: NSEvent) { invoke() }
    override func draw(_ dirtyRect: NSRect) { (label as NSString).draw(at: NSPoint(x: 10, y: 12), withAttributes: [.foregroundColor: NSColor.labelColor]) }
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
final class ScrollAccessibility: NSObject {
    weak var view: PagedView?
    init(_ view: PagedView) { self.view = view }
    override func accessibilityIsIgnored() -> Bool { false }
    override func accessibilityAttributeNames() -> [NSAccessibility.Attribute] {
        [.role, .children, .parent, .window, .topLevelUIElement, .enabled]
    }
    override func accessibilityAttributeValue(_ attribute: NSAccessibility.Attribute) -> Any? {
        switch attribute {
        case .role: return NSAccessibility.Role.group.rawValue
        case .children: return view?.subviews ?? []
        case .parent: return view
        case .window, .topLevelUIElement: return view?.window
        case .enabled: return true
        default: return nil
        }
    }
    override func accessibilityActionNames() -> [NSAccessibility.Action] {
        [NSAccessibility.Action(rawValue: "AXScrollUp"), NSAccessibility.Action(rawValue: "AXScrollDown")]
    }
    override func accessibilityPerformAction(_ action: NSAccessibility.Action) {
        let page = action.rawValue == "AXScrollUp" ? 0 : 1
        DispatchQueue.main.async { [weak self] in self?.view?.changePage?(page) }
    }
}

// AppKit's modern NSView bridge only dispatches its predefined actions. A
// legacy accessibility object models Catalyst's AXScrollUp/AXScrollDown names.
@MainActor
final class PagedView: NSView {
    var page = 0
    var changePage: ((Int) -> Void)?
    private lazy var scrollAccessibility = ScrollAccessibility(self)
    override func accessibilityChildren() -> [Any]? { [scrollAccessibility] }
}

@MainActor
final class Fixture: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var navigationAlert: NSAlert?
    var chatWindow: NSWindow?
    var phase = "MAIN"
    var request = 0
    var sequence = 0
    var timer: Timer?
    var chatVisible = false
    var groupMode = false
    var permissionsMode = ""
    var selectedChat = 0
    var chatFilter = "ALL"
    var unblockImmediately = false
    var blocked = false
    var reported = false
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!

    func record(_ action: String) {
        sequence += 1
        let active = NSWorkspace.shared.frontmostApplication?.processIdentifier == ProcessInfo.processInfo.processIdentifier
        let data = try! JSONSerialization.data(withJSONObject: ["action": action, "active": active, "phase": phase, "request": request, "sequence": sequence, "chatVisible": chatVisible, "chatWindowOpen": chatWindow?.isVisible == true, "selectedChat": selectedChat, "chatFilter": chatFilter, "blocked": blocked, "reported": reported])
        try! data.write(to: URL(fileURLWithPath: output), options: .atomic)
    }

    func invoke(_ id: String) {
        switch id {
        case "group_info": showInfo()
        case "info_close": showMain()
        case "settings": showSettings()
        case "new_group": showGroupPicker()
        case "group_next": showGroupSetup()
        case "group_back": showGroupPicker()
        case "group_members": showGroupInfo(page: 1)
        case "group_permissions":
            _ = root("GROUP_PERMISSIONS", heading: permissionsMode == "GROUP_PERMISSIONS_WRONG_PAGE" ? "Advanced chat privacy" : "Group permissions")
        case "info_block": showBlockDialog()
        case "block_confirmed", "block_report_confirmed":
            blocked = true
            reported = id == "block_report_confirmed"
            showInfo()
        case "info_unblock":
            if unblockImmediately { blocked = false; showInfo(); record("unblock_confirmed"); return }
            showUnblockDialog()
        case "unblock_confirmed": blocked = false; showInfo()
        case "open_main_window", "chats": showMain()
        case "SidebarButton_Archived": showMain("ARCHIVED")
        case "filter_all": showMain("ALL")
        case "filter_unread": showMain("UNREAD")
        case "filter_favourites": showMain("FAVOURITES")
        case "filter_groups": showMain("GROUPS")
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
            if phase == "GROUP_SETUP" { showGroupPicker(); record("group_back"); return }
            let fromTheme = phase == "THEME"
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
                guard let self else { return }
                if fromTheme { self.showInfo() } else { self.showTheme() }
                self.record(id)
            }
            return
        default:
            if id.hasPrefix("chat_"), let index = Int(id.dropFirst(5)) { selectedChat = index }
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
        else if id.hasPrefix("ParticipantPicker_") { record("group_member_\(sender.tag)") }
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

    func showMain(_ filter: String = "ALL") {
        chatFilter = filter
        let view = root("MAIN")
        button("SidebarButton_Archived", "Localized Archived", frame: NSRect(x: 20, y: 530, width: 220, height: 30), parent: view)
        button("SidebarButton_Starred", "Localized Starred", frame: NSRect(x: 270, y: 530, width: 220, height: 30), parent: view)
        button("SidebarButton_Communities", "Localized Communities", frame: NSRect(x: 20, y: 570, width: 220, height: 30), parent: view)
        button("SidebarButton_MetaAI", "Localized AI", frame: NSRect(x: 270, y: 570, width: 220, height: 30), parent: view)
        view.addSubview(ClickableText(label: "Media", frame: NSRect(x: 510, y: 570, width: 160, height: 30)) { [weak self] in self?.record("sidebar_media") })
        button("TabBarButton_More", "More", frame: NSRect(x: 510, y: 530, width: 160, height: 30), parent: view)
        button("NavigationBar_MoreButton", "More", frame: NSRect(x: 700, y: 530, width: 160, height: 30), parent: view)
        let list = group("ChatListView_TableView", frame: NSRect(x: 20, y: 80, width: 300, height: 420), parent: view)
        let chips = group("ChatListView_chipButtonsCell", frame: NSRect(x: 0, y: 390, width: 300, height: 25), parent: list)
        for (index, label) in ["All", "Unread", "Favourites", "Groups"].enumerated() {
            button("filter_\(label.lowercased())", label, frame: NSRect(x: index * 75, y: 0, width: 70, height: 25), parent: chips)
        }
        _ = group("ChatListView_archiveCell", frame: NSRect(x: 0, y: 360, width: 300, height: 25), parent: list)
        let rows: [Int]
        switch filter {
        case "ARCHIVED": rows = [6, 11]
        case "UNREAD": rows = [2, 5, 12]
        case "FAVOURITES": rows = [4, 9]
        case "GROUPS": rows = [3, 7, 10]
        default: rows = Array(1...12)
        }
        for (position, index) in rows.enumerated() {
            let frame = NSRect(x: 0, y: 350 - (position + 1) * 26, width: 250, height: 24)
            if index == 12 {
                let text = ClickableText(label: "Fixture Chat 12", frame: frame) { [weak self] in self?.invoke("chat_12") }
                text.setAccessibilityHelp("Double tap to open chat, Double tap and hold for more options")
                list.addSubview(text)
            } else { button("chat_\(index)", "Fixture Chat \(index)", frame: frame, parent: list) }
        }
    }

    func paged(_ parent: NSView, page: Int, change: @escaping (Int) -> Void) -> NSView {
        let view = PagedView(frame: parent.bounds)
        view.page = page
        view.changePage = change
        view.setAccessibilityElement(true)
        view.setAccessibilityRole(.group)
        parent.addSubview(view)
        return view
    }

    func showSettings(page: Int = 0) {
        let view = root("SETTINGS")
        let nav = group("settings_navigation", frame: NSRect(x: 0, y: 575, width: 900, height: 40), parent: view)
        button("SettingsView_CloseButton", "Close", frame: NSRect(x: 0, y: 0, width: 80, height: 30), parent: nav)
        let list = paged(view, page: page) { [weak self] in self?.showSettings(page: $0) }
        let duplicate = group("SettingsView_ProfileCell", frame: NSRect(x: 20, y: 500, width: 300, height: 50), parent: list)
        button("SettingsView_ProfileCell", "Localized Profile", frame: duplicate.bounds, parent: duplicate)
        let entries = page == 0
            ? [("SettingsView_FavoritesCell", "Favourites"), ("SettingsView_StarredMessagesCell", "Starred"), ("settings_history", "Chat history"), ("SettingsView_AccountsCell", "Account"), ("SettingsView_PrivacyCell", "Privacy"), ("SettingsView_ChatsCell", "Chats"), ("SettingsView_AppearanceCell", "Appearance"), ("SettingsView_NotificationsCell", "Notifications"), ("SettingsView_AgentsCell", "Agents")]
            : [("SettingsView_DataAndStorageUsageCell", "Storage and data"), ("SettingsView_HelpCell", "Help and feedback")]
        for (index, item) in entries.enumerated() {
            button(item.0, item.1, frame: NSRect(x: 20, y: 450 - index * 45, width: 350, height: 35), parent: list)
        }
    }

    func showGroupPicker() {
        let view = root("GROUP_PICKER")
        let title = group("ParticipantPickerNavigationBar_TitleView", frame: NSRect(x: 100, y: 570, width: 500, height: 30), parent: view)
        title.setAccessibilityLabel("Add members")
        button("group_next", "Next", frame: NSRect(x: 700, y: 570, width: 150, height: 30), parent: view)
        let list = group("ParticipantPicker_TableView", frame: NSRect(x: 20, y: 30, width: 850, height: 520), parent: view)
        _ = group("picker_heading", frame: NSRect(x: 0, y: 490, width: 800, height: 20), parent: list)
        for index in 1...12 {
            let id = index == 1 ? "ParticipantPicker_SuggestedContactCell" : "ParticipantPicker_ContactCell"
            let row = group(id, frame: NSRect(x: 0, y: 490 - index * 38, width: 800, height: 35), parent: list)
            let control = button(id, "Fixture member \(index)", frame: row.bounds, parent: row)
            control.tag = index
            control.setButtonType(.switch)
        }
    }

    func showGroupSetup() {
        _ = root("GROUP_SETUP", heading: "New group")
    }

    func showNavigation(_ mode: String) {
        let view = root(mode)
        button("background_next", "Next", frame: NSRect(x: 700, y: 570, width: 150, height: 30), parent: view)
        button("BackButton", "Back", frame: NSRect(x: 10, y: 570, width: 80, height: 30), parent: view)
        if mode == "NAVIGATION_STACK" {
            let outer = DevicePopover(frame: NSRect(x: 30, y: 30, width: 650, height: 400))
            outer.setAccessibilityElement(true)
            outer.setAccessibilityRole(NSAccessibility.Role(rawValue: "AXPopover"))
            outer.dismiss = { [weak self] in self?.showMain(); self?.record("navigation_closed") }
            view.addSubview(outer)
            let inner = DevicePopover(frame: NSRect(x: 20, y: 20, width: 600, height: 350))
            inner.setAccessibilityElement(true)
            inner.setAccessibilityRole(NSAccessibility.Role(rawValue: "AXPopover"))
            inner.dismiss = { [weak self, weak inner] in inner?.removeFromSuperview(); self?.record("navigation_inner_closed") }
            outer.addSubview(inner)
            return
        }
        if mode == "NAVIGATION_HINTS" {
            let alert = NSAlert()
            alert.messageText = "Fixture confirmation"
            alert.addButton(withTitle: "設定").keyEquivalent = "\r"
            alert.addButton(withTitle: "戻る").keyEquivalent = "\u{1b}"
            alert.buttons.forEach { $0.keyEquivalentModifierMask = [] }
            navigationAlert = alert
            alert.beginSheetModal(for: window) { [weak self] response in
                if response == .alertFirstButtonReturn { self?.record("navigation_next") }
                else if response == .alertSecondButtonReturn { self?.record("navigation_previous") }
                self?.navigationAlert = nil
            }
            return
        }
        var parent: NSView = view
        if mode == "NAVIGATION_WINDOW" {
            let second = NSWindow(contentRect: NSRect(x: 120, y: 120, width: 700, height: 500), styleMask: [.titled, .closable], backing: .buffered, defer: false)
            second.isReleasedWhenClosed = false
            second.title = "Navigation window"
            parent = second.contentView!
            let toolbar = group("navigation_toolbar", frame: NSRect(x: 0, y: 450, width: 700, height: 50), parent: parent)
            toolbar.setAccessibilityRole(.toolbar)
            parent = toolbar
            second.makeKeyAndOrderFront(nil)
            chatWindow = second
        } else if mode != "NAVIGATION_DEFAULT" {
            if mode == "NAVIGATION_NESTED" {
                parent = group("outer_dialog", frame: NSRect(x: 30, y: 30, width: 840, height: 520), parent: view)
                parent.setAccessibilitySubrole(NSAccessibility.Subrole(rawValue: "AXDialog"))
                button("outer_next", "Next", frame: NSRect(x: 600, y: 470, width: 150, height: 30), parent: parent)
                button("outer_back", "Back", frame: NSRect(x: 10, y: 470, width: 80, height: 30), parent: parent)
            }
            let dialog = NSView(frame: NSRect(x: 30, y: 30, width: 650, height: 400))
            dialog.setAccessibilityElement(true)
            dialog.setAccessibilityRole(.group)
            parent.addSubview(dialog)
            parent = dialog
            parent.setAccessibilitySubrole(NSAccessibility.Subrole(rawValue: "AXDialog"))
        }
        if mode == "NAVIGATION_PARENT_DEFAULT" {
            let background = view.subviews.first { $0.identifier?.rawValue == "background_next" } as! NSButton
            window.defaultButtonCell = background.cell as? NSButtonCell
            return
        }
        if mode == "NAVIGATION_EMPTY" { return }
        if mode == "NAVIGATION_OPTIONS" || mode == "NAVIGATION_OPTION_DISABLED" {
            for index in (1...12).reversed() {
                let control = button("option_\(index)", "選択 \(index)", frame: NSRect(x: 20 + ((index - 1) % 3) * 200, y: 300 - ((index - 1) / 3) * 70, width: 160, height: 35), parent: parent)
                if index == 4 { control.setButtonType(.switch) }
                control.isEnabled = mode != "NAVIGATION_OPTION_DISABLED" || index != 4
            }
            return
        }
        if mode == "NAVIGATION_ESCAPE" || mode == "NAVIGATION_ESCAPE_IGNORED" {
            (window as? DismissWindow)?.escape = { [weak self] in
                if mode == "NAVIGATION_ESCAPE" { self?.showMain(); self?.record("navigation_closed") }
            }
            return
        }
        let previousLabel = mode == "NAVIGATION_LOCALIZED" ? "戻る" : mode == "NAVIGATION_MISLEADING" ? "Next" : mode == "NAVIGATION_SYMBOLS" ? "" : "Close"
        let nextLabel = mode == "NAVIGATION_LOCALIZED" ? "設定" : mode == "NAVIGATION_MISLEADING" ? "Back" : mode == "NAVIGATION_SYMBOLS" ? "" : mode == "NAVIGATION_NESTED" ? "Done" : mode == "NAVIGATION_DEFAULT" ? "Create" : "Set"
        let headerY = parent.bounds.height - 50
        let previous = button("navigation_previous", previousLabel == "Close" ? "×" : previousLabel, frame: NSRect(x: 10, y: headerY, width: 100, height: 30), parent: parent)
        previous.setAccessibilityLabel(previousLabel)
        let next = button("navigation_next", nextLabel, frame: NSRect(x: 480, y: headerY, width: 150, height: 30), parent: parent)
        next.isEnabled = mode != "NAVIGATION_DISABLED"
        if mode == "NAVIGATION_AMBIGUOUS" {
            button("navigation_ambiguous", "Save", frame: NSRect(x: 300, y: headerY, width: 150, height: 30), parent: parent)
        }
        if mode == "NAVIGATION_BODY" {
            previous.frame.origin.y = 100
            next.frame.origin.y = 100
        }
        if mode == "NAVIGATION_DEFAULT" {
            next.frame.origin = NSPoint(x: 10, y: 100)
            next.keyEquivalent = "\r"
            window.defaultButtonCell = next.cell as? NSButtonCell
        }
    }

    func showBlockDialog() {
        let view = root("BLOCK_DIALOG")
        let title = NSTextField(labelWithString: "Block “Fixture Contact”?")
        title.identifier = NSUserInterfaceItemIdentifier("ActionSheet_TitleLabel")
        title.frame = NSRect(x: 20, y: 500, width: 600, height: 40)
        view.addSubview(title)
        button("block_confirmed", "Block", frame: NSRect(x: 20, y: 400, width: 250, height: 40), parent: view)
        button("block_report_confirmed", "Block and report", frame: NSRect(x: 20, y: 300, width: 250, height: 40), parent: view)
    }

    func showUnblockDialog() {
        let view = root("UNBLOCK_DIALOG")
        let title = NSTextField(labelWithString: "Unblock “Fixture Contact”?")
        title.identifier = NSUserInterfaceItemIdentifier("ActionSheet_TitleLabel")
        title.frame = NSRect(x: 20, y: 500, width: 600, height: 40)
        view.addSubview(title)
        button("unblock_confirmed", "Unblock", frame: NSRect(x: 20, y: 400, width: 250, height: 40), parent: view)
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
        if groupMode { showGroupInfo(); return }
        let view = root("INFO")
        button("info_close", "close", frame: NSRect(x: 800, y: 580, width: 80, height: 30), parent: view)
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
            (blocked ? "info_unblock" : "info_block", blocked ? "Unblock Fixture Contact" : "Block Fixture Contact", false), ("info_report", "Report Fixture Contact", false),
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

    func showGroupInfo(page: Int = 0) {
        let view = root("GROUP_INFO")
        button("info_close", "close", frame: NSRect(x: 10, y: 580, width: 80, height: 30), parent: view)
        button("NavigationBar_GroupInfoQRButton", "Invite via link or QR code", frame: NSRect(x: 600, y: 580, width: 280, height: 30), parent: view)
        let list = paged(view, page: page) { [weak self] in self?.showGroupInfo(page: $0) }
        let header = group("contact-info-view-content-stack-view", frame: NSRect(x: 10, y: 500, width: 860, height: 70), parent: list)
        button("group_add", "Add", frame: NSRect(x: 10, y: 30, width: 200, height: 30), parent: header)
        let members = button("group_members", "2 members", frame: NSRect(x: 300, y: 30, width: 200, height: 30), parent: header)
        members.setAccessibilityRole(.link)
        if !permissionsMode.isEmpty {
            button("group_mute", "Mute, No", frame: NSRect(x: 20, y: 430, width: 500, height: 44), parent: list)
            button("group_notify", "Notify for, All", frame: NSRect(x: 20, y: 386, width: 500, height: 44), parent: list)
            list.addSubview(ClickableText(label: "Disappearing messages, Off", frame: NSRect(x: 20, y: 310, width: 500, height: permissionsMode == "GROUP_PERMISSIONS_BAD_LAYOUT" ? 20 : 44)) { [weak self] in self?.invoke("info_disappearing") })
            if permissionsMode == "GROUP_PERMISSIONS_OCCUPIED" {
                button("permissions_decoy", "A different action", frame: NSRect(x: 20, y: 266, width: 500, height: 44), parent: list)
            } else {
                list.addSubview(InaccessibleRow("Group permissions", frame: NSRect(x: 20, y: 266, width: 500, height: 44)) { [weak self] in self?.invoke("group_permissions") })
            }
            for (index, title) in ["Advanced chat privacy", "Encryption"].enumerated() {
                list.addSubview(InaccessibleRow(title, frame: NSRect(x: 20, y: 222 - index * 44, width: 500, height: 44)) { [weak self] in self?.invoke("wrong_row") })
            }
            button("group_similar", "Create a similar group, Start with the same members", frame: NSRect(x: 20, y: 106, width: 500, height: 44), parent: list)
            return
        }
        let entries = page == 0
            ? [("group-description-row", "Add group description"), ("group_notify", "Notify for, All")]
            : [("Group_Info_Member_Changes", "View member changes"), ("group_exit", "Exit group"), ("group_report", "Report group"), ("group_similar", "Create a similar group, Start with the same members"), ("group_permissions", "Group permissions")]
        for (index, item) in entries.enumerated() {
            button(item.0, item.1, frame: NSRect(x: 20, y: 440 - index * 60, width: 500, height: 40), parent: list)
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
            ("com.apple.menu.file", ["new_chat", "new_group", "new_call...", "new_group_call", "new_call_link"]),
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
        window = DismissWindow(contentRect: NSRect(x: 50, y: 60, width: 900, height: 620), styleMask: [.titled, .closable], backing: .buffered, defer: false)
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
                self.window.defaultButtonCell = nil
                (self.window as? DismissWindow)?.escape = nil
                if let sheet = self.window.attachedSheet {
                    self.window.endSheet(sheet, returnCode: .abort)
                    sheet.orderOut(nil)
                }
                self.navigationAlert = nil
                self.window.makeKeyAndOrderFront(nil)
                let mode = request["mode"] as? String ?? "DEFAULT"
                self.menus(mode: mode)
                self.chatVisible = false
                self.permissionsMode = mode.hasPrefix("GROUP_PERMISSIONS_") ? mode : ""
                self.groupMode = mode == "GROUP" || !self.permissionsMode.isEmpty
                self.selectedChat = 0
                self.blocked = mode.hasPrefix("UNBLOCK")
                self.reported = false
                self.unblockImmediately = mode == "UNBLOCK_IMMEDIATE"
                if mode.hasPrefix("NAVIGATION_") { self.showNavigation(mode) }
                else if mode == "INCOMING_CALL" { self.showIncomingCall() }
                else if mode == "CALL_CAMERA_OPEN" { self.showDevices(camera: true) }
                else if mode == "CALL_AUDIO_OPEN" { self.showDevices(camera: false) }
                else if mode == "CALL_REACTIONS_OPEN" { self.showReactions() }
                else if mode == "CALL" { self.showCall() }
                else if mode == "GROUP_SETUP" { self.showGroupSetup() }
                else if mode == "GROUP_PICKER" { self.showGroupPicker() }
                else if mode == "BLOCK_DIALOG" { self.showBlockDialog() }
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

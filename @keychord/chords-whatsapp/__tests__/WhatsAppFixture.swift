import AppKit

@MainActor
final class DismissWindow: NSWindow {
    var escape: (() -> Void)?
    override func cancelOperation(_ sender: Any?) { escape?() }
}

@MainActor
// Reports focus only when a test asks, so it never overwrites another recorded action.
final class SearchField: NSSearchField {
    var focused: (() -> Void)?
    override func becomeFirstResponder() -> Bool {
        let became = super.becomeFirstResponder()
        if became, let focused { DispatchQueue.main.async(execute: focused) }
        return became
    }
}

// Catalyst reports focus on a chat's content as a group with this subrole.
final class ContentGroup: NSView {
    override var acceptsFirstResponder: Bool { true }
    override func isAccessibilityElement() -> Bool { true }
    override func accessibilityRole() -> NSAccessibility.Role? { .group }
    override func accessibilitySubrole() -> NSAccessibility.Subrole? { NSAccessibility.Subrole(rawValue: "iOSContentGroup") }
}

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

// Group Info action rows (Add members, Invite via link) expose an empty value;
// member rows expose none.
@MainActor
final class ActionRowButton: NSButton {
    override func accessibilityValue() -> Any? { "" }
}

@MainActor
final class MemberButton: NSButton {
    override func accessibilityValue() -> Any? { nil }
}

@MainActor
final class ScrollAccessibility: NSObject {
    weak var view: ListView?
    init(_ view: ListView) { self.view = view }
    override func accessibilityIsIgnored() -> Bool { false }
    override func accessibilityAttributeNames() -> [NSAccessibility.Attribute] {
        [.role, .children, .parent, .window, .topLevelUIElement, .enabled, .position, .size]
    }
    override func accessibilityAttributeValue(_ attribute: NSAccessibility.Attribute) -> Any? {
        switch attribute {
        case .role: return NSAccessibility.Role.group.rawValue
        // Like WhatsApp's table, the list has bounds (Cocoa screen coordinates).
        case .position: return view.map { NSValue(point: NSAccessibility.screenRect(fromView: $0, rect: $0.bounds).origin) }
        case .size: return view.map { NSValue(size: $0.bounds.size) }
        case .children: return view?.exposedRows ?? []
        case .parent: return view
        case .window, .topLevelUIElement: return view?.window
        case .enabled: return true
        default: return nil
        }
    }
    override func accessibilityActionNames() -> [NSAccessibility.Action] {
        guard let view else { return [] }
        return (view.canScroll(down: false) ? [NSAccessibility.Action(rawValue: "AXScrollUpByPage")] : [])
            + (view.canScroll(down: true) ? [NSAccessibility.Action(rawValue: "AXScrollDownByPage")] : [])
    }
    override func accessibilityPerformAction(_ action: NSAccessibility.Action) {
        let down = action.rawValue == "AXScrollDownByPage"
        guard down || action.rawValue == "AXScrollUpByPage" else { return }
        // WhatsApp animates the page and posts no notification when it lands.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { [weak self] in self?.view?.page(down: down) }
    }
}

// Models a Catalyst table in WhatsApp 26.38.74: only rows intersecting the
// viewport are exposed, except the pinned table header, and a row that leaves
// and returns is a new element. Page actions are offered only while that
// direction can scroll, and a page moves the viewport height less an overlap.
// AppKit's modern NSView bridge only dispatches its predefined actions, so a
// legacy accessibility object carries the page actions.
@MainActor
final class ListView: NSView {
    struct Row {
        var height: CGFloat = 43
        var gap: CGFloat = 0
        var pinned = false
        let make: () -> NSView
    }
    override var isFlipped: Bool { true }
    // An open action sheet hides the list from accessibility, as in WhatsApp.
    var modal = false
    private(set) var offset: CGFloat = 0
    private var made: [Int: NSView] = [:]
    private lazy var scrollAccessibility = ScrollAccessibility(self)
    var rows: [Row] = [] {
        didSet {
            made.values.forEach { $0.removeFromSuperview() }
            made = [:]
            offset = 0
            layoutRows()
        }
    }
    var exposedRows: [NSView] { subviews.sorted { $0.frame.minY < $1.frame.minY } }
    private var contentHeight: CGFloat { rows.reduce(0) { $0 + $1.gap + $1.height } }
    override func accessibilityChildren() -> [Any]? { modal ? [] : [scrollAccessibility] }
    func canScroll(down: Bool) -> Bool { down ? offset < contentHeight - bounds.height - 0.5 : offset > 0.5 }
    func page(down: Bool) { scroll(to: offset + (down ? 1 : -1) * (bounds.height - 40)) }
    func scroll(to target: CGFloat) {
        offset = max(0, min(target, contentHeight - bounds.height))
        layoutRows()
    }
    func top(of index: Int) -> CGFloat {
        rows[...index].reduce(0) { $0 + $1.gap + $1.height } - rows[index].height
    }
    func layoutRows() {
        var y: CGFloat = 0
        for (index, row) in rows.enumerated() {
            y += row.gap
            let frame = NSRect(x: 0, y: y - offset, width: bounds.width, height: row.height)
            y += row.height
            if row.pinned || (frame.maxY > 0 && frame.minY < bounds.height) {
                let view = made[index] ?? row.make()
                made[index] = view
                view.frame = frame
                // As in WhatsApp, rows belong to the element with the page actions.
                view.setAccessibilityParent(scrollAccessibility)
                if view.superview !== self { addSubview(view) }
            } else if let view = made.removeValue(forKey: index) {
                view.removeFromSuperview()
            }
        }
    }
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
    var chatRows: [Int] = []
    var chatPosition = 0
    weak var searchField: NSSearchField?
    var unblockImmediately = false
    var blocked = false
    var reported = false
    weak var list: ListView?
    var membersHeadingRow = 0
    var coveredRow = 0
    var admins: Set<Int> = []
    var removedMembers: Set<Int> = []
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!

    func record(_ action: String) {
        sequence += 1
        let active = NSWorkspace.shared.frontmostApplication?.processIdentifier == ProcessInfo.processInfo.processIdentifier
        let data = try! JSONSerialization.data(withJSONObject: ["action": action, "active": active, "phase": phase, "request": request, "sequence": sequence, "chatVisible": chatVisible, "chatWindowOpen": chatWindow?.isVisible == true, "selectedChat": selectedChat, "chatFilter": chatFilter, "blocked": blocked, "reported": reported, "admins": admins.sorted(), "removedMembers": removedMembers.sorted(), "listOffset": list?.offset ?? 0, "searchFocused": searchField?.currentEditor() != nil, "mainKey": window.isKeyWindow])
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
        case "group_members":
            if let list { list.scroll(to: list.top(of: membersHeadingRow)) }
        case "group_permissions":
            _ = root("GROUP_PERMISSIONS", heading: permissionsMode == "GROUP_PERMISSIONS_WRONG_PAGE" ? "Advanced chat privacy" : "Group permissions")
        case "info_block": showBlockDialog()
        // As in WhatsApp, Chat › Block toggles on the contact's state whatever its title
        // says: blocked, it unblocks at once; otherwise it opens the block dialog.
        case "block_dynamic":
            if blocked { blocked = false; showMain(); record("unblock_confirmed"); return }
            showBlockDialog(role: "AXSheet")
        case "block_confirmed", "block_report_confirmed":
            blocked = true
            reported = id == "block_report_confirmed"
            if phase == "MAIN" { showMain() } else { showInfo() }
        case "info_unblock":
            if unblockImmediately { blocked = false; showInfo(); record("unblock_confirmed"); return }
            showUnblockDialog()
        case "unblock_confirmed": blocked = false; showInfo()
        case "open_main_window":
            showMain()
            window.makeKeyAndOrderFront(nil)
        case "chats": showMain()
        case "SidebarButton_Archived": showMain("ARCHIVED")
        case "filter_all", "filter_unread", "filter_favourites", "filter_groups":
            // WhatsApp applies a filter about 75 ms after the chip's AXPress returns,
            // selecting the chip and reloading the list together, then posts layout
            // changes. A handler that does not wait acts on the previous list.
            let filter = String(id.dropFirst("filter_".count)).uppercased()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.075) { [weak self] in
                guard let self else { return }
                self.showMain(filter)
                NSAccessibility.post(element: self.window!, notification: .layoutChanged)
                self.record(id)
            }
            return
        case "search_chat":
            // Search Chat toggles the chat's search bar; opening it focuses the field.
            if let field = searchField { field.removeFromSuperview() } else { showSearch() }
        case "info_search":
            // Info's Search closes Info, then focuses the chat's search field once
            // Info has animated away.
            showMain()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
                self?.showSearch()
                self?.record(id)
            }
            return
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
        else if id.hasPrefix("member_") { memberAction(id, member: sender.tag) }
        else { invoke(id) }
    }

    func memberAction(_ id: String, member: Int) {
        switch id {
        case "member_row":
            showMemberOptions(member)
            record("member_options_\(member)")
        case "member_info":
            closeActionSheet()
            record("member_info_\(member)")
        case "member_admin":
            closeActionSheet()
            let dismissed = admins.remove(member) != nil
            if !dismissed { admins.insert(member) }
            record(dismissed ? "member_dismiss_admin_\(member)" : "member_admin_\(member)")
        case "member_remove":
            closeActionSheet()
            record("member_remove_\(member)")
            // WhatsApp closes the options before presenting the confirmation.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
                self?.showActionSheet("Remove Fixture Member \(member) from this group?", [("member_remove_confirmed", "Remove")], member: member, closed: "member_remove_cancelled")
            }
        case "member_remove_confirmed":
            removedMembers.insert(member)
            showGroupInfo()
            record("member_removed_\(member)")
        default: record(id)
        }
    }

    @objc func openChatWindow(_ sender: NSMenuItem) { openChatWindow() }

    func openChatWindow() {
        let chat = NSWindow(contentRect: NSRect(x: 120, y: 120, width: 500, height: 500), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        chat.isReleasedWhenClosed = false
        chat.title = "Fixture Chat"
        // WhatsApp's chat windows have a content root with this identifier.
        group("Chat_Window", frame: NSRect(x: 0, y: 0, width: 500, height: 500), parent: chat.contentView!)
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
                .setAccessibilitySelected(label.uppercased() == filter)
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
        // As in WhatsApp, reloading the list clears the selected row.
        chatRows = rows
        chatPosition = 0
        for (position, index) in rows.enumerated() {
            let frame = NSRect(x: 0, y: 350 - (position + 1) * 26, width: 250, height: 24)
            if index == 12 {
                let text = ClickableText(label: "Fixture Chat 12", frame: frame) { [weak self] in self?.invoke("chat_12") }
                text.setAccessibilityHelp("Double tap to open chat, Double tap and hold for more options")
                list.addSubview(text)
            } else { button("chat_\(index)", "Fixture Chat \(index)", frame: frame, parent: list) }
        }
        // A blocked contact's chat replaces the composer with these buttons.
        if blocked {
            let bar = group("blocked_bar", frame: NSRect(x: 520, y: 20, width: 340, height: 30), parent: view)
            button("blocked_delete_chat", "Delete chat", frame: NSRect(x: 0, y: 0, width: 160, height: 30), parent: bar)
            button("blocked_unblock", "Unblock", frame: NSRect(x: 180, y: 0, width: 160, height: 30), parent: bar)
        }
    }

    // The chat's search bar, opened by Search Chat and by Info's Search.
    func showSearch() {
        if phase != "MAIN" { showMain() }
        // A chat has one search bar; replace one an earlier scenario left open.
        searchField?.removeFromSuperview()
        let field = SearchField(frame: NSRect(x: 520, y: 440, width: 300, height: 24))
        field.placeholderString = "Search"
        field.setAccessibilityLabel("Search")
        window.contentView?.addSubview(field)
        window.makeFirstResponder(field)
        searchField = field
    }

    // WhatsApp's ⌘1–⌘9 select a row of the current filter from its list data, and
    // Next Chat (⇧⌘]) the row after the selected one. Positions past the list do nothing.
    func chatShortcut(_ code: UInt16, _ flags: NSEvent.ModifierFlags) -> Bool {
        let digits: [UInt16: Int] = [0x12: 1, 0x13: 2, 0x14: 3, 0x15: 4, 0x17: 5, 0x16: 6, 0x1A: 7, 0x1C: 8, 0x19: 9]
        guard phase == "MAIN", flags.contains(.command) else { return false }
        if let position = digits[code], !flags.contains(.shift) {
            guard position <= chatRows.count else { return true }
            chatPosition = position
        } else if code == 0x1E, flags.contains(.shift) {
            guard chatPosition > 0, chatPosition < chatRows.count else { return true }
            chatPosition += 1
        } else if code == 0x1F, flags.contains(.option) {
            // Open in new window (⌥⌘O).
            openChatWindow()
            return true
        } else { return false }
        invoke("chat_\(chatRows[chatPosition - 1])")
        return true
    }

    // A table below a translucent navigation bar that covers its top rows.
    func table(_ parent: NSView, frame: NSRect) -> ListView {
        let view = ListView(frame: frame)
        view.setAccessibilityElement(true)
        view.setAccessibilityRole(.group)
        parent.addSubview(view)
        let bar = group("navigation_bar_overlay", frame: NSRect(x: frame.minX, y: frame.maxY - 30, width: frame.width, height: 30), parent: parent)
        bar.setAccessibilityLabel("Navigation bar")
        list = view
        return view
    }

    // Catalyst wraps each table cell's control in a group. ListView sets the
    // row's frame; controls fill the row's height.
    func cell(_ control: @escaping (NSView) -> Void) -> () -> NSView {
        {
            let row = NSView()
            row.setAccessibilityElement(true)
            row.setAccessibilityRole(.group)
            control(row)
            return row
        }
    }

    enum RowButton { case plain, action, member }

    func buttonRow(_ id: String, _ label: String, height: CGFloat = 43, gap: CGFloat = 0, kind: RowButton = .plain, tag: Int = 0) -> ListView.Row {
        ListView.Row(height: height, gap: gap, make: cell { row in
            let action = #selector(Fixture.buttonAction(_:))
            let control: NSButton = switch kind {
            case .plain: NSButton(title: label, target: self, action: action)
            case .action: ActionRowButton(title: label, target: self, action: action)
            case .member: MemberButton(title: label, target: self, action: action)
            }
            control.identifier = NSUserInterfaceItemIdentifier(id)
            control.frame = NSRect(x: 10, y: 0, width: 580, height: height)
            control.tag = tag
            row.addSubview(control)
        })
    }

    func textRow(_ id: String, _ label: String, gap: CGFloat = 0) -> ListView.Row {
        ListView.Row(gap: gap, make: cell { row in
            let text = ClickableText(label: label, frame: NSRect(x: 10, y: 0, width: 580, height: 43)) { self.invoke(id) }
            text.identifier = NSUserInterfaceItemIdentifier(id)
            row.addSubview(text)
        })
    }

    func showSettings() {
        let view = root("SETTINGS")
        let nav = group("settings_navigation", frame: NSRect(x: 0, y: 575, width: 900, height: 40), parent: view)
        button("SettingsView_CloseButton", "Close", frame: NSRect(x: 0, y: 0, width: 80, height: 30), parent: nav)
        let list = table(view, frame: NSRect(x: 20, y: 60, width: 600, height: 300))
        let profile = ListView.Row(height: 50, make: cell { row in
            row.identifier = NSUserInterfaceItemIdentifier("SettingsView_ProfileCell")
            self.button("SettingsView_ProfileCell", "Localized Profile", frame: NSRect(x: 10, y: 0, width: 580, height: 50), parent: row)
        })
        let entries = [("SettingsView_FavoritesCell", "Favourites"), ("SettingsView_StarredMessagesCell", "Starred"), ("settings_history", "Chat history"), ("SettingsView_AccountsCell", "Account"), ("SettingsView_PrivacyCell", "Privacy"), ("SettingsView_ChatsCell", "Chats"), ("SettingsView_AppearanceCell", "Appearance"), ("SettingsView_NotificationsCell", "Notifications"), ("SettingsView_AgentsCell", "Agents"), ("SettingsView_DataAndStorageUsageCell", "Storage and data"), ("SettingsView_HelpCell", "Help and feedback")]
        list.rows = [profile] + entries.map { buttonRow($0.0, $0.1, height: 45) }
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

    // WhatsApp's action sheets are popovers; Chat › Block shows its dialog as a sheet.
    // The title sits alone in nested groups, so its parent holds none of the buttons.
    func showActionSheet(_ title: String, _ buttons: [(String, String)], member: Int = 0, closed: String, role: String = "AXPopover") {
        guard let view = window.contentView else { return }
        closeActionSheet()
        list?.modal = true
        let sheet = DevicePopover(frame: NSRect(x: 250, y: 150, width: 400, height: 300))
        sheet.identifier = NSUserInterfaceItemIdentifier("fixture_action_sheet")
        sheet.setAccessibilityElement(true)
        sheet.setAccessibilityRole(NSAccessibility.Role(rawValue: role))
        sheet.dismiss = { [weak self] in
            self?.closeActionSheet()
            self?.record(closed)
        }
        view.addSubview(sheet)
        let content = group("action_sheet_content", frame: sheet.bounds, parent: sheet)
        let outer = group("action_sheet_title_container", frame: NSRect(x: 0, y: 240, width: 400, height: 60), parent: content)
        let inner = group("action_sheet_title_group", frame: outer.bounds, parent: outer)
        let label = NSTextField(labelWithString: title)
        label.identifier = NSUserInterfaceItemIdentifier("ActionSheet_TitleLabel")
        label.setAccessibilityRole(NSAccessibility.Role(rawValue: "AXHeading"))
        label.frame = inner.bounds
        inner.addSubview(label)
        let actions = group("action_sheet_actions", frame: NSRect(x: 0, y: 0, width: 400, height: 230), parent: content)
        for (index, item) in buttons.enumerated() {
            button(item.0, item.1, frame: NSRect(x: 20, y: 180 - index * 50, width: 360, height: 40), parent: actions).tag = member
        }
    }

    func closeActionSheet() {
        window.contentView?.subviews.filter { $0.identifier?.rawValue == "fixture_action_sheet" }.forEach { $0.removeFromSuperview() }
        list?.modal = false
    }

    func showBlockDialog(role: String = "AXPopover") {
        showActionSheet("Block “Fixture Contact”?", [("block_report_confirmed", "Block and report"), ("block_confirmed", "Block")], closed: "block_cancelled", role: role)
    }

    func showUnblockDialog() {
        showActionSheet("Unblock “Fixture Contact”?", [("unblock_confirmed", "Unblock")], closed: "unblock_cancelled")
    }

    func showMemberOptions(_ member: Int) {
        showActionSheet("Fixture Member \(member)", [("member_info", "Info"), ("member_admin", admins.contains(member) ? "Dismiss as admin" : "Make group admin"), ("member_remove", "Remove from group")], member: member, closed: "member_options_closed")
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

    // The table header stays exposed while scrolled off screen, like WhatsApp's.
    func infoHeader(_ build: @escaping (NSView) -> Void) -> ListView.Row {
        ListView.Row(height: 100, pinned: true) {
            let header = NSView()
            header.identifier = NSUserInterfaceItemIdentifier("contact-info-view-content-stack-view")
            header.setAccessibilityElement(true)
            header.setAccessibilityRole(.group)
            build(header)
            return header
        }
    }

    func showInfo() {
        if groupMode { showGroupInfo(); return }
        let view = root("INFO")
        button("info_close", "close", frame: NSRect(x: 800, y: 580, width: 80, height: 30), parent: view)
        let list = table(view, frame: NSRect(x: 10, y: 60, width: 860, height: 250))
        let downloads = ListView.Row(make: cell { row in
            row.addSubview(ClickableText(label: "Save to Downloads, Default", frame: NSRect(x: 10, y: 0, width: 400, height: 43)) {})
            self.button("info_downloads", "More options", frame: NSRect(x: 420, y: 5, width: 160, height: 33), parent: row)
        })
        func shared(_ id: String, _ label: String) -> ListView.Row {
            ListView.Row(make: cell { row in
                row.identifier = NSUserInterfaceItemIdentifier(id)
                self.button(id, label, frame: NSRect(x: 10, y: 0, width: 580, height: 43), parent: row)
            })
        }
        list.rows = [
            infoHeader { header in
                self.button("contact-info-header-profile-image", "Profile picture", frame: NSRect(x: 0, y: 45, width: 200, height: 25), parent: header)
                for (index, pair) in [("info_audio", "Audio call"), ("info_video", "Video call"), ("info_search", "Search")].enumerated() {
                    self.button(pair.0, pair.1, frame: NSRect(x: index * 230, y: 5, width: 220, height: 30), parent: header)
                }
            },
            textRow("info_gallery", "Media, links and docs, 53"), textRow("info_starred", "Starred, None"),
            buttonRow("mute_dialog", "Mute, No", gap: 18), buttonRow("mute_status", "Mute status notifications, Yes"),
            textRow("info_theme", "Chat theme"), downloads,
            textRow("info_disappearing", "Disappearing messages, Off", gap: 18), buttonRow("info_privacy", "Advanced chat privacy"),
            buttonRow("info_encryption", "Encryption"), buttonRow("info_details", "Contact details", gap: 18),
            buttonRow("info_group_create", "Create group with Fixture Contact", gap: 18),
        ]
        // Far enough from the end to be scrolled under the navigation bar.
        coveredRow = list.rows.count
        list.rows += [
            buttonRow("info_group_add", "Add to group"),
            shared("Share_Contact", "Share contact"), shared("Contact_Info_Favorite_Action", "Add to Favourites"),
            buttonRow("info_export", "Export chat"), buttonRow("info_clear", "Clear chat"),
            buttonRow(blocked ? "info_unblock" : "info_block", blocked ? "Unblock Fixture Contact" : "Block Fixture Contact", gap: 18),
            buttonRow("info_report", "Report Fixture Contact"),
        ]
    }

    func showGroupInfo() {
        let view = root("GROUP_INFO")
        button("info_close", "close", frame: NSRect(x: 10, y: 580, width: 80, height: 30), parent: view)
        button("NavigationBar_GroupInfoQRButton", "Invite via link or QR code", frame: NSRect(x: 600, y: 580, width: 280, height: 30), parent: view)
        let header = infoHeader { header in
            self.button("group_add", "Add", frame: NSRect(x: 10, y: 5, width: 200, height: 30), parent: header)
            let members = self.button("group_members", "\(12 - self.removedMembers.count) members", frame: NSRect(x: 300, y: 45, width: 200, height: 25), parent: header)
            members.setAccessibilityRole(.link)
        }
        if !permissionsMode.isEmpty {
            // Fixed geometry for the inaccessible Group permissions row.
            let list = group("group_info_rows", frame: NSRect(x: 0, y: 0, width: 900, height: 620), parent: view)
            let headerView = header.make()
            headerView.frame = NSRect(x: 10, y: 480, width: 860, height: 100)
            list.addSubview(headerView)
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
        let list = table(view, frame: NSRect(x: 10, y: 60, width: 860, height: 250))
        // The member section spans several pages: its heading row holds a search
        // button, action rows precede the members, and a gap ends the section.
        let membersHeading = ListView.Row(height: 39, gap: 18, make: {
            let row = NSView()
            row.setAccessibilityElement(true)
            row.setAccessibilityRole(NSAccessibility.Role(rawValue: "AXHeading"))
            let text = NSTextField(labelWithString: "\(12 - self.removedMembers.count) members")
            text.frame = NSRect(x: 10, y: 5, width: 300, height: 25)
            row.addSubview(text)
            self.button("group_member_search", "Search", frame: NSRect(x: 520, y: 5, width: 60, height: 28), parent: row)
            return row
        })
        let you = ListView.Row(make: cell { row in
            row.addSubview(ClickableText(label: "You, Admin, Add member tag", frame: NSRect(x: 10, y: 0, width: 580, height: 43)) { self.record("member_you") })
        })
        let members = (2...12).filter { !removedMembers.contains($0) }.map {
            buttonRow("member_row", "Fixture Member \($0)\(admins.contains($0) ? ", Admin" : "")", kind: .member, tag: $0)
        }
        var rows = [
            header,
            buttonRow("group-description-row", "Add group description"),
            textRow("info_gallery", "Media, links and docs, None", gap: 18),
            buttonRow("group_mute", "Mute, No", gap: 18), buttonRow("group_notify", "Notify for, All"),
            textRow("info_theme", "Chat theme"),
            textRow("info_disappearing", "Disappearing messages, Off", gap: 18),
            buttonRow("group_permissions", "Group permissions"),
            buttonRow("group_similar", "Create a similar group, Start with the same members", height: 48, gap: 18),
        ]
        membersHeadingRow = rows.count
        rows += [
            membersHeading,
            buttonRow("group_add_members", "Add members", height: 49, kind: .action),
            buttonRow("group_invite", "Invite via link or QR code", height: 49, kind: .action),
            you,
        ] + members + [
            buttonRow("Group_Info_Member_Changes", "View member changes", height: 45, gap: 18),
            buttonRow("group_exit", "Exit group", gap: 18), buttonRow("group_report", "Report group"),
        ]
        list.rows = rows
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
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            let (code, flags) = (event.keyCode, event.modifierFlags)
            let handled = MainActor.assumeIsolated { self?.chatShortcut(code, flags) ?? false }
            return handled ? nil : event
        }
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
                self.groupMode = mode == "GROUP" || mode == "GROUP_MEMBER_OPTIONS" || !self.permissionsMode.isEmpty
                self.admins = []
                self.removedMembers = []
                self.selectedChat = 0
                // UNBLOCK_CONTACT and BLOCKED show the blocked chat; UNBLOCK_INFO and
                // UNBLOCK_IMMEDIATE show its Info.
                self.blocked = mode.hasPrefix("UNBLOCK") || mode == "BLOCKED"
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
                else if mode == "BLOCK_DIALOG" { self.showInfo(); self.showBlockDialog() }
                else if mode == "UNBLOCK_INFO" || mode == "UNBLOCK_IMMEDIATE" { self.showInfo() }
                else if mode == "GROUP_MEMBER_OPTIONS" { self.showGroupInfo(); self.showMemberOptions(2) }
                else if mode == "SEARCH_UNFOCUSED" {
                    // The chat's search bar is open, but focus moved to the chat's content.
                    self.showSearch()
                    let content = ContentGroup(frame: NSRect(x: 520, y: 200, width: 300, height: 200))
                    self.window.contentView?.addSubview(content)
                    self.window.makeFirstResponder(content)
                    (self.searchField as? SearchField)?.focused = { [weak self] in self?.record("search_focused") }
                }
                else if mode == "INFO_COVERED" {
                    // Add to group sits under the translucent navigation bar.
                    self.showInfo()
                    if let list = self.list { list.scroll(to: list.top(of: self.coveredRow) - 5) }
                }
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

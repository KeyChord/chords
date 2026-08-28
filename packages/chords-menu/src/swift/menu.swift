// Native (Swift) implementation of the macOS menu bar handler.
//
// Behaviour mirrors the query language documented in `readme.md`, talking to the Accessibility
// API directly so a keystroke costs a few AX calls rather than an `osascript` round trip.
//
// This file is compiled into `target/<triple>/native/menu/menu.dylib` (see `@keychord/config`),
// which `src/js/menu.ts` opens with `bun:ffi`. The C ABI it exports:
//
//   const char *chords_menu_run(const char *process_name /* nullable */, const char *action,
//                               const char *value);
//     Runs one menu action. Returns NULL on success, otherwise a heap-allocated error message
//     that the caller releases with `chords_menu_free`.
//   void chords_menu_free(char *message);
//
// Chord calls handlers from its JS worker thread. The Accessibility client API and NSWorkspace
// are usable from any thread, so the work stays on the calling thread — hopping to the main
// thread would deadlock a caller whose main thread is not running a run loop (the `chord` CLI).

import AppKit
import ApplicationServices
import Foundation

public enum MenuError: Error, CustomStringConvertible {
    case invalidAction(String)
    case applicationNotFound(String)
    case noFrontmostApplication
    case accessibility(String)
    case indexOutOfRange(index: Int, count: Int)
    case invalidIndex(String)
    case emptyQuery
    case invalidQuery(String)
    case noTopLevelMatch(prefix: String, occurrence: Int, found: Int)
    case noExpandedMenu(query: String)
    case noExpandedMatch(pattern: String, occurrence: Int, found: Int)

    public var description: String {
        switch self {
        case .invalidAction(let action):
            return "unknown menu action \"\(action)\" (expected \"by-index\" or \"by-letters\")"
        case .applicationNotFound(let name):
            return "application \"\(name)\" is not running and could not be launched"
        case .noFrontmostApplication:
            return "no frontmost application"
        case .accessibility(let label):
            return "Failed at: \(label)"
        case .indexOutOfRange(let index, let count):
            return "menuIndex \(index) out of range; found \(count) menu bar items"
        case .invalidIndex(let value):
            return "invalid menu index \"\(value)\""
        case .emptyQuery:
            return "Expected a non-empty lowercase query"
        case .invalidQuery(let query):
            return "Invalid menu query \"\(query)\". Expected lowercase letters/hyphens with optional trailing number."
        case .noTopLevelMatch(let prefix, let occurrence, let found):
            return "No top-level menu match #\(occurrence) for prefix \"\(prefix)\". Found \(found)."
        case .noExpandedMenu(let query):
            return "Query \"\(query)\" targets expanded menu items, but no top-level menu appears to be expanded."
        case .noExpandedMatch(let pattern, let occurrence, let found):
            return "No expanded menu item match #\(occurrence) for pattern \"\(pattern)\". Found \(found)."
        }
    }
}

// MARK: - C ABI (what `src/js/menu.ts` calls through `bun:ffi`)

/// Runs one menu action. Returns `nil` on success or a `strdup`ed error message the caller frees
/// with `chords_menu_free`. Safe to call from any thread.
@_cdecl("chords_menu_run")
public func chordsMenuRun(
    _ processName: UnsafePointer<CChar>?,
    _ action: UnsafePointer<CChar>?,
    _ value: UnsafePointer<CChar>?
) -> UnsafeMutablePointer<CChar>? {
    let processName = processName.map { String(cString: $0) }.flatMap { $0.isEmpty ? nil : $0 }
    let action = action.map { String(cString: $0) } ?? "by-index"
    let value = value.map { String(cString: $0) } ?? "0"

    return autoreleasepool {
        do {
            try runMenuAction(processName: processName, action: action, value: value)
            return nil
        } catch {
            return strdup(describe(error))
        }
    }
}

@_cdecl("chords_menu_free")
public func chordsMenuFree(_ message: UnsafeMutablePointer<CChar>?) {
    free(message)
}

private func describe(_ error: Error) -> String {
    if let error = error as? MenuError {
        return error.description
    }
    if let localized = error as? LocalizedError, let text = localized.errorDescription {
        return text
    }
    return String(describing: error)
}

// MARK: - Accessibility helpers

private func log(_ message: String) {
    print("[menu] \(message)")
}

private func axValue(_ element: AXUIElement, _ attribute: String) -> AnyObject? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success else {
        return nil
    }
    return value
}

private func axChildren(_ element: AXUIElement, _ attribute: String = kAXChildrenAttribute) -> [AXUIElement] {
    guard let array = axValue(element, attribute) as? [AnyObject] else {
        return []
    }
    return array.compactMap { item in
        // AXUIElement is a CoreFoundation type; check the type id before force-casting.
        CFGetTypeID(item) == AXUIElementGetTypeID() ? (item as! AXUIElement) : nil
    }
}

private func axString(_ element: AXUIElement, _ attribute: String) -> String {
    (axValue(element, attribute) as? String) ?? ""
}

private func axBool(_ element: AXUIElement, _ attribute: String, default defaultValue: Bool) -> Bool {
    (axValue(element, attribute) as? Bool) ?? defaultValue
}

private func axPress(_ element: AXUIElement, label: String) throws {
    let result = AXUIElementPerformAction(element, kAXPressAction as CFString)
    guard result == .success else {
        throw MenuError.accessibility("\(label) (AXPress returned \(result.rawValue))")
    }
}

// MARK: - Query semantics

private let invisibleCharacters: CharacterSet = {
    var set = CharacterSet()
    for scalar in [0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0xFEFF, 0x202A, 0x202B, 0x202C, 0x202D, 0x202E] {
        set.insert(Unicode.Scalar(scalar)!)
    }
    return set
}()

private func normalize(_ value: String) -> String {
    String(value.unicodeScalars.filter { !invisibleCharacters.contains($0) })
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
}

private func name(of element: AXUIElement) -> String {
    normalize(axString(element, kAXTitleAttribute))
}

private func isRepeatedLettersQuery(_ query: String) -> Bool {
    guard let first = query.first, query.allSatisfy({ $0.isASCII && $0.isLowercase && $0.isLetter }) else {
        return false
    }
    return query.allSatisfy { $0 == first }
}

private func parseExpandedItemQuery(_ query: String) throws -> (pattern: String, occurrence: Int) {
    // ^([a-z-]+?)(\d+)?$
    var pattern = Substring(query)
    var digits = Substring("")
    while let last = pattern.last, last.isASCII, last.isNumber {
        digits = Substring(String(last) + digits)
        pattern = pattern.dropLast()
    }
    guard !pattern.isEmpty, pattern.allSatisfy({ ($0.isASCII && $0.isLowercase && $0.isLetter) || $0 == "-" }) else {
        throw MenuError.invalidQuery(query)
    }
    let occurrence = digits.isEmpty ? 1 : Int(digits) ?? 0
    guard occurrence >= 1 else {
        throw MenuError.invalidQuery(query)
    }
    return (String(pattern), occurrence)
}

private func matchesWordAbbreviation(_ name: String, _ pattern: String) -> Bool {
    let words = name.split(whereSeparator: { $0.isWhitespace }).map(String.init)
    let parts = pattern.split(separator: "-").map(String.init)
    if parts.isEmpty || parts.count > words.count {
        return false
    }
    for (index, part) in parts.enumerated() where !words[index].hasPrefix(part) {
        return false
    }
    return true
}

private func matchesExpandedPattern(_ name: String, _ pattern: String) -> Bool {
    pattern.contains("-") ? matchesWordAbbreviation(name, pattern) : name.hasPrefix(pattern)
}

private func isSeparatorLike(_ item: AXUIElement) -> Bool {
    if !name(of: item).isEmpty {
        return false
    }
    return normalize(axString(item, kAXRoleDescriptionAttribute)).contains("separator")
}

private func collectMenuItemsDepthFirst(_ menu: AXUIElement) -> [AXUIElement] {
    var out: [AXUIElement] = []
    func walk(_ menu: AXUIElement) {
        for item in axChildren(menu) {
            if !isSeparatorLike(item) {
                out.append(item)
            }
            if let submenu = axChildren(item).first {
                walk(submenu)
            }
        }
    }
    walk(menu)
    return out
}

private func selectedTopLevelMenu(_ menuBarItems: [AXUIElement]) -> (menuBarItem: AXUIElement, menu: AXUIElement)? {
    for item in menuBarItems where axBool(item, kAXSelectedAttribute, default: false) {
        if let menu = axChildren(item).first {
            return (item, menu)
        }
    }
    return nil
}

// MARK: - Actions

private func clickTopLevelMenu(_ items: [AXUIElement], index: Int) throws {
    guard index >= 0, index < items.count else {
        throw MenuError.indexOutOfRange(index: index, count: items.count)
    }
    let item = items[index]
    log("Clicking top-level menu #\(index): \(axString(item, kAXTitleAttribute))")
    try axPress(item, label: "menuBarItems[\(index)]")
}

private func clickTopLevelMenu(_ items: [AXUIElement], repeatedLetters query: String) throws {
    let prefix = String(query.first!)
    let occurrence = query.count
    let matches = items.filter { name(of: $0).hasPrefix(prefix) }
    log("Top-level repeated-letter query \"\(query)\" -> prefix \"\(prefix)\", occurrence \(occurrence)")
    log("Top-level matches: \(matches.map { axString($0, kAXTitleAttribute) })")
    guard matches.count >= occurrence else {
        throw MenuError.noTopLevelMatch(prefix: prefix, occurrence: occurrence, found: matches.count)
    }
    let item = matches[occurrence - 1]
    log("Clicking top-level menu: \(axString(item, kAXTitleAttribute))")
    try axPress(item, label: "menu bar item \"\(prefix)\" #\(occurrence)")
}

private func clickExpandedMenuItem(_ items: [AXUIElement], query: String) throws {
    guard let selected = selectedTopLevelMenu(items) else {
        throw MenuError.noExpandedMenu(query: query)
    }
    let (pattern, occurrence) = try parseExpandedItemQuery(query)
    log("Expanded menu context: \"\(axString(selected.menuBarItem, kAXTitleAttribute))\"")
    log("Expanded-item query \"\(query)\" -> pattern \"\(pattern)\", occurrence \(occurrence)")

    let candidates = collectMenuItemsDepthFirst(selected.menu).filter { item in
        guard axBool(item, kAXEnabledAttribute, default: true) else {
            return false
        }
        let itemName = name(of: item)
        return !itemName.isEmpty && matchesExpandedPattern(itemName, pattern)
    }
    log("Expanded matches: \(candidates.map { axString($0, kAXTitleAttribute) })")
    guard candidates.count >= occurrence else {
        throw MenuError.noExpandedMatch(pattern: pattern, occurrence: occurrence, found: candidates.count)
    }
    let item = candidates[occurrence - 1]
    log("Clicking expanded menu item: \(axString(item, kAXTitleAttribute))")
    try axPress(item, label: "menu item \"\(pattern)\" #\(occurrence)")
}

/// Sleeps `interval`, pumping the main run loop instead when called on the main thread (so
/// NSWorkspace state keeps updating in a process without an AppKit event loop).
private func waitBriefly(_ interval: TimeInterval) {
    if Thread.isMainThread {
        RunLoop.main.run(until: Date(timeIntervalSinceNow: interval))
    } else {
        Thread.sleep(forTimeInterval: interval)
    }
}

/// Activates `processName` (launching it when needed) and waits briefly for it to become
/// frontmost.
private func activate(processName: String) throws -> NSRunningApplication {
    let workspace = NSWorkspace.shared
    var app = workspace.runningApplications.first { $0.localizedName == processName }
    if app == nil {
        log("Launching app: \(processName)")
        guard let url = workspace.urlForApplication(withBundleIdentifier: processName)
            ?? NSWorkspace.applicationURL(named: processName)
        else {
            throw MenuError.applicationNotFound(processName)
        }
        workspace.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration())
        let deadline = Date(timeIntervalSinceNow: 5)
        while app == nil && Date() < deadline {
            waitBriefly(0.05)
            app = workspace.runningApplications.first { $0.localizedName == processName }
        }
    }
    guard let app else {
        throw MenuError.applicationNotFound(processName)
    }

    log("Activating app: \(processName)")
    app.activate()
    let deadline = Date(timeIntervalSinceNow: 1)
    while !app.isActive && Date() < deadline {
        waitBriefly(0.02)
    }
    return app
}

private extension NSWorkspace {
    /// Resolves an application by display name the way JXA's `Application("Safari")` does:
    /// `.app` bundles in the standard application folders.
    static func applicationURL(named name: String) -> URL? {
        let fileName = name.hasSuffix(".app") ? name : "\(name).app"
        let searchDirectories = FileManager.default.urls(for: .applicationDirectory, in: [.localDomainMask, .userDomainMask, .systemDomainMask])
            + [URL(fileURLWithPath: "/System/Applications"), URL(fileURLWithPath: "/System/Applications/Utilities")]
        for directory in searchDirectories {
            let candidate = directory.appendingPathComponent(fileName)
            if FileManager.default.fileExists(atPath: candidate.path) {
                return candidate
            }
        }
        return nil
    }
}

/// Public entry point so other packages can `import KeychordChordsMenuNativeMenu` and drive the
/// menu bar with the same query language (`by-index` / `by-letters`). Callable from any thread.
public func runMenuAction(processName: String?, action: String, value: String) throws {
    let target: NSRunningApplication
    if let processName {
        target = try activate(processName: processName)
    } else {
        guard let frontmost = NSWorkspace.shared.frontmostApplication else {
            throw MenuError.noFrontmostApplication
        }
        target = frontmost
    }
    log("Frontmost process: \(target.localizedName ?? "<unknown>")")

    let application = AXUIElementCreateApplication(target.processIdentifier)
    guard let menuBarValue = axValue(application, kAXMenuBarAttribute),
          CFGetTypeID(menuBarValue) == AXUIElementGetTypeID()
    else {
        throw MenuError.accessibility("menuBars[0]")
    }
    let menuBar = menuBarValue as! AXUIElement
    let items = axChildren(menuBar)

    switch action {
    case "by-index":
        guard let index = Int(value) else {
            throw MenuError.invalidIndex(value)
        }
        try clickTopLevelMenu(items, index: index)
    case "by-letters":
        let query = normalize(value)
        if query.isEmpty {
            throw MenuError.emptyQuery
        }
        if query.allSatisfy({ $0.isASCII && $0.isNumber }) {
            try clickTopLevelMenu(items, index: Int(query) ?? 0)
        } else if isRepeatedLettersQuery(query) {
            try clickTopLevelMenu(items, repeatedLetters: query)
        } else {
            try clickExpandedMenuItem(items, query: query)
        }
    default:
        throw MenuError.invalidAction(action)
    }
    log("Done")
}

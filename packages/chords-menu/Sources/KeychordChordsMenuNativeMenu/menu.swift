// Native (Swift) implementation of the macOS menu bar handler.
//
// Behaviour mirrors the query language documented in `readme.md`, talking to the Accessibility
// API through AXorcist, in-process without an `osascript` round trip.
//
// `@keychord/config` builds this package's Package.swift into a NodeSwift addon at
// `target/<triple>/menu/menu.node`; `src/js/menu.ts` loads it through Node-API.
//
// NodeSwift returns a Promise to Chord's JS worker. Accessibility work runs on MainActor;
// both the desktop app and the updated Chord CLI service the main run loop.

import AppKit
import AXorcist
import ApplicationServices
import Foundation
import NodeAPI

#NodeModule(exports: [
    "runMenuAction": try NodeFunction {
        (processName: String?, action: String, value: String) async throws in
        try await runMenuAction(processName: processName, action: action, value: value)
    },
])

public enum MenuError: Error, CustomStringConvertible {
    case invalidAction(String)
    case applicationNotFound(String)
    case noFrontmostApplication
    case accessibility(String)
    case indexOutOfRange(index: Int, count: Int)
    case invalidIndex(String)
    case invalidPath(String)
    case pathComponentNotFound(component: String, path: [String], available: [String])
    case pathItemDisabled(component: String, path: [String])
    case emptyQuery
    case invalidQuery(String)
    case noTopLevelMatch(prefix: String, occurrence: Int, found: Int)
    case noExpandedMenu(query: String)
    case noExpandedMatch(pattern: String, occurrence: Int, found: Int)

    public var description: String {
        switch self {
        case .invalidAction(let action):
            return "unknown menu action \"\(action)\" (expected \"by-index\", \"by-letters\", or \"by-path\")"
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
        case .invalidPath(let reason):
            return "Invalid menu path: \(reason)"
        case .pathComponentNotFound(let component, let path, let available):
            let renderedPath = path.joined(separator: " > ")
            return "Menu path \"\(renderedPath)\" has no component \"\(component)\". Available items: \(available)."
        case .pathItemDisabled(let component, let path):
            return "Menu item \"\(component)\" in path \"\(path.joined(separator: " > "))\" is disabled."
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

// MARK: - Accessibility helpers

@MainActor
private func log(_ message: String) {
    print("[menu] \(message)")
}

@MainActor
private func axChildren(_ element: Element) -> [Element] {
    // Preserve AXChildren order exactly: AXorcist's children() also discovers alternative
    // relationships. Menu indices and occurrence queries rely on the original AX hierarchy.
    let children: [AXUIElement] = element.attribute(Attribute<[AXUIElement]>(kAXChildrenAttribute)) ?? []
    return children.map(Element.init)
}

@MainActor
private func axPress(_ element: Element, label: String) throws {
    do {
        try element.performAction(.press)
    } catch let error as AccessibilitySystemError {
        throw MenuError.accessibility("\(label) (AXPress returned \(error.axError.rawValue))")
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

@MainActor
private func cleanTitle(_ value: String) -> String {
    String(value.unicodeScalars.filter { !invisibleCharacters.contains($0) })
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

@MainActor
private func normalize(_ value: String) -> String {
    cleanTitle(value)
        .lowercased()
}

@MainActor
private func title(of element: Element) -> String {
    cleanTitle((element.title() ?? ""))
}

@MainActor
private func name(of element: Element) -> String {
    normalize((element.title() ?? ""))
}

@MainActor
private func isRepeatedLettersQuery(_ query: String) -> Bool {
    guard let first = query.first, query.allSatisfy({ $0.isASCII && $0.isLowercase && $0.isLetter }) else {
        return false
    }
    return query.allSatisfy { $0 == first }
}

@MainActor
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

@MainActor
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

@MainActor
private func matchesExpandedPattern(_ name: String, _ pattern: String) -> Bool {
    pattern.contains("-") ? matchesWordAbbreviation(name, pattern) : name.hasPrefix(pattern)
}

@MainActor
private func isSeparatorLike(_ item: Element) -> Bool {
    if !name(of: item).isEmpty {
        return false
    }
    return normalize((item.roleDescription() ?? "")).contains("separator")
}

@MainActor
private func collectMenuItemsDepthFirst(_ menu: Element) -> [Element] {
    var out: [Element] = []
    func walk(_ menu: Element) {
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

@MainActor
private func selectedTopLevelMenu(_ menuBarItems: [Element]) -> (menuBarItem: Element, menu: Element)? {
    for item in menuBarItems where (item.attribute(Attribute<Bool>(kAXSelectedAttribute)) ?? false) {
        if let menu = axChildren(item).first {
            return (item, menu)
        }
    }
    return nil
}

// MARK: - Actions

@MainActor
private func clickTopLevelMenu(_ items: [Element], index: Int) throws {
    guard index >= 0, index < items.count else {
        throw MenuError.indexOutOfRange(index: index, count: items.count)
    }
    let item = items[index]
    log("Clicking top-level menu #\(index): \((item.title() ?? ""))")
    try axPress(item, label: "menuBarItems[\(index)]")
}

@MainActor
private func clickTopLevelMenu(_ items: [Element], repeatedLetters query: String) throws {
    let prefix = String(query.first!)
    let occurrence = query.count
    // Index zero is the system Apple menu, regardless of its localized AX title.
    // Reserve it for numeric selection; it must not consume a letter occurrence.
    let matches = items.dropFirst().filter { name(of: $0).hasPrefix(prefix) }
    log("Top-level repeated-letter query \"\(query)\" -> prefix \"\(prefix)\", occurrence \(occurrence)")
    log("Top-level matches: \(matches.map { ($0.title() ?? "") })")
    guard matches.count >= occurrence else {
        throw MenuError.noTopLevelMatch(prefix: prefix, occurrence: occurrence, found: matches.count)
    }
    let item = matches[occurrence - 1]
    log("Clicking top-level menu: \((item.title() ?? ""))")
    try axPress(item, label: "menu bar item \"\(prefix)\" #\(occurrence)")
}

@MainActor
private func clickExpandedMenuItem(_ items: [Element], query: String) throws {
    guard let selected = selectedTopLevelMenu(items) else {
        throw MenuError.noExpandedMenu(query: query)
    }
    let (pattern, occurrence) = try parseExpandedItemQuery(query)
    log("Expanded menu context: \"\((selected.menuBarItem.title() ?? ""))\"")
    log("Expanded-item query \"\(query)\" -> pattern \"\(pattern)\", occurrence \(occurrence)")

    let candidates = collectMenuItemsDepthFirst(selected.menu).filter { item in
        guard (item.isEnabled() ?? true) else {
            return false
        }
        let itemName = name(of: item)
        return !itemName.isEmpty && matchesExpandedPattern(itemName, pattern)
    }
    log("Expanded matches: \(candidates.map { ($0.title() ?? "") })")
    guard candidates.count >= occurrence else {
        throw MenuError.noExpandedMatch(pattern: pattern, occurrence: occurrence, found: candidates.count)
    }
    let item = candidates[occurrence - 1]
    log("Clicking expanded menu item: \((item.title() ?? ""))")
    try axPress(item, label: "menu item \"\(pattern)\" #\(occurrence)")
}

@MainActor
private func parseMenuPath(_ value: String) throws -> [String] {
    let path: [String]
    do {
        path = try JSONDecoder().decode([String].self, from: Data(value.utf8))
    } catch {
        throw MenuError.invalidPath("expected a JSON array of strings")
    }
    guard path.count >= 2 else {
        throw MenuError.invalidPath("expected at least a top-level menu and a menu item")
    }
    let cleanedPath = path.map(cleanTitle)
    guard cleanedPath.allSatisfy({ !$0.isEmpty }) else {
        throw MenuError.invalidPath("components must be non-empty strings")
    }
    return cleanedPath
}

@MainActor
private func clickMenuItem(_ menuBarItems: [Element], path: [String]) throws {
    func find(_ component: String, in items: [Element]) throws -> Element {
        guard let item = items.first(where: { title(of: $0) == component }) else {
            let available = items.map(title).filter { !$0.isEmpty }
            throw MenuError.pathComponentNotFound(component: component, path: path, available: available)
        }
        return item
    }

    var item = try find(path[0], in: menuBarItems)
    for component in path.dropFirst() {
        guard let menu = axChildren(item).first else {
            throw MenuError.pathComponentNotFound(component: component, path: path, available: [])
        }
        item = try find(component, in: axChildren(menu))
    }
    guard (item.isEnabled() ?? true) else {
        throw MenuError.pathItemDisabled(component: path.last!, path: path)
    }
    log("Clicking menu path: \(path.joined(separator: " > "))")
    try axPress(item, label: "menu path \"\(path.joined(separator: " > "))\"")
}

/// Activates `processName` (launching it when needed) and waits briefly for it to become
/// frontmost.
@MainActor
private func activate(processName: String) async throws -> NSRunningApplication {
    let workspace = NSWorkspace.shared
    func resolveRunningApplication() -> NSRunningApplication? {
        // Chord passes the bundle identifier captured when it resolved the chord. Prefer an active
        // matching instance, but retain display-name lookup for public callers such as
        // `buildMenuHandler("Safari")`.
        let bundleMatches = NSRunningApplication.runningApplications(withBundleIdentifier: processName)
        return bundleMatches.first(where: \.isActive)
            ?? bundleMatches.first
            ?? workspace.runningApplications.first { $0.localizedName == processName }
    }

    var app = resolveRunningApplication()
    if app == nil {
        log("Launching app: \(processName)")
        guard let url = workspace.urlForApplication(withBundleIdentifier: processName)
            ?? NSWorkspace.applicationURL(named: processName)
        else {
            throw MenuError.applicationNotFound(processName)
        }
        workspace.openApplication(at: url, configuration: NSWorkspace.OpenConfiguration(), completionHandler: nil)
        let deadline = Date(timeIntervalSinceNow: 5)
        while app == nil && Date() < deadline {
            try await Task.sleep(for: .milliseconds(50))
            app = resolveRunningApplication()
        }
    }
    guard let app else {
        throw MenuError.applicationNotFound(processName)
    }

    log("Activating app: \(processName)")
    app.activate()
    let deadline = Date(timeIntervalSinceNow: 1)
    while !app.isActive && Date() < deadline {
        try await Task.sleep(for: .milliseconds(20))
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

/// Drives the menu bar on MainActor; callers on NodeActor await this operation.
@MainActor
public func runMenuAction(processName: String?, action: String, value: String) async throws {
    let target: NSRunningApplication
    if let processName {
        target = try await activate(processName: processName)
    } else {
        guard let frontmost = NSWorkspace.shared.frontmostApplication else {
            throw MenuError.noFrontmostApplication
        }
        target = frontmost
    }
    log("Frontmost process: \(target.localizedName ?? "<unknown>")")

    let application = Element(AXUIElementCreateApplication(target.processIdentifier))
    guard let menuBar = application.menuBar() else {
        throw MenuError.accessibility("menuBars[0]")
    }
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
    case "by-path":
        try clickMenuItem(items, path: try parseMenuPath(value))
    default:
        throw MenuError.invalidAction(action)
    }
    log("Done")
}

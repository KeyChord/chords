import ApplicationServices
import Carbon
import ChordNodeSupport
import NodeAPI

private let keyCodes: [String: Int] = [
    "a": kVK_ANSI_A, "b": kVK_ANSI_B, "c": kVK_ANSI_C, "d": kVK_ANSI_D, "e": kVK_ANSI_E,
    "f": kVK_ANSI_F, "g": kVK_ANSI_G, "h": kVK_ANSI_H, "i": kVK_ANSI_I, "j": kVK_ANSI_J,
    "k": kVK_ANSI_K, "l": kVK_ANSI_L, "m": kVK_ANSI_M, "n": kVK_ANSI_N, "o": kVK_ANSI_O,
    "p": kVK_ANSI_P, "q": kVK_ANSI_Q, "r": kVK_ANSI_R, "s": kVK_ANSI_S, "t": kVK_ANSI_T,
    "u": kVK_ANSI_U, "v": kVK_ANSI_V, "w": kVK_ANSI_W, "x": kVK_ANSI_X, "y": kVK_ANSI_Y,
    "z": kVK_ANSI_Z, "0": kVK_ANSI_0, "1": kVK_ANSI_1, "2": kVK_ANSI_2, "3": kVK_ANSI_3,
    "4": kVK_ANSI_4, "5": kVK_ANSI_5, "6": kVK_ANSI_6, "7": kVK_ANSI_7, "8": kVK_ANSI_8,
    "9": kVK_ANSI_9, "`": kVK_ANSI_Grave, "-": kVK_ANSI_Minus, "=": kVK_ANSI_Equal,
    "[": kVK_ANSI_LeftBracket, "]": kVK_ANSI_RightBracket, "\\": kVK_ANSI_Backslash,
    ";": kVK_ANSI_Semicolon, "'": kVK_ANSI_Quote, ",": kVK_ANSI_Comma, ".": kVK_ANSI_Period,
    "/": kVK_ANSI_Slash,
]
private let modifierFlags: [String: CGEventFlags] = [
    "alt": .maskAlternate, "ctrl": .maskControl, "fn": .maskSecondaryFn,
    "cmd": .maskCommand, "shift": .maskShift,
]

private struct ShortcutError: Error, CustomStringConvertible {
    let description: String
}

@MainActor
private func tapWithFunctionKey(_ shortcut: String) throws {
    let parts = shortcut.components(separatedBy: "+")
    guard let key = parts.last.flatMap({ keyCodes[$0] }),
          parts.dropLast().contains("fn"),
          parts.dropLast().allSatisfy({ modifierFlags[$0] != nil }) else {
        throw ShortcutError(description: "Invalid Fn shortcut")
    }
    guard AXIsProcessTrusted() else {
        throw ShortcutError(description: "Grant Chord Accessibility access to send Fn shortcuts")
    }
    guard let source = CGEventSource(stateID: .privateState),
          let down = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(key), keyDown: true),
          let up = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(key), keyDown: false) else {
        throw ShortcutError(description: "Could not create the Fn shortcut")
    }
    // Fn is a flag on both key events. Posting a separate synthetic Fn press does not set it.
    let flags = parts.dropLast().reduce(into: CGEventFlags()) { result, modifier in
        if let flag = modifierFlags[modifier] { result.insert(flag) }
    }
    for event in [down, up] {
        event.flags = flags
        event.post(tap: .cgSessionEventTap)
    }
}

#NodeModule(exports: [
    "tapWithFunctionKey": try NodeFunction { (shortcut: String) throws -> NodePromise in
        try mainActorPromise { try tapWithFunctionKey(shortcut) }
    },
])

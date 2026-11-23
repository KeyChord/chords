import AppKit
import ApplicationServices
import IOKit.hidsystem

@MainActor
func pressMediaKey(_ action: String) throws {
    let key: Int32
    switch action {
    case "BRIGHTNESS_UP": key = NX_KEYTYPE_BRIGHTNESS_UP
    case "BRIGHTNESS_DOWN": key = NX_KEYTYPE_BRIGHTNESS_DOWN
    case "VOLUME_UP": key = NX_KEYTYPE_SOUND_UP
    case "VOLUME_DOWN": key = NX_KEYTYPE_SOUND_DOWN
    case "VOLUME_MUTE": key = NX_KEYTYPE_MUTE
    default: throw MenuError.invalidAction(action)
    }
    guard AXIsProcessTrusted() else { throw MenuError.accessibility("sending a media key") }
    // The system consumes auxiliary key events rather than ordinary virtual key codes.
    let events = try [NX_KEYDOWN, NX_KEYUP].map { state -> CGEvent in
        let data = (Int(key) << 16) | (Int(state) << 8)
        guard let event = NSEvent.otherEvent(with: .systemDefined, location: .zero,
                                             modifierFlags: [], timestamp: 0, windowNumber: 0,
                                             context: nil, subtype: Int16(NX_SUBTYPE_AUX_CONTROL_BUTTONS),
                                             data1: data, data2: -1)?.cgEvent else {
            throw MenuError.accessibility("creating a media key event")
        }
        return event
    }
    for event in events { event.post(tap: .cghidEventTap) }
}

import AppKit
import ApplicationServices

@MainActor
final class MediaKeyFixture: NSObject, NSApplicationDelegate {
    let output = ProcessInfo.processInfo.environment["CHORD_FIXTURE_OUTPUT"]!
    var tap: CFMachPort?
    var keys: [Int] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        let eventMask = CGEventMask(1) << 14 // NSEvent.EventType.systemDefined
        tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap,
                                options: .listenOnly, eventsOfInterest: eventMask,
                                callback: { _, _, event, context in
            guard let context, let input = NSEvent(cgEvent: event), input.type == .systemDefined,
                  input.subtype.rawValue == 8, (input.data1 >> 8) & 0xff == 0x0a else {
                return Unmanaged.passUnretained(event)
            }
            let key = (input.data1 >> 16) & 0xffff
            MainActor.assumeIsolated {
                let recorder = Unmanaged<MediaKeyFixture>.fromOpaque(context).takeUnretainedValue()
                recorder.keys.append(key)
                recorder.snapshot()
            }
            return Unmanaged.passUnretained(event)
        }, userInfo: Unmanaged.passUnretained(self).toOpaque())
        guard let tap, let source = CFMachPortCreateRunLoopSource(nil, tap, 0) else {
            FileHandle.standardError.write(Data("Could not observe virtual macOS media keys\n".utf8))
            exit(1)
        }
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
        snapshot()
        try! String(ProcessInfo.processInfo.processIdentifier).write(toFile: output + ".pid", atomically: true, encoding: .utf8)
    }

    func snapshot() {
        try! JSONSerialization.data(withJSONObject: keys).write(to: URL(fileURLWithPath: output), options: .atomic)
    }
}

@main struct Main {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = MediaKeyFixture()
        app.setActivationPolicy(.accessory)
        app.delegate = delegate
        withExtendedLifetime(delegate) { app.run() }
    }
}

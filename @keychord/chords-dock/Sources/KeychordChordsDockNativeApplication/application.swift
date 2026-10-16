import AppKit
import ChordNodeSupport
import NodeAPI

#NodeModule(exports: [
    "cycleApplication": try NodeFunction { (bundleId: String?, direction: String) throws -> NodePromise in
        try mainActorPromise { try await ApplicationCycle.shared.cycle(bundleId: bundleId, direction: direction) }
    },
])

private struct ApplicationError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}

@MainActor
private final class ApplicationCycle: NSObject {
    static let shared = ApplicationCycle()
    private var recent: [pid_t] = []
    private var order: [pid_t] = []
    private var expectedApplication: pid_t?

    override init() {
        super.init()
        // AppKit exposes no system switcher order. Seed from window stacking,
        // including other Spaces, then track real activation history ourselves.
        let windows = CGWindowListCopyWindowInfo(.excludeDesktopElements, kCGNullWindowID) as? [[String: Any]] ?? []
        for window in windows {
            if window[kCGWindowLayer as String] as? Int == 0,
               let pid = window[kCGWindowOwnerPID as String] as? pid_t, !recent.contains(pid) {
                recent.append(pid)
            }
        }
        NSWorkspace.shared.notificationCenter.addObserver(
            self, selector: #selector(activated(_:)), name: NSWorkspace.didActivateApplicationNotification, object: nil
        )
    }

    @objc private func activated(_ notification: Notification) {
        guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
              app.activationPolicy == .regular else { return }
        let pid = app.processIdentifier
        recent.removeAll { $0 == pid }
        recent.insert(pid, at: 0)
        // Keep our ring during chord-driven switches; an ordinary app switch
        // starts a fresh cycle in the updated most-recently-used order.
        if pid != expectedApplication { order = [] }
    }

    func cycle(bundleId: String?, direction: String) async throws {
        guard direction == "NEXT" || direction == "PREVIOUS" else { throw ApplicationError("Unknown application cycle direction") }
        let applications = NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular && !$0.isTerminated }
        let current: NSRunningApplication?
        if let bundleId {
            current = applications.first { $0.bundleIdentifier == bundleId }
        } else {
            current = NSWorkspace.shared.frontmostApplication
        }
        guard let current, applications.contains(where: { $0.processIdentifier == current.processIdentifier }) else {
            throw ApplicationError("The target application is not running or cannot be switched to")
        }
        let running = Set(applications.map(\.processIdentifier))
        recent.removeAll { !running.contains($0) }
        recent.append(contentsOf: applications.map(\.processIdentifier).filter { !recent.contains($0) })
        if current.processIdentifier != expectedApplication { order = [] }
        if order.isEmpty {
            order = [current.processIdentifier] + recent.filter { $0 != current.processIdentifier }
        }
        order.removeAll { !running.contains($0) }
        order.append(contentsOf: recent.filter { !order.contains($0) })
        guard order.count > 1, let index = order.firstIndex(of: current.processIdentifier) else { return }
        let offset = direction == "NEXT" ? 1 : -1
        let pid = order[(index + offset + order.count) % order.count]
        guard let target = applications.first(where: { $0.processIdentifier == pid }) else { return }
        expectedApplication = pid
        do {
            guard target.activate(options: []) else { throw ApplicationError("Could not activate the target application") }
            let deadline = ContinuousClock.now + .seconds(2)
            repeat {
                if NSWorkspace.shared.frontmostApplication?.processIdentifier == pid { return }
                try await Task.sleep(for: .milliseconds(20))
            } while ContinuousClock.now < deadline
            throw ApplicationError("The target application did not receive focus")
        } catch {
            expectedApplication = nil
            order = []
            throw error
        }
    }
}

import Foundation
import NodeAPI

/// Capture the originating JS queue before leaving its synchronous entrypoint.
/// NodeSwift's async NodeActor executor can lose its task-local queue when
/// resuming from MainActor; with multiple addons its global fallback is disabled.
/// Completion uses a synchronous queue callback, so no Swift job has to hop
/// back onto NodeActor. The handle keeps the JS loop alive until completion.
@NodeActor
func mainActorPromise(_ operation: @escaping @MainActor @Sendable () async throws -> String) throws -> NodePromise {
    let deferred = try NodePromise.Deferred()
    let queue = try NodeAsyncQueue(label: "chord.main-actor-action").handle()
    Task { @MainActor in
        let result: Result<String, Error>
        do {
            result = .success(try await operation())
        } catch {
            result = .failure(error)
        }
        do {
            try queue.queue.run { [queue] in
                _ = queue
                switch result {
                case .success(let value): try deferred(.success(value))
                case .failure(let error): try deferred(.failure(error) as Result<Void, Error>)
                }
            }
        } catch {
            // Queue teardown means JS can no longer receive a result. Never
            // convert shutdown into a process-wide fatal error.
            NSLog("Chord native completion queue unavailable: %@", String(describing: error))
        }
    }
    return deferred.promise
}

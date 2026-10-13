import Foundation
import NodeAPI

/// Capture the JS queue before leaving the synchronous addon entrypoint.
/// NodeSwift's async actor loses its task-local queue when returning from
/// MainActor with multiple addon environments. Complete the promise through
/// the captured queue instead of scheduling another Swift NodeActor job.
@NodeActor
func mainActorPromise(_ operation: @escaping @MainActor @Sendable () throws -> String?) throws -> NodePromise {
    let deferred = try NodePromise.Deferred()
    let queue = try NodeAsyncQueue(label: "chord.mirroring-geometry").handle()
    Task { @MainActor in
        let result: Result<String?, Error>
        do {
            result = .success(try operation())
        } catch {
            result = .failure(error)
        }
        do {
            try queue.queue.run { [queue] in
                _ = queue
                switch result {
                case .success(let value):
                    if let value {
                        try deferred(.success(value))
                    } else {
                        try deferred(.success(try NodeUndefined()))
                    }
                case .failure(let error):
                    try deferred(.failure(error) as Result<Void, Error>)
                }
            }
        } catch {
            // During teardown JS cannot receive another result. Never turn
            // queue shutdown into a process-wide fatal error.
            NSLog("Chord Mirroring completion queue unavailable: %@", String(describing: error))
        }
    }
    return deferred.promise
}

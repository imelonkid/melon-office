import Foundation

/// Recover a visible renderer that stopped producing frames, once until it makes progress again.
struct FrameRecovery {
    private var attemptedFrame: TimeInterval?
    private var visibleSince: TimeInterval?

    mutating func shouldRecover(lastFrame: TimeInterval, now: TimeInterval, visible: Bool) -> Bool {
        guard visible else {
            visibleSince = nil
            return false
        }
        if visibleSince == nil { visibleSince = now }
        // Time spent hidden is not evidence of a stalled renderer. Give restoration the same
        // two-second allowance as a missing frame while already visible.
        guard now - max(lastFrame, visibleSince!) > 2, attemptedFrame != lastFrame else { return false }
        attemptedFrame = lastFrame
        return true
    }
}

import Foundation

/// Recover a visible renderer that stopped producing frames, once until it makes progress again.
struct FrameRecovery {
    private var attemptedFrame: TimeInterval?

    mutating func shouldRecover(lastFrame: TimeInterval, now: TimeInterval, visible: Bool) -> Bool {
        guard visible, now - lastFrame > 2, attemptedFrame != lastFrame else { return false }
        attemptedFrame = lastFrame
        return true
    }
}

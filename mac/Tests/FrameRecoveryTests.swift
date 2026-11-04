import Foundation

@main
enum FrameRecoveryTests {
    static func main() {
        var recovery = FrameRecovery()
        precondition(!recovery.shouldRecover(lastFrame: 10, now: 11, visible: true), "healthy animation must not be reset")
        precondition(!recovery.shouldRecover(lastFrame: 10, now: 20, visible: false), "hidden windows may stop rendering")
        precondition(recovery.shouldRecover(lastFrame: 10, now: 20, visible: true), "visible stalled scene should recover")
        precondition(!recovery.shouldRecover(lastFrame: 10, now: 30, visible: true), "a failed recovery must not loop")
        precondition(!recovery.shouldRecover(lastFrame: 31, now: 32, visible: true), "rendering may resume normally")
        precondition(recovery.shouldRecover(lastFrame: 31, now: 40, visible: true), "a later stall after real progress can recover")
        print("Frame recovery: healthy, hidden, stalled, bounded retry and resumed-frame checks passed")
    }
}

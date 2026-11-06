import Foundation

@main
enum FrameRecoveryTests {
    static func main() {
        var recovery = FrameRecovery()
        precondition(!recovery.shouldRecover(lastFrame: 0, now: 10, visible: true), "first visibility must allow time for the first frame")
        precondition(!recovery.shouldRecover(lastFrame: 10, now: 11, visible: true), "healthy animation must not be reset")
        precondition(!recovery.shouldRecover(lastFrame: 10, now: 20, visible: false), "hidden windows may stop rendering")
        precondition(!recovery.shouldRecover(lastFrame: 10, now: 20, visible: true), "hidden time must not count as a visible stall")
        precondition(!recovery.shouldRecover(lastFrame: 10, now: 20.1, visible: true), "restoration must not replace the renderer after only 100ms")
        precondition(!recovery.shouldRecover(lastFrame: 10, now: 22, visible: true), "allow two full seconds for restoration")
        precondition(recovery.shouldRecover(lastFrame: 10, now: 22.1, visible: true), "a persistent visible stall should recover")
        precondition(!recovery.shouldRecover(lastFrame: 10, now: 30, visible: true), "a failed recovery must not loop")
        precondition(!recovery.shouldRecover(lastFrame: 10, now: 30.1, visible: false), "hide after failed recovery")
        precondition(!recovery.shouldRecover(lastFrame: 10, now: 30.2, visible: true), "show after failed recovery")
        precondition(!recovery.shouldRecover(lastFrame: 10, now: 33, visible: true), "visibility changes alone must not reset the retry limit")
        precondition(!recovery.shouldRecover(lastFrame: 34, now: 35, visible: true), "rendering may resume normally")
        precondition(recovery.shouldRecover(lastFrame: 34, now: 40, visible: true), "a later stall after real progress can recover")
        print("Frame recovery: healthy, hidden, stalled, bounded retry and resumed-frame checks passed")
    }
}

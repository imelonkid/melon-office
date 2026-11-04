import AppKit
import SpriteKit

/// Keep the scene while replacing a SpriteKit view whose render loop stopped after window restoration.
final class OfficeRenderView: NSView {
    let scene: OfficeScene
    private(set) var renderer: SKView
    private var recovery = FrameRecovery()
    private var visibilityObserver: NSObjectProtocol?

    init(scene: OfficeScene) {
        self.scene = scene
        renderer = SKView()
        super.init(frame: .zero)
        attachRenderer()
    }

    required init?(coder: NSCoder) { fatalError() }

    private func attachRenderer() {
        renderer.frame = bounds
        renderer.autoresizingMask = [.width, .height]
        renderer.allowsTransparency = true
        renderer.ignoresSiblingOrder = true
        renderer.preferredFramesPerSecond = 30
        addSubview(renderer)
        renderer.presentScene(scene)
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if let visibilityObserver { NotificationCenter.default.removeObserver(visibilityObserver) }
        visibilityObserver = window.map { window in
            NotificationCenter.default.addObserver(forName: NSWindow.didChangeOcclusionStateNotification, object: window, queue: .main) { [weak self] _ in
                // Let SpriteKit resume on its own first; check after a few normal render intervals.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in self?.recoverIfStalled() }
            }
        }
    }

    deinit {
        if let visibilityObserver { NotificationCenter.default.removeObserver(visibilityObserver) }
    }

    func recoverIfStalled() {
        let visible = window?.occlusionState.contains(.visible) == true && !isHiddenOrHasHiddenAncestor
        guard recovery.shouldRecover(lastFrame: scene.lastFrameTime, now: CACurrentMediaTime(), visible: visible) else { return }
        renderer.presentScene(nil)
        renderer.removeFromSuperview()
        renderer = SKView()
        scene.isPaused = false
        attachRenderer()
    }
}

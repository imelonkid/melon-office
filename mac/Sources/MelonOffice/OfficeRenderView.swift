import AppKit
import SpriteKit

/// Keep the scene while replacing a SpriteKit view whose render loop stopped after window restoration.
final class OfficeRenderView: NSView {
    let scene: OfficeScene
    private(set) var renderer: SKView
    private var recovery = FrameRecovery()
    private var visibilityObserver: NSObjectProtocol?
    private var recoveryTimer: Timer?
    private let restorationImage = NSImageView()
    private var wasVisible = false
    private var awaitingFrameAfter: TimeInterval?

    init(scene: OfficeScene) {
        self.scene = scene
        renderer = SKView()
        super.init(frame: .zero)
        attachRenderer()
        restorationImage.frame = bounds
        restorationImage.autoresizingMask = [.width, .height]
        restorationImage.imageScaling = .scaleProportionallyUpOrDown
        restorationImage.isHidden = true
        addSubview(restorationImage)
    }

    required init?(coder: NSCoder) { fatalError() }

    private func attachRenderer() {
        renderer.frame = bounds
        renderer.autoresizingMask = [.width, .height]
        renderer.allowsTransparency = true
        renderer.ignoresSiblingOrder = true
        renderer.preferredFramesPerSecond = 30
        addSubview(renderer, positioned: .below, relativeTo: nil)
        renderer.presentScene(scene)
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if let visibilityObserver { NotificationCenter.default.removeObserver(visibilityObserver) }
        visibilityObserver = window.map { window in
            NotificationCenter.default.addObserver(forName: NSWindow.didChangeOcclusionStateNotification, object: window, queue: .main) { [weak self] _ in
                self?.updateVisibility()
            }
        }
        updateVisibility()
    }

    deinit {
        if let visibilityObserver { NotificationCenter.default.removeObserver(visibilityObserver) }
        recoveryTimer?.invalidate()
    }

    private func updateVisibility() {
        let visible = window?.occlusionState.contains(.visible) == true
        if wasVisible && !visible {
            // Render the retained scene into a still image before its drawable is discarded.
            if let texture = renderer.texture(from: scene, crop: CGRect(origin: .zero, size: scene.size)) {
                restorationImage.image = NSImage(cgImage: texture.cgImage(), size: scene.size)
                restorationImage.isHidden = false
            }
        } else if !wasVisible && visible {
            awaitingFrameAfter = scene.lastFrameTime
        }
        wasVisible = visible
        recoverIfStalled()
        recoveryTimer?.invalidate()
        recoveryTimer = nil
        guard visible else { return }
        // Keep checking even when the store is unchanged; a single early check can miss a stall.
        let timer = Timer(timeInterval: 0.25, repeats: true) { [weak self] _ in self?.recoverIfStalled() }
        RunLoop.main.add(timer, forMode: .common)
        recoveryTimer = timer
    }

    func recoverIfStalled() {
        let visible = window?.occlusionState.contains(.visible) == true && !isHiddenOrHasHiddenAncestor
        if visible, let awaitingFrameAfter, scene.lastFrameTime > awaitingFrameAfter {
            restorationImage.isHidden = true
            self.awaitingFrameAfter = nil
        }
        guard recovery.shouldRecover(lastFrame: scene.lastFrameTime, now: CACurrentMediaTime(), visible: visible) else { return }
        renderer.presentScene(nil)
        renderer.removeFromSuperview()
        renderer = SKView()
        scene.isPaused = false
        attachRenderer()
    }
}

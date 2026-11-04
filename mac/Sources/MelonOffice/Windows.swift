import AppKit
import SpriteKit
import SwiftUI

/// The full office: scene + OA panel.
final class OfficeWindow: NSWindowController {
    convenience init(store: OfficeStore) {
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1360, height: 880),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                              backing: .buffered, defer: false)
        window.title = "Melon Office"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.backgroundColor = NSColor(hex: 0x0C0C0F)
        window.minSize = NSSize(width: 900, height: 560)
        window.isReleasedWhenClosed = false
        window.contentView = NSHostingView(rootView: OfficeView(store: store, scene: OfficeScene(store: store, widget: false)))
        window.center()
        window.setFrameAutosaveName("office")
        self.init(window: window)
    }

    func show() {
        NSApp.activate(ignoringOtherApps: true)
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
    }
}

/// A small always-on-top office in the corner of the screen, like a desk pet: just the scene, no panel.
/// Clicks land on the office only where there is office (floor, walls, bubbles); the empty corners let
/// clicks through to whatever is underneath.
final class WidgetWindow: NSWindowController {
    static let sizes: [(String, CGFloat)] = [("小", 360), ("中", 520), ("大", 720)]
    private var poll: Timer?
    private var skView: OfficeRenderView!
    private var scene: OfficeScene!

    convenience init(store: OfficeStore, width: CGFloat) {
        let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: width, height: width * Assets.shared.size.height / Assets.shared.size.width),
                            styleMask: [.borderless, .nonactivatingPanel],
                            backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.isReleasedWhenClosed = false
        panel.isMovableByWindowBackground = true // drag the office around by its floor

        let scene = OfficeScene(store: store, widget: true)
        let view = OfficeRenderView(scene: scene)
        panel.contentView = view
        if !panel.setFrameUsingName("widget"), let screen = NSScreen.main?.visibleFrame {
            panel.setFrameOrigin(NSPoint(x: screen.maxX - panel.frame.width - 20, y: screen.minY + 20))
        }
        panel.setFrameAutosaveName("widget")
        self.init(window: panel)
        self.skView = view
        self.scene = scene
    }

    var isVisible: Bool { window?.isVisible == true }

    func show() {
        window?.orderFrontRegardless()
        poll?.invalidate()
        poll = Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { [weak self] _ in self?.updateClickThrough() }
    }

    func hide() {
        poll?.invalidate()
        poll = nil
        window?.orderOut(nil)
    }

    func resize(width: CGFloat) {
        guard let w = window else { return }
        let h = width * Assets.shared.size.height / Assets.shared.size.width
        var f = w.frame
        f.origin.y += f.height - h // keep the top edge where it is
        f.size = NSSize(width: width, height: h)
        w.setFrame(f, display: true)
    }

    private func updateClickThrough() {
        guard let w = window else { return }
        skView.recoverIfStalled()
        let mouse = NSEvent.mouseLocation
        guard w.frame.contains(mouse) else { return }
        let renderer = skView.renderer
        let inView = renderer.convert(w.convertPoint(fromScreen: mouse), from: nil)
        let solid = scene.isSolid(at: renderer.convert(inView, to: scene))
        if w.ignoresMouseEvents == solid { w.ignoresMouseEvents = !solid }
    }
}

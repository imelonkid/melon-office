import AppKit
import SpriteKit

/// Opt-in WindowServer regression. Uses an empty store, no server or real hooks.
@main
enum RenderLifecycleTests {
    static func wait(_ seconds: TimeInterval) {
        let deadline = Date().addingTimeInterval(seconds)
        while Date() < deadline {
            if let event = NSApp.nextEvent(matching: .any, until: Date().addingTimeInterval(0.01), inMode: .default, dequeue: true) {
                NSApp.sendEvent(event)
            }
            NSApp.updateWindows()
        }
    }

    static func renderView(in view: NSView) -> OfficeRenderView? {
        if let renderer = view as? OfficeRenderView { return renderer }
        return view.subviews.lazy.compactMap { renderView(in: $0) }.first
    }

    static func verify(_ view: OfficeRenderView, hide: () -> Void, show: () -> Void) {
        wait(1)
        let scene = view.scene
        precondition(CACurrentMediaTime() - scene.lastFrameTime < 0.5, "initial scene must produce frames")
        for _ in 0..<3 {
            let renderer = view.renderer
            hide()
            wait(2.5)
            show()
            wait(0.15)
            precondition(view.renderer === renderer, "restoring must keep the renderer during its grace period")
            wait(2.5)
            print("restored: visible=\(view.window?.occlusionState.contains(.visible) == true), frameAge=\(CACurrentMediaTime() - scene.lastFrameTime), recovered=\(view.renderer !== renderer)")
            precondition(CACurrentMediaTime() - scene.lastFrameTime < 0.5, "restored scene must keep producing frames")
        }

        // Reproduce a renderer that cannot resume. No store updates should be needed to recover.
        let stalled = view.renderer
        stalled.isPaused = true
        hide()
        wait(2.5)
        show()
        wait(0.15)
        precondition(view.renderer === stalled, "hidden time must not trigger immediate replacement")
        let placeholder = view.subviews.compactMap { $0 as? NSImageView }.first!
        precondition(placeholder.image != nil && !placeholder.isHidden, "a still image must cover the stalled renderer on restoration")
        if let directory = ProcessInfo.processInfo.environment["MELON_RENDER_TEST_CAPTURE_DIR"] {
            let capture = Process()
            capture.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
            let name = view.window is NSPanel ? "widget" : "main"
            capture.arguments = ["-x", "-l", String(view.window!.windowNumber), "\(directory)/\(name)-restoring.png"]
            try! capture.run()
            capture.waitUntilExit()
            precondition(capture.terminationStatus == 0, "window screenshot must succeed")
        }
        wait(2.5)
        precondition(view.renderer !== stalled, "persistent visible stall must replace the renderer without a store update")
        precondition(view.scene === scene, "recovery must retain the original scene")
        precondition(CACurrentMediaTime() - scene.lastFrameTime < 0.5, "replacement must produce frames")
        precondition(view.renderer.texture(from: scene) != nil, "recovered scene must render a texture")
        precondition(placeholder.isHidden, "live rendering must replace the still image after frames resume")
    }

    static func main() {
        let app = NSApplication.shared
        setbuf(stdout, nil)
        app.setActivationPolicy(.accessory)
        app.finishLaunching()
        let store = OfficeStore()
        let office = OfficeWindow(store: store)
        office.show()
        wait(1)
        let window = office.window!
        let view = renderView(in: window.contentView!)!
        verify(view, hide: { window.close() }, show: { office.show() })
        print("Main window: repeated close/reopen and stalled renderer recovery passed")
        window.miniaturize(nil)
        wait(2.5)
        let renderer = view.renderer
        window.deminiaturize(nil)
        office.show()
        wait(3)
        precondition(view.renderer === renderer, "minimize/restore must retain a healthy renderer")
        precondition(CACurrentMediaTime() - view.scene.lastFrameTime < 0.5)
        window.close()
        print("Main window: minimize/restore passed")

        let widget = WidgetWindow(store: store, width: 360)
        widget.show()
        verify(widget.window!.contentView as! OfficeRenderView, hide: { widget.hide() }, show: { widget.show() })
        widget.hide()
        print("Widget: repeated hide/show and stalled renderer recovery passed")
    }
}

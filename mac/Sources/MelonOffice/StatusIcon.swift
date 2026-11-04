import AppKit

/// Monochrome template artwork: macOS supplies the tint for light/dark menu bars.
enum StatusIcon: CaseIterable {
    case idle, working, attention

    var image: NSImage {
        let image = NSImage(size: NSSize(width: 20, height: 18), flipped: false) { _ in
            NSColor.black.setFill()
            let frame = NSBezierPath(roundedRect: NSRect(x: 1, y: 4, width: 18, height: 13), xRadius: 3.5, yRadius: 3.5)
            frame.append(NSBezierPath(roundedRect: NSRect(x: 3, y: 6, width: 14, height: 9), xRadius: 1.5, yRadius: 1.5))
            frame.windingRule = .evenOdd
            frame.fill()
            NSBezierPath(rect: NSRect(x: 9, y: 2, width: 2, height: 3)).fill()
            NSBezierPath(roundedRect: NSRect(x: 6, y: 1, width: 8, height: 2), xRadius: 1, yRadius: 1).fill()
            switch self {
            case .idle:
                NSBezierPath(roundedRect: NSRect(x: 7, y: 9.5, width: 6, height: 2), xRadius: 1, yRadius: 1).fill()
            case .working:
                for x: CGFloat in [6, 12] {
                    NSBezierPath(ovalIn: NSRect(x: x, y: 9, width: 2.5, height: 2.5)).fill()
                }
            case .attention:
                NSBezierPath(roundedRect: NSRect(x: 9, y: 10, width: 2, height: 4), xRadius: 1, yRadius: 1).fill()
                NSBezierPath(ovalIn: NSRect(x: 9, y: 7, width: 2, height: 2)).fill()
            }
            return true
        }
        image.isTemplate = true
        return image
    }
}

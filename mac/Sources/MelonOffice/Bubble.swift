import AppKit
import SpriteKit

/// Speech bubble over an employee or the boss, ported from the Bubble class in web/src/scene.ts.
/// Drawn into one texture with AppKit text (crisp, wraps like the web version) and only redrawn when its
/// content changes. The tail tip sits at the node's origin.
final class Bubble: SKNode {
    enum Variant { case say, term, ask, angry }

    struct Button { let rect: CGRect; let id: String; let behavior: String }

    private let sprite = SKSpriteNode()
    private var sig = ""
    private(set) var bw: CGFloat = 0 // box size, used to keep bubbles from covering each other
    private(set) var bh: CGFloat = 0
    private(set) var buttons: [Button] = []
    /// position in page coordinates (top-left origin), set every frame by the scene, then unstacked
    var px: CGFloat = 0
    var py: CGFloat = 0

    override init() {
        super.init()
        zPosition = 1000
        addChild(sprite)
    }

    required init?(coder: NSCoder) { fatalError() }

    static let chip: [String: (NSColor, NSColor)] = [
        "gua": (NSColor(hex: 0xDDF3D8), NSColor(hex: 0x2F6B2A)), "tian": (NSColor(hex: 0xDDF0FB), NSColor(hex: 0x22628C)),
        "zi": (NSColor(hex: 0xF1E2FA), NSColor(hex: 0x6B3A8C)), "agua": (NSColor(hex: 0xFFE3C4), NSColor(hex: 0x8A4B12)),
        "pi": (NSColor(hex: 0xECEAF3), NSColor(hex: 0x4A4560)), "boss": (NSColor(hex: 0xFFF0C7), NSColor(hex: 0x7A5A10)),
        "g1": (NSColor(hex: 0xD6F1EE), NSColor(hex: 0x1F6A62)), "g2": (NSColor(hex: 0xFCE1EA), NSColor(hex: 0x8C2F52)),
        "g3": (NSColor(hex: 0xFFF0C7), NSColor(hex: 0x7A5A10)), "g4": (NSColor(hex: 0xE3E8F7), NSColor(hex: 0x3A4A80)),
    ]

    func show(name: String, cast: String, text: String, variant: Variant, pending: Pending? = nil, ask: String = "", raw: String = "") {
        let newSig = [name, text, "\(variant)", pending?.id ?? "", "\(pending?.holding ?? false)", raw, ask].joined(separator: "\u{1}")
        if newSig == sig { return }
        sig = newSig
        render(name: name, cast: cast, text: text, variant: variant, pending: pending, ask: ask, raw: raw)
    }

    // MARK: - drawing

    private struct Piece { let text: NSAttributedString; let size: CGSize; var at = CGPoint.zero; var bg: NSColor? = nil; var pad = CGSize.zero }

    private func piece(_ s: String, _ font: NSFont, _ color: NSColor, wrap: CGFloat? = nil, bg: NSColor? = nil, pad: CGSize = .zero) -> Piece {
        let text = NSAttributedString(string: s, attributes: [.font: font, .foregroundColor: color])
        let r = text.boundingRect(with: NSSize(width: wrap ?? 10_000, height: 10_000), options: [.usesLineFragmentOrigin, .usesFontLeading])
        return Piece(text: text, size: CGSize(width: ceil(r.width) + pad.width * 2, height: ceil(r.height) + pad.height * 2), bg: bg, pad: pad)
    }

    private func render(name: String, cast: String, text: String, variant: Variant, pending: Pending?, ask: String, raw: String) {
        let pad: CGFloat = 16, tail: CGFloat = 14
        let term = variant == .term
        let (chipBg, chipFg) = Self.chip[cast] ?? Self.chip["pi"]!

        var chip = piece(name, Fonts.ui(21, bold: true), chipFg, bg: chipBg, pad: CGSize(width: 11, height: 5))
        var msg = piece(text, Fonts.ui(25, bold: variant == .ask || variant == .angry), term ? NSColor(hex: 0xF5F2FF) : NSColor(hex: 0x2A2440), wrap: 520)
        let row1H = max(chip.size.height, msg.size.height)
        var w = chip.size.width + 12 + msg.size.width
        var h = row1H
        var extra: [(Piece, CGFloat)] = [] // piece, gap above
        var btns: [(Piece, String)] = []

        // the original command, small and quiet, for people who want to know exactly what ran
        if !raw.isEmpty && variant != .ask {
            let sub = piece(raw, Fonts.mono(18), term ? NSColor(hex: 0x6FE39A) : NSColor(hex: 0x9A93B8))
            extra.append((sub, 7)); w = max(w, sub.size.width); h += 6 + sub.size.height
        }
        if variant == .ask, let pending {
            let sub = piece("想要：\(ask)", Fonts.ui(21), NSColor(hex: 0x6E6890), wrap: 520)
            extra.append((sub, 7)); w = max(w, sub.size.width); h += 10 + sub.size.height
            if pending.holding {
                btns = [
                    (piece("同意", Fonts.ui(22, bold: true), NSColor(hex: 0x9BE29F), bg: NSColor(hex: 0x2A2440), pad: CGSize(width: 26, height: 8)), "allow"),
                    (piece("驳回", Fonts.ui(22, bold: true), NSColor(hex: 0x2A2440), bg: NSColor(hex: 0xF1EFF7), pad: CGSize(width: 26, height: 8)), "deny"),
                ]
                h += 12 + btns[0].0.size.height
            } else {
                let hint = piece("请在终端里确认", Fonts.ui(20), NSColor(hex: 0xA09AB8))
                extra.append((hint, 7)); h += 8 + hint.size.height
            }
        }
        w += pad * 2
        h += 22
        bw = w
        bh = h + tail
        let top = -h - tail

        // layout, in bubble coordinates: x centred, y down, tail tip at (0, 0)
        var x = -w / 2 + pad
        var y = top + 11
        chip.at = CGPoint(x: x, y: y + (row1H - chip.size.height) / 2)
        msg.at = CGPoint(x: x + chip.size.width + 12, y: y + (row1H - msg.size.height) / 2)
        y += row1H
        var placed: [Piece] = [chip, msg]
        for (var e, gap) in extra {
            y += gap
            e.at = CGPoint(x: x, y: y)
            placed.append(e)
            y += e.size.height
        }
        var hits: [(CGRect, String)] = []
        if !btns.isEmpty {
            y += 12
            for (var b, behavior) in btns {
                b.at = CGPoint(x: x, y: y)
                placed.append(b)
                hits.append((CGRect(origin: b.at, size: b.size), behavior))
                x += b.size.width + 12
            }
        }

        // draw into a bitmap with some room for the shadow
        let margin: CGFloat = 4, bottom: CGFloat = 2
        let imgW = w + margin * 2, imgH = -top + margin + bottom
        let scale: CGFloat = 2
        guard let ctx = CGContext(data: nil, width: Int(imgW * scale), height: Int(imgH * scale), bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
        ctx.scaleBy(x: scale, y: scale)
        ctx.translateBy(x: 0, y: imgH)
        ctx.scaleBy(x: 1, y: -1)
        ctx.translateBy(x: imgW / 2, y: margin - top)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: true)

        let box = CGRect(x: -w / 2, y: top, width: w, height: h)
        NSColor(white: 0, alpha: 0.25).setFill()
        NSBezierPath(roundedRect: box.offsetBy(dx: 0, dy: 7), xRadius: 22, yRadius: 22).fill()
        (term ? NSColor(hex: 0x1E1C36) : .white).setFill()
        NSBezierPath(roundedRect: box, xRadius: 22, yRadius: 22).fill()
        let tri = NSBezierPath()
        tri.move(to: CGPoint(x: -13, y: -tail - 1)); tri.line(to: CGPoint(x: 13, y: -tail - 1)); tri.line(to: .zero); tri.close()
        tri.fill()
        let stroke: (NSColor, CGFloat)? = term ? (NSColor(hex: 0x6FE39A), 4) : variant == .ask ? (NSColor(hex: 0xFFD27A), 5) : variant == .angry ? (NSColor(hex: 0xFF6B5E), 5) : nil
        if let (color, lw) = stroke {
            color.setStroke()
            let p = NSBezierPath(roundedRect: box, xRadius: 22, yRadius: 22)
            p.lineWidth = lw
            p.stroke()
        }
        for p in placed {
            let r = CGRect(origin: p.at, size: p.size)
            if let bg = p.bg { bg.setFill(); r.fill() }
            p.text.draw(with: r.insetBy(dx: p.pad.width, dy: p.pad.height), options: [.usesLineFragmentOrigin, .usesFontLeading])
        }
        NSGraphicsContext.restoreGraphicsState()

        guard let cg = ctx.makeImage() else { return }
        sprite.texture = SKTexture(cgImage: cg)
        sprite.size = CGSize(width: imgW, height: imgH)
        sprite.anchorPoint = CGPoint(x: 0.5, y: bottom / imgH)

        // buttons in node coordinates (y up)
        buttons = hits.map { rect, behavior in
            Button(rect: CGRect(x: rect.minX, y: -rect.maxY, width: rect.width, height: rect.height), id: pending?.id ?? "", behavior: behavior)
        }

        // the blinking "!" on approval bubbles
        childNode(withName: "dot")?.removeFromParent()
        if variant == .ask {
            let dot = SKShapeNode(circleOfRadius: 15)
            dot.name = "dot"
            dot.fillColor = NSColor(hex: 0xFF6B5E)
            dot.strokeColor = .clear
            dot.position = CGPoint(x: w / 2 - 4, y: -(top + 4))
            dot.zPosition = 1
            let bang = SKLabelNode(text: "!")
            bang.fontName = "PingFangSC-Semibold"
            bang.fontSize = 22
            bang.fontColor = .white
            bang.verticalAlignmentMode = .center
            dot.addChild(bang)
            dot.run(.repeatForever(.sequence([.fadeAlpha(to: 0.35, duration: 0.7), .fadeAlpha(to: 1, duration: 0.7)])))
            addChild(dot)
        }
    }

    /// box frame in page coordinates (top-left origin), for click-through checks
    var pageFrame: CGRect { CGRect(x: px - bw / 2, y: py - bh, width: bw, height: bh) }
}

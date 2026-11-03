import AppKit
import SpriteKit

/// The art from tools/render_assets.py (copied into the app as Resources/assets): layered background,
/// desk-row overlays, one sprite sheet per character, and layout.json with seats and walkable spots.
final class Assets {
    static let shared = Assets()

    static let castKeys = ["boss", "gua", "tian", "zi", "agua", "pi", "g1", "g2", "g3", "g4"]
    static let frameSize = CGSize(width: 180, height: 240)

    let layout: Layout
    let size: CGSize
    let images: [String: SKTexture]
    private var sheets: [String: [SKTexture]] = [:]
    private var avatars: [String: NSImage] = [:]
    /// alpha of the background, to tell the office floor from the empty corners (widget click-through)
    private let floorMask: [UInt8]

    private init() {
        let dir = Bundle.main.resourceURL!.appendingPathComponent("assets")
        layout = try! JSONDecoder().decode(Layout.self, from: Data(contentsOf: dir.appendingPathComponent("layout.json")))
        size = CGSize(width: layout.size[0], height: layout.size[1])
        var images: [String: SKTexture] = [:]
        for k in ["bg_a", "bg_b", "row1", "row2"] {
            images[k] = SKTexture(image: NSImage(contentsOf: dir.appendingPathComponent("\(k).png"))!)
        }
        self.images = images

        let n = layout.frames.count
        for key in Self.castKeys {
            guard let img = NSImage(contentsOf: dir.appendingPathComponent("chars/\(key).png")) else { continue }
            let sheet = SKTexture(image: img)
            sheets[key] = (0..<n).map { SKTexture(rect: CGRect(x: Double($0) / Double(n), y: 0, width: 1 / Double(n), height: 1), in: sheet) }
            // head and shoulders of the first frame, like the web panel's avatar crop
            if let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil),
               let face = cg.cropping(to: CGRect(x: 50, y: 96, width: 80, height: 80)) {
                avatars[key] = NSImage(cgImage: face, size: NSSize(width: 40, height: 40))
            }
        }

        var mask = [UInt8](repeating: 0, count: Int(size.width) * Int(size.height))
        if let bg = NSImage(contentsOf: dir.appendingPathComponent("bg_a.png"))?.cgImage(forProposedRect: nil, context: nil, hints: nil),
           let ctx = CGContext(data: &mask, width: Int(size.width), height: Int(size.height), bitsPerComponent: 8,
                               bytesPerRow: Int(size.width), space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.alphaOnly.rawValue) {
            ctx.draw(bg, in: CGRect(origin: .zero, size: size))
        }
        floorMask = mask
    }

    func frame(_ cast: String, _ name: String) -> SKTexture {
        let i = max(0, layout.frames.firstIndex(of: name) ?? 0)
        let list = sheets[cast] ?? sheets["pi"]!
        return list[min(i, list.count - 1)]
    }

    func avatar(_ cast: String) -> NSImage? { avatars[cast] ?? avatars["pi"] }

    /// is there office (not empty corner) under this point? `p` is in top-left page coordinates
    func onFloor(_ p: CGPoint) -> Bool {
        let x = Int(p.x), y = Int(p.y)
        guard x >= 0, y >= 0, x < Int(size.width), y < Int(size.height) else { return false }
        // bitmap context memory starts with the top row
        return floorMask[y * Int(size.width) + x] > 0
    }
}

extension NSColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255,
                  blue: CGFloat(hex & 0xff) / 255, alpha: alpha)
    }
}

enum Fonts {
    static func ui(_ size: CGFloat, bold: Bool = false) -> NSFont {
        NSFont(name: bold ? "PingFangSC-Semibold" : "PingFangSC-Regular", size: size) ?? .systemFont(ofSize: size, weight: bold ? .semibold : .regular)
    }
    static func heavy(_ size: CGFloat) -> NSFont {
        NSFont(name: "PingFangSC-Semibold", size: size) ?? .systemFont(ofSize: size, weight: .heavy)
    }
    static func mono(_ size: CGFloat, bold: Bool = false) -> NSFont {
        NSFont(name: bold ? "Menlo-Bold" : "Menlo-Regular", size: size) ?? .monospacedSystemFont(ofSize: size, weight: bold ? .bold : .regular)
    }
}

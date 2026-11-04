import AppKit
import SpriteKit

/// The art from tools/render_assets.py (copied into the app as Resources/assets): layered background,
/// desk-row overlays, one sprite sheet per character, and layout.json with seats and walkable spots.
final class Assets {
    static let shared = Assets()

    static let castKeys = ["boss", "gua", "tian", "zi", "agua", "pi", "g1", "g2", "g3", "g4"]
    static let frameSize = CGSize(width: 104, height: 156)

    let layout: Layout
    let size: CGSize
    let images: [String: SKTexture]
    private var sheets: [String: [SKTexture]] = [:]
    private var workSheets: [String: [SKTexture]] = [:]
    private var avatars: [String: NSImage] = [:]
    /// alpha of the background, to tell the office floor from the empty corners (widget click-through)
    private let floorPath: CGPath

    private init() {
        let dir = Bundle.main.resourceURL!.appendingPathComponent("assets")
        layout = try! JSONDecoder().decode(Layout.self, from: Data(contentsOf: dir.appendingPathComponent("layout.json")))
        size = CGSize(width: layout.size[0], height: layout.size[1])
        self.images = ["illustration": SKTexture(image: NSImage(contentsOf: dir.appendingPathComponent("illustration/office.png"))!)]
        let countColumns = layout.atlas.columns
        let work = SKTexture(image: NSImage(contentsOf: dir.appendingPathComponent("illustration/working.png"))!)
        let workAtlas = layout.workAtlas
        let columns = CGFloat(countColumns), rows = CGFloat(layout.atlas.rows)
        for key in Self.castKeys {
            let source = layout.characters[key]!
            let column = workAtlas.characters.firstIndex(of: source)!
            workSheets[key] = (0..<workAtlas.rows).map { row in
                SKTexture(rect: CGRect(x: CGFloat(column) / CGFloat(workAtlas.columns),
                                      y: 1 - CGFloat(row + 1) / CGFloat(workAtlas.rows),
                                      width: 1 / CGFloat(workAtlas.columns), height: 1 / CGFloat(workAtlas.rows)), in: work)
            }
            let img = NSImage(contentsOf: dir.appendingPathComponent("illustration/\(source).png"))!
            let sheet = SKTexture(image: img)
            sheets[key] = layout.frames.indices.map { i in
                SKTexture(rect: CGRect(x: CGFloat(i % countColumns) / columns,
                                      y: 1 - CGFloat(i / countColumns + 1) / rows,
                                      width: 1 / columns, height: 1 / rows), in: sheet)
            }
            let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil)!
            let cellW = CGFloat(cg.width) / columns, cellH = CGFloat(cg.height) / rows
            let face = cg.cropping(to: CGRect(x: cellW * 0.18, y: cellH * 0.24, width: cellW * 0.64, height: cellH * 0.48))!
            avatars[key] = NSImage(cgImage: face, size: NSSize(width: 40, height: 40))
        }
        let path = CGMutablePath()
        for (index, point) in layout.boundary.enumerated() {
            let p = CGPoint(x: point[0], y: point[1])
            if index == 0 { path.move(to: p) } else { path.addLine(to: p) }
        }
        path.closeSubpath()
        floorPath = path
    }

    func frame(_ cast: String, _ name: String) -> SKTexture {
        if name == "work1" || name == "work2" { return workSheets[cast]![name == "work1" ? 0 : 1] }
        let i = max(0, layout.frames.firstIndex(of: name) ?? 0)
        let list = sheets[cast] ?? sheets["pi"]!
        return list[min(i, list.count - 1)]
    }

    func avatar(_ cast: String) -> NSImage? { avatars[cast] ?? avatars["pi"] }

    /// is there office (not empty corner) under this point? `p` is in top-left page coordinates
    func onFloor(_ p: CGPoint) -> Bool {
        floorPath.contains(p)
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

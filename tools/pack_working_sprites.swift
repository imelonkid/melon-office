// Pack the generated six-column/two-row cutouts into the runtime's 104x156 coordinate system.
// Usage: swift tools/pack_working_sprites.swift <generated.png> <working.png>
import AppKit

let input = NSBitmapImageRep(data: try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))!
let columns = 6, rows = 2, cellW = 208, cellH = 312
let output = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: columns * cellW, pixelsHigh: rows * cellH,
                             bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                             colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: output)
let image = NSImage(cgImage: input.cgImage!, size: NSSize(width: input.pixelsWide, height: input.pixelsHigh))
for row in 0..<rows {
    for col in 0..<columns {
        let x0 = col * input.pixelsWide / columns, x1 = (col + 1) * input.pixelsWide / columns
        let y0 = row * input.pixelsHigh / rows, y1 = (row + 1) * input.pixelsHigh / rows
        var left = x1, top = y1, right = x0, bottom = y0
        for y in y0..<y1 {
            for x in x0..<x1 where input.colorAt(x: x, y: y)!.alphaComponent > 0.25 {
                left = min(left, x); right = max(right, x); top = min(top, y); bottom = max(bottom, y)
            }
        }
        precondition(left < right && top < bottom, "empty character frame")
        let width = CGFloat(right - left + 1), height = CGFloat(bottom - top + 1)
        let scale = min(224 / height, 174 / width)
        let source = NSRect(x: left, y: input.pixelsHigh - bottom - 1, width: Int(width), height: Int(height))
        let dest = NSRect(x: CGFloat(col * cellW) + (CGFloat(cellW) - width * scale) / 2,
                          y: CGFloat((rows - row - 1) * cellH + 12), width: width * scale, height: height * scale)
        image.draw(in: dest, from: source, operation: .copy, fraction: 1)
    }
}
NSGraphicsContext.restoreGraphicsState()
try output.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))

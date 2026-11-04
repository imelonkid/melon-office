import AppKit
import Combine
import SpriteKit

// The isometric office, ported from web/src/scene.ts to SpriteKit.
// Logic works in "page" coordinates like the web version (top-left origin, y down, 2x art pixels);
// `sk()` flips them into SpriteKit's bottom-left space. Floor positions are in floor units (x, y).

private let SPEED: CGFloat = 2.4      // floor units per second

// monitor-glow color per kind of work, drawn as a halo around the seated employee
private let GLOW: [String: UInt32] = [
    "edit": 0x9be29f, "read": 0x7ec8f2, "search": 0x7ec8f2, "bash": 0xf2a65a, "web": 0xc78be8,
    "task": 0xffd27a, "plan": 0xffd27a, "think": 0xffd27a, "wait": 0xff6b5e, "fail": 0xff6b5e, "other": 0x9be29f, "idle": 0x9a93c2,
]

// name -> frames, frames per second
private let ANIMS: [String: ([String], Double)] = [
    "type": (["work1", "work2"], 5),
    "workThink": (["work1", "work1", "work1", "work2"], 2),
    "raise": (["sit_raise", "sit_raise2"], 3),
    "think": (["sit", "sit", "sit", "sit", "sit", "sit_blink"], 4),
    "walk": (["walk1", "walk2"], 7),
    "mug": (["mug", "mug", "mug", "mug2"], 2),
    "stand": (["stand"], 1),
    "phone": (["sit_phone", "sit_phone", "sit_phone", "sit_phone2"], 2),
    "talk": (["talk1", "talk2", "talk1", "talk2", "talk1", "talk1"], 4),
    "pet": (["pet1", "pet2"], 2),
    "scold": (["scold1", "scold2", "scold1", "scold2", "scold2", "scold1"], 4),
]

private func now() -> Double { CACurrentMediaTime() * 1000 }

/// A character sprite that knows how to play the named animations.
private final class Character: SKSpriteNode {
    let cast: String
    private var current = ""

    init(cast: String) {
        self.cast = cast
        let tex = Assets.shared.frame(cast, "stand")
        super.init(texture: tex, color: .clear, size: Assets.frameSize)
        anchorPoint = CGPoint(x: 0.5, y: 0.06)
    }

    required init?(coder: NSCoder) { fatalError() }

    func play(_ name: String) {
        if name == current { return }
        current = name
        guard let (frames, fps) = ANIMS[name] else { return }
        let textures = frames.map { Assets.shared.frame(cast, $0) }
        removeAction(forKey: "anim")
        texture = textures[0]
        if textures.count > 1 { run(.repeatForever(.animate(with: textures, timePerFrame: 1 / fps)), withKey: "anim") }
    }

    var flipped: Bool {
        get { xScale < 0 }
        set { xScale = newValue ? -1 : 1 }
    }
}

// ---------------------------------------------------------------- one employee
private enum Spot { case seat, pantry, chat, cat }
private enum Target: Equatable { case seat, pantry, chat, cat, exit }

private final class Worker {
    unowned let scene: OfficeScene
    var agent: Agent
    let sprite: Character
    let glow = SKShapeNode(ellipseOf: CGSize(width: 150, height: 110))
    let selection = SKShapeNode(ellipseOf: CGSize(width: 100, height: 30))
    let bubble = Bubble()
    var pos: CGPoint
    var place: Target? // nil while walking
    var target: Target?
    var path: [CGPoint] = []
    var lastStep = now()
    var idleSince = 0.0
    let phase = Double.random(in: 0..<6)
    var lastSx: CGFloat = 0
    var removed = false
    var chatSlot = 0 // 0 = the left one of a gossip pair, faces right

    // instant: the employee was already in the office when the window opened, so skip the walk-in
    init(scene: OfficeScene, agent: Agent, instant: Bool) {
        self.scene = scene
        self.agent = agent
        let e = scene.layout.spots.entrance
        pos = CGPoint(x: e[0], y: e[1])
        sprite = Character(cast: agent.cast)
        let p = scene.project(pos.x, pos.y)
        lastSx = p.x
        sprite.position = scene.sk(p)
        sprite.zPosition = 60
        sprite.alpha = 0
        sprite.run(.fadeIn(withDuration: 0.4))
        glow.strokeColor = .clear
        glow.isHidden = true
        selection.strokeColor = NSColor(hex: 0xB0E0C7)
        selection.fillColor = .clear
        selection.lineWidth = 3
        selection.isHidden = true
        scene.addChild(selection)
        scene.addChild(glow)
        scene.addChild(sprite)
        scene.addChild(bubble)
        if agent.status == "idle" { idleSince = now() - (instant ? 10000 : 0) }
        decide()
        if instant, let last = path.last {
            pos = last
            path = []
            arrive()
        }
    }

    var seat: Layout.Seat? {
        guard let i = agent.seat, i >= 0, i < scene.layout.seats.count else { return nil }
        return scene.layout.seats[i]
    }

    func update(_ a: Agent) {
        let prev = agent
        agent = a
        if a.status == "idle" && prev.status != "idle" { idleSince = now() }
        if a.partner != prev.partner { target = nil } // new gossip partner, find a new spot
        decide()
    }

    func decide() {
        let a = agent
        let want: Target
        if a.status == "leaving" {
            want = .exit
        } else if a.status == "slacking" {
            switch a.activity {
            case "chat": want = .chat
            case "cat": want = .cat
            case "fake": want = seat != nil ? .seat : .pantry
            case "phone": want = seat != nil ? .seat : .pantry
            default: want = .pantry
            }
        } else if seat == nil {
            want = .pantry
        } else if a.status == "idle" {
            want = place == .pantry || now() - idleSince > 5000 ? .pantry : .seat
        } else {
            want = .seat
        }
        if want != target {
            target = want
            go()
        }
        pose()
    }

    private func go() {
        scene.releaseSpots(self, keep: target)
        let L = scene.layout
        var dest = CGPoint.zero
        if target == .chat {
            if let spot = scene.claimChat(self) { dest = spot } else { target = .pantry }
        }
        switch target {
        case .seat: dest = CGPoint(x: seat!.x, y: seat!.y)
        case .pantry: dest = scene.claimPantry(self)
        case .cat: dest = CGPoint(x: L.spots.cat[0], y: L.spots.cat[1])
        case .exit: dest = CGPoint(x: L.spots.entrance[0], y: L.spots.entrance[1])
        default: break
        }

        let pts = scene.layout.route(from: pos, to: dest)

        place = nil
        glow.isHidden = true
        sprite.play("walk")
        path = pts
        lastStep = now()
    }

    // walk along the path using wall-clock time, so speed is the same even when frames drop
    private func step() {
        let t = now()
        var budget = CGFloat(min(250, t - lastStep) / 1000) * SPEED
        lastStep = t
        while budget > 0, let next = path.first {
            let dx = next.x - pos.x, dy = next.y - pos.y
            let d = hypot(dx, dy)
            if d <= budget {
                pos = next
                budget -= d
                path.removeFirst()
            } else {
                pos = CGPoint(x: pos.x + dx / d * budget, y: pos.y + dy / d * budget)
                budget = 0
            }
        }
        if path.isEmpty { arrive() }
    }

    private func arrive() {
        path = []
        if target == .exit {
            removed = true
            let fade = SKAction.sequence([.fadeOut(withDuration: 0.5), .removeFromParent()])
            sprite.run(fade); bubble.run(fade); glow.removeFromParent(); selection.removeFromParent()
            scene.forget(self)
            return
        }
        place = target
        sprite.flipped = place == .chat && chatSlot == 0
        pose()
    }

    private func pose() {
        guard let place else { return }
        let a = agent
        if place == .seat {
            guard let s = seat else { return }
            sprite.flipped = false // working frames face the monitor, regardless of walk-in direction
            sprite.position = scene.sk(CGPoint(x: s.anchor[0], y: s.anchor[1]))
            sprite.zPosition = s.y * scene.layout.iso.s
            if a.status == "slacking" && a.activity != "fake" {
                glow.isHidden = true
                sprite.play("phone")
                return
            }
            let key = a.activity == "fake" ? "other" : a.status == "waiting" ? "wait" : a.kind
            glow.fillColor = NSColor(hex: GLOW[key] ?? GLOW["other"]!, alpha: 0.22)
            glow.position = scene.sk(CGPoint(x: s.anchor[0], y: s.anchor[1] - 80))
            glow.zPosition = sprite.zPosition - 0.5
            glow.isHidden = false
            if a.status == "waiting" { sprite.play("raise") }
            else if (a.status == "working" && a.kind != "fail") || a.activity == "fake" { sprite.play("type") }
            else { sprite.play(a.isWorking ? "workThink" : "think") }
        } else {
            glow.isHidden = true
            sprite.position = scene.sk(scene.project(pos.x, pos.y))
            sprite.zPosition = scene.depthFor(pos.x, pos.y)
            let anim = place == .chat ? "talk" : place == .cat ? "pet" : (a.status == "waiting" || a.activity == "fake") ? "stand" : "mug"
            sprite.play(anim)
        }
    }

    func tick(_ time: Double, pending: Pending?) {
        if removed { return }
        if place == nil {
            step()
            if removed { return }
        }
        if place == nil {
            let p = scene.project(pos.x, pos.y)
            if abs(p.x - lastSx) > 0.5 { sprite.flipped = p.x < lastSx }
            lastSx = p.x
            sprite.position = scene.sk(p)
            sprite.zPosition = scene.depthFor(pos.x, pos.y)
        } else if agent.status == "idle" && place == .seat && now() - idleSince > 5000 {
            decide()
        }
        selection.position = scene.sk(scene.project(pos.x, pos.y))
        selection.zPosition = sprite.zPosition - 0.1
        selection.isHidden = scene.store.selectedEmployeeId != agent.id
        let a = agent
        let page = scene.page(sprite.position)
        let lift: CGFloat = place == .seat ? 105 : 125
        bubble.px = page.x
        bubble.py = page.y - lift - (a.isWorking ? 0 : 4 * CGFloat(sin(time / 450 + phase)))
        let variant: Bubble.Variant = a.status == "waiting" ? .ask : a.isWorking ? .work : .say
        let store = scene.store
        bubble.show(name: a.name, cast: a.cast, text: a.isWorking ? "工作中" : store.line(a), variant: variant, pending: pending,
                    ask: pending.map(store.ask) ?? "", raw: a.isWorking ? "" : store.raw(a.raw))
    }
}

// ---------------------------------------------------------------- the office
final class OfficeScene: SKScene {
    private(set) var lastFrameTime = CACurrentMediaTime()
    let store: OfficeStore
    let layout = Assets.shared.layout
    private let widget: Bool
    private var workers: [String: Worker] = [:]
    private var pantryUse: [Int: Worker] = [:]
    private var chatUse: [String: Worker] = [:] // "pair:slot" -> who stands there
    private var pendingByAgent: [String: Pending] = [:]
    private var seenFirstState = false
    private var subscription: AnyCancellable?
    private var built = false

    // 瓜老板 = you. He lives in the meeting room, nags about approvals, and walks out to lecture slackers.
    private let boss = Character(cast: "boss")
    private let bossBubble = Bubble()
    private var bossLine = Copy.bossLines[0]
    private var bossPos = CGPoint.zero
    private var bossPath: [CGPoint] = []
    private var bossGoal = "room"
    private var bossLastStep = now()
    private var bossLastSx: CGFloat = 0
    private let wall = SKSpriteNode()

    /// widget: the always-on-top desk version (no caption, transparent)
    init(store: OfficeStore, widget: Bool) {
        self.store = store
        self.widget = widget
        super.init(size: Assets.shared.size)
        scaleMode = .aspectFit
        backgroundColor = .clear
    }

    required init?(coder: NSCoder) { fatalError() }

    // page (top-left) <-> SpriteKit (bottom-left)
    func sk(_ p: CGPoint) -> CGPoint { CGPoint(x: p.x, y: size.height - p.y) }
    func page(_ p: CGPoint) -> CGPoint { CGPoint(x: p.x, y: size.height - p.y) }

    func project(_ x: CGFloat, _ y: CGFloat, _ z: CGFloat = 0) -> CGPoint {
        let iso = layout.iso
        return CGPoint(x: iso.ox + x * iso.s, y: iso.oy + y * iso.s - z * iso.s)
    }

    // painter's order for anyone standing / walking on the floor
    func depthFor(_ x: CGFloat, _ y: CGFloat) -> CGFloat {
        y * layout.iso.s
    }

    override func didMove(to view: SKView) {
        guard !built else { return }
        built = true
        let A = Assets.shared
        func layer(_ points: [[Double]], _ z: CGFloat) {
            let n = SKSpriteNode(texture: A.images["illustration"], size: size)
            n.anchorPoint = CGPoint(x: 0, y: 1)
            n.position = CGPoint(x: 0, y: size.height)
            let path = CGMutablePath()
            for (index, point) in points.enumerated() {
                let p = sk(CGPoint(x: point[0], y: point[1]))
                if index == 0 { path.move(to: p) } else { path.addLine(to: p) }
            }
            path.closeSubpath()
            let mask = SKShapeNode(path: path)
            mask.fillColor = .white; mask.strokeColor = .clear
            let crop = SKCropNode()
            crop.maskNode = mask; crop.zPosition = z; crop.addChild(n)
            addChild(crop)
        }
        layer(layout.boundary, 0)
        for foreground in layout.foregrounds { layer(foreground.points, foreground.depth) }

        wall.anchorPoint = CGPoint(x: 0, y: 1)
        wall.position = CGPoint(x: 0, y: size.height)
        wall.zPosition = 1
        addChild(wall)
        drawWall()
        run(.repeatForever(.sequence([.wait(forDuration: 1), .run { [weak self] in self?.drawWall() }])))

        bossPos = CGPoint(x: layout.spots.boss[0], y: layout.spots.boss[1])
        boss.position = sk(project(bossPos.x, bossPos.y))
        boss.zPosition = depthFor(bossPos.x, bossPos.y)
        boss.play("think")
        addChild(boss)
        addChild(bossBubble)
        var i = 0
        run(.repeatForever(.sequence([.wait(forDuration: 9), .run { [weak self] in
            i += 1
            self?.bossLine = Copy.bossLines[i % Copy.bossLines.count]
        }])))

        apply(store.state)
        subscription = store.$state.dropFirst().receive(on: RunLoop.main).sink { [weak self] s in self?.apply(s) }
    }

    /// slogan, clock and projector title painted on the walls (skewed to follow wall A)
    private func drawWall() {
        let W = Int(size.width), H = Int(size.height)
        guard let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
        ctx.translateBy(x: 0, y: CGFloat(H))
        ctx.scaleBy(x: 1, y: -1)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: true)
        let at = layout.wall.clock
        ctx.concatenate(CGAffineTransform(a: 1, b: -0.55, c: 0, d: 1, tx: at[0], ty: at[1]))
        let d = Date(), cal = Calendar.current
        let value = String(format: "%02d:%02d", cal.component(.hour, from: d), cal.component(.minute, from: d))
        let text = NSAttributedString(string: value, attributes: [.font: Fonts.mono(24, bold: true), .foregroundColor: NSColor(hex: 0xBCE6D2)])
        let textSize = text.size()
        text.draw(at: CGPoint(x: 40 - textSize.width / 2, y: 18 - textSize.height / 2))
        NSGraphicsContext.restoreGraphicsState()
        guard let img = ctx.makeImage() else { return }
        wall.texture = SKTexture(cgImage: img)
        wall.size = size
    }

    // MARK: - spots

    fileprivate func claimPantry(_ w: Worker) -> CGPoint {
        let spots = layout.spots.pantry
        for i in spots.indices where pantryUse[i] == nil || pantryUse[i] === w {
            pantryUse[i] = w
            return CGPoint(x: spots[i][0], y: spots[i][1])
        }
        let s = spots.randomElement()!
        return CGPoint(x: s[0] + .random(in: -0.4...0.4), y: s[1] + .random(in: -0.3...0.3))
    }

    // a gossip spot: next to the partner if they already found one, else an empty pair; nil when all are taken
    fileprivate func claimChat(_ w: Worker) -> CGPoint? {
        let pairs = layout.spots.chat
        func at(_ p: Int, _ s: Int) -> CGPoint {
            chatUse["\(p):\(s)"] = w
            w.chatSlot = s
            return CGPoint(x: pairs[p][s][0], y: pairs[p][s][1])
        }
        func split(_ key: String) -> (Int, Int) {
            let parts = key.split(separator: ":").compactMap { Int($0) }
            return (parts[0], parts[1])
        }
        for (key, v) in chatUse where v === w { let (p, s) = split(key); return at(p, s) }
        for (key, v) in chatUse where v.agent.id == w.agent.partner {
            let (p, s) = split(key)
            if chatUse["\(p):\(1 - s)"] == nil { return at(p, 1 - s) }
        }
        for p in pairs.indices where chatUse["\(p):0"] == nil && chatUse["\(p):1"] == nil { return at(p, 0) }
        return nil
    }

    fileprivate func releaseSpots(_ w: Worker, keep: Target? = nil) {
        if keep != .pantry { for (i, v) in pantryUse where v === w { pantryUse[i] = nil } }
        if keep != .chat { for (k, v) in chatUse where v === w { chatUse[k] = nil } }
    }

    fileprivate func forget(_ w: Worker) {
        releaseSpots(w)
        workers[w.agent.id] = nil
    }

    // MARK: - state

    private func apply(_ s: OfficeState) {
        guard built else { return }
        pendingByAgent = Dictionary(s.pending.map { ($0.agentId, $0) }, uniquingKeysWith: { a, _ in a })
        walkBoss(s.scold != nil ? "floor" : "room")
        let first = !seenFirstState
        var alive = Set<String>()
        for a in s.agents {
            alive.insert(a.id)
            if let w = workers[a.id] { w.update(a) } else {
                let w = Worker(scene: self, agent: a, instant: first)
                if !w.removed { workers[a.id] = w }
            }
        }
        for (id, w) in workers where !alive.contains(id) && w.agent.status != "leaving" {
            var gone = w.agent
            gone.status = "leaving"
            w.update(gone)
        }
        seenFirstState = true
    }

    // meeting room -> through the glass door -> the aisle between the two rows of desks
    private func walkBoss(_ goal: String) {
        if goal == bossGoal { return }
        bossGoal = goal
        let route = layout.spots.bossRoute.map { CGPoint(x: $0[0], y: $0[1]) }
        let r = layout.spots.boss
        bossPath = goal == "floor" ? route : route.dropLast().reversed() + [CGPoint(x: r[0], y: r[1])]
        bossLastStep = now()
        boss.play("walk")
    }

    private func stepBoss() {
        let t = now()
        var budget = CGFloat(min(250, t - bossLastStep) / 1000) * SPEED
        bossLastStep = t
        while budget > 0, let next = bossPath.first {
            let d = hypot(next.x - bossPos.x, next.y - bossPos.y)
            if d <= budget {
                bossPos = next
                budget -= d
                bossPath.removeFirst()
            } else {
                bossPos = CGPoint(x: bossPos.x + (next.x - bossPos.x) / d * budget, y: bossPos.y + (next.y - bossPos.y) / d * budget)
                budget = 0
            }
        }
        let p = project(bossPos.x, bossPos.y)
        if abs(p.x - bossLastSx) > 0.5 { boss.flipped = p.x < bossLastSx }
        bossLastSx = p.x
        boss.position = sk(p)
        boss.zPosition = depthFor(bossPos.x, bossPos.y)
        if bossPath.isEmpty {
            boss.flipped = false
            boss.play(bossGoal == "floor" ? "scold" : "think")
        }
    }

    override func update(_ currentTime: TimeInterval) {
        lastFrameTime = CACurrentMediaTime()
        guard built else { return }
        let time = now()
        for w in Array(workers.values) { w.tick(time, pending: pendingByAgent[w.agent.id]) }
        if !bossPath.isEmpty { stepBoss() }

        let holding = pendingByAgent.values.filter(\.holding).count
        var line = holding > 0 ? "有 \(holding) 个审批等你，点「同意」就行" : bossLine
        var variant = Bubble.Variant.say
        var shake: CGFloat = 0
        if let scold = store.state.scold {
            let elapsed = Date().timeIntervalSince1970 * 1000 + store.clockSkew - scold.startedAt
            let half = (scold.until - scold.startedAt) / 2
            line = scold.lines[safe: elapsed < half ? 0 : 1] ?? scold.lines.first ?? line
            variant = .angry
            shake = bossPath.isEmpty ? 3 * CGFloat(sin(time / 25)) : 0
        }
        let bp = page(boss.position)
        bossBubble.px = bp.x + shake
        bossBubble.py = bp.y - 125 - 4 * CGFloat(sin(time / 500))
        bossBubble.show(name: "瓜老板（你）", cast: "boss", text: line, variant: variant)
        unstack()
    }

    // push overlapping bubbles upward, starting from the ones lowest on screen
    private func unstack() {
        var list = [bossBubble] + workers.values.filter { !$0.removed }.map(\.bubble)
        list.sort { $0.py > $1.py }
        var placed: [Bubble] = []
        for b in list {
            for _ in 0..<6 {
                guard let hit = placed.first(where: { p in
                    abs(b.px - p.px) < (b.bw + p.bw) / 2 + 8 && b.py - b.bh < p.py && b.py > p.py - p.bh
                }) else { break }
                b.py = hit.py - hit.bh - 6
            }
            placed.append(b)
            b.position = sk(CGPoint(x: b.px, y: b.py))
        }
    }

    // MARK: - input

    override func mouseDown(with event: NSEvent) {
        let p = event.location(in: self)
        let visible = workers.values.filter { !$0.bubble.isHidden && $0.bubble.alpha > 0 }
        // Approval controls take priority over profile navigation.
        for worker in visible {
            let b = worker.bubble
            let local = convert(p, to: b)
            if let hit = b.buttons.first(where: { $0.rect.contains(local) }) {
                store.decide(hit.id, hit.behavior)
                return
            }
        }
        for worker in visible {
            if worker.bubble.nameFrame.contains(convert(p, to: worker.bubble)) {
                store.selectEmployee(worker.agent.id)
                return
            }
        }
        for worker in workers.values.sorted(by: { $0.sprite.zPosition > $1.sprite.zPosition }) {
            if !worker.sprite.isHidden && worker.sprite.alpha > 0.1 && worker.sprite.frame.contains(p) {
                store.selectEmployee(worker.agent.id)
                return
            }
        }
        if widget { view?.window?.performDrag(with: event) } // drag the desk widget around by the office
        else { super.mouseDown(with: event) }
    }

    /// is something clickable or visible under this view point? (the widget lets clicks through elsewhere)
    func isSolid(at p: CGPoint) -> Bool {
        let pg = page(p)
        if Assets.shared.onFloor(pg) { return true }
        let bubbles = [bossBubble] + workers.values.map(\.bubble)
        return bubbles.contains { $0.pageFrame.contains(pg) }
    }
}

extension Array {
    subscript(safe i: Int) -> Element? { indices.contains(i) ? self[i] : nil }
}

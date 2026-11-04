import Foundation

// The office state as sent by the JS core (Office.snapshot() in server/office.mjs).
// Parsed by hand from JSONSerialization so a field added on the JS side never breaks the app.

private extension Dictionary where Key == String, Value == Any {
    func str(_ k: String) -> String { self[k] as? String ?? "" }
    func opt(_ k: String) -> String? { self[k] as? String }
    func num(_ k: String) -> Double { (self[k] as? NSNumber)?.doubleValue ?? 0 }
    func bool(_ k: String) -> Bool { self[k] as? Bool ?? false }
    func list(_ k: String) -> [[String: Any]] { self[k] as? [[String: Any]] ?? [] }
}

struct Agent: Equatable {
    var id, cast, name, role, project, status, kind, tool, line, gist, raw, level: String
    var profile: EmployeeProfile
    var sessionId, activity, partner: String?
    var isSub, resident: Bool
    var seat: Int?
    var toolCalls: Int
    var startedAt: Double

    init(_ d: [String: Any]) {
        level = d.str("level")
        profile = EmployeeProfile(d["profile"] as? [String: Any] ?? [:])
        id = d.str("id"); cast = d.str("cast"); name = d.str("name"); role = d.str("role")
        project = d.str("project"); status = d.str("status"); kind = d.str("kind"); tool = d.str("tool")
        line = d.str("line"); gist = d.str("gist"); raw = d.str("raw")
        sessionId = d.opt("sessionId"); activity = d.opt("activity"); partner = d.opt("partner")
        isSub = d.bool("isSub"); resident = d.bool("resident")
        seat = (d["seat"] as? NSNumber)?.intValue
        toolCalls = Int(d.num("toolCalls")); startedAt = d.num("startedAt")
    }

    var isBusy: Bool { ["working", "thinking", "waiting"].contains(status) }
}

struct EmployeeProfile: Equatable {
    struct Event: Equatable, Identifiable {
        let id: Int
        let time: Double
        let text: String
    }
    var source, status, tenure, employment: String
    var recent: [Event]

    init(_ d: [String: Any]) {
        source = d.str("source"); status = d.str("status")
        tenure = d.str("tenure"); employment = d.str("employment")
        recent = d.list("recent").enumerated().map { index, item in
            Event(id: index, time: item.num("t"), text: item.str("text"))
        }
    }
}

struct Pending: Equatable {
    var id, agentId, tool, detail, gist, raw: String
    var holding: Bool

    init(_ d: [String: Any]) {
        id = d.str("id"); agentId = d.str("agentId"); tool = d.str("tool")
        detail = d.str("detail"); gist = d.str("gist"); raw = d.str("raw"); holding = d.bool("holding")
    }
}

struct Stats: Equatable {
    var delivered = 0, toolCalls = 0, approvals = 0, prompts = 0, failures = 0, scoldings = 0
    var slack: Double = 0

    init() {}
    init(_ d: [String: Any]) {
        delivered = Int(d.num("delivered")); toolCalls = Int(d.num("toolCalls")); approvals = Int(d.num("approvals"))
        prompts = Int(d.num("prompts")); failures = Int(d.num("failures")); scoldings = Int(d.num("scoldings"))
        slack = d.num("slack")
    }
}

struct Scold: Equatable {
    var id: String
    var startedAt, until: Double
    var lines: [String]

    init(_ d: [String: Any]) {
        id = d.str("id"); startedAt = d.num("startedAt"); until = d.num("until"); lines = d["lines"] as? [String] ?? []
    }
}

struct Settings: Equatable {
    var officeName = "甜瓜科技 · AI 事业部"
    var reportDir = "~/Documents/Melon Office 日报"
}

struct OfficeState: Equatable {
    var agents: [Agent] = []
    var settings = Settings()
    var reportText = ""
    var pending: [Pending] = []
    var stats = Stats()
    var approvalsEnabled = true
    var scold: Scold?
    var now: Double = Date().timeIntervalSince1970 * 1000

    init() {}
    init(json: String) {
        guard let d = try? JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any] else { return }
        agents = d.list("agents").map(Agent.init).filter { $0.status != "gone" }
        pending = d.list("pending").map(Pending.init)
        stats = Stats(d["stats"] as? [String: Any] ?? [:])
        approvalsEnabled = (d["approvals"] as? [String: Any])?["enabled"] as? Bool ?? true
        scold = (d["scold"] as? [String: Any]).map(Scold.init)
        if let s = d["settings"] as? [String: Any] {
            settings = Settings(officeName: s.str("officeName"), reportDir: s.str("reportDir"))
        }
        reportText = d.str("reportText")
        now = d.num("now")
    }

    var holding: [Pending] { pending.filter(\.holding) }
    var busy: [Agent] { agents.filter(\.isBusy) }
    var slacking: [Agent] { agents.filter { $0.status == "slacking" } }
    func agent(_ id: String) -> Agent? { agents.first { $0.id == id } }
}

// web/public/assets/layout.json, written by tools/render_assets.py
struct Layout: Decodable {
    struct Atlas: Decodable { let columns, rows: Int }
    struct Foreground: Decodable { let depth: Double; let points: [[Double]] }
    struct Navigation: Decodable { let nodes: [[Double]]; let next: [[Int]] }
    let atlas: Atlas
    let characters: [String: String]
    let boundary: [[Double]]
    let foregrounds: [Foreground]
    let navigation: Navigation

    func route(from: CGPoint, to: CGPoint) -> [CGPoint] {
        let nodes = navigation.nodes.map { CGPoint(x: $0[0], y: $0[1]) }
        func nearest(_ p: CGPoint) -> Int {
            nodes.indices.min { hypot(nodes[$0].x-p.x, nodes[$0].y-p.y) < hypot(nodes[$1].x-p.x, nodes[$1].y-p.y) }!
        }
        let start = nearest(from), end = nearest(to)
        var route = [nodes[start]], current = start
        while current != end { current = navigation.next[current][end]; route.append(nodes[current]) }
        return route + [to]
    }

    struct Iso: Decodable { let ox, oy, s: Double }
    struct Seat: Decodable { let id, row: String; let x, y: Double; let anchor: [Double] }
    struct Spots: Decodable {
        let entrance, aisleEast, pantryDoor, rack, boss, cat: [Double]
        let pantry, bossRoute: [[Double]]
        let chat: [[[Double]]]
    }
    struct Wall: Decodable { let banner, clock, projector: [Double] }

    let size: [Double]
    let iso: Iso
    let frames: [String]
    let seats: [Seat]
    let spots: Spots
    let wall: Wall
}

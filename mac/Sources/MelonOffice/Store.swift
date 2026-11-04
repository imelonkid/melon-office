import AppKit
import Combine

/// Native app preferences; shared office settings still live in the JS core.
struct DesktopPreferences {
    var staff = 3
    var widgetWidth: CGFloat = 520
    var launchAtLogin = false
    var claudeState = "none"
    var problem: String?
    var version = ""

    var claudeConnected: Bool { claudeState == "current" || claudeState == "stale" }
}

/// The latest office state plus the few things the UI can do, shared by the window, the widget and the menu.
final class OfficeStore: ObservableObject {
    @Published private(set) var state = OfficeState()
    @Published var desktop = DesktopPreferences()
    @Published var selectedEmployeeId: String?
    var revealEmployee: () -> Void = {}

    func selectEmployee(_ id: String) {
        guard state.agent(id) != nil else { return }
        selectedEmployeeId = id
        revealEmployee()
    }
    /// record mode: hide file names, commands and project names for screen recordings
    @Published var record = UserDefaults.standard.bool(forKey: "record") {
        didSet { UserDefaults.standard.set(record, forKey: "record") }
    }
    /// server time - local time, for timers that come from the server (the boss's speech)
    private(set) var clockSkew: Double = 0

    var decide: (String, String) -> Void = { _, _ in }
    var setApprovals: (Bool) -> Void = { _ in }
    var saveSettings: (Settings) -> Void = { _ in }
    /// writes the HTML daily report, returns its path (nil if it couldn't be written)
    var saveReport: () -> String? = { nil }
    var openSettings: () -> Void = {}
    var openInBrowser: () -> Void = {}
    var setResidentStaff: (Int) -> Void = { _ in }
    var setWidgetWidth: (CGFloat) -> Void = { _ in }
    var setClaudeConnected: (Bool) -> Void = { _ in }
    var setLaunchAtLogin: (Bool) -> Void = { _ in }
    var setRecord: (Bool) -> Void = { _ in }

    func update(json: String) {
        let s = OfficeState(json: json)
        clockSkew = s.now - Date().timeIntervalSince1970 * 1000
        if s != state { state = s }
    }

    // what to show, honouring record mode (same rules as web/src/copy.ts)
    func line(_ a: Agent) -> String { record ? (a.gist.isEmpty ? a.line : a.gist) : a.line }
    func raw(_ raw: String) -> String { record ? "" : raw }
    func ask(_ p: Pending) -> String { record ? (p.gist.isEmpty ? p.detail : p.gist) : p.detail }
    func project(_ a: Agent) -> String { record ? "" : a.project }
}

/// Text shown in the office, ported from web/src/copy.ts.
enum Copy {
    static let activity = ["phone": "刷手机", "chat": "聊八卦", "cat": "撸猫", "coffee": "喝咖啡", "fake": "假装很忙"]
    static let bossLines = ["这个需求，我们拉通对齐一下", "今天的抓手是什么？", "Q4 要打出组合拳", "大家辛苦了，再冲一下", "把颗粒度再细一点"]

    static func since(_ ts: Double, now: Double) -> String {
        let m = max(0, Int(((now - ts) / 60000).rounded()))
        if m < 1 { return "刚刚" }
        if m < 60 { return "\(m)m" }
        return "\(m / 60)h" + (m % 60 > 0 ? " \(m % 60)m" : "")
    }

    static func caption(working: Int, slacking: Int, scolding: Bool) -> String {
        if scolding { return "瓜老板正在工区训话，大家假装很忙" }
        let now = Date()
        let h = Calendar.current.component(.hour, from: now)
        let hm = String(format: "%02d:%02d", h, Calendar.current.component(.minute, from: now))
        if h >= 22 || h < 5 { return "\(hm)，打车能报销了，AI 还在卷" }
        if h >= 21 { return "\(hm)，再坚持一下就能报销打车" }
        if h >= 12 && h < 14 { return "午休时间，\(working) 位 AI 同事还在工位上" }
        if working == 0 && slacking > 0 { return "没有需求，\(slacking) 位 AI 同事在带薪摸鱼" }
        return "\(working) 位 AI 同事正在为你打工"
    }

    /// minutes until the 22:00 taxi-reimbursement line
    static func taxiCountdown() -> String? {
        let cal = Calendar.current
        let now = Date()
        guard let line = cal.date(bySettingHour: 22, minute: 0, second: 0, of: now) else { return nil }
        let diff = line.timeIntervalSince(now)
        if diff <= 0 || cal.component(.hour, from: now) < 5 { return nil }
        let m = Int((diff / 60).rounded(.up))
        return String(format: "%02d:%02d", m / 60, m % 60)
    }
}

import AppKit
import SpriteKit
import SwiftUI

// The main window: header chips, the office scene with its caption, and the OA 工作台 on the right.
// Same content as web/index.html + web/src/panel.ts, in SwiftUI.

extension Color {
    init(_ hex: UInt32) { self.init(nsColor: NSColor(hex: hex)) }
    static let bg = Color(0x000000), panel = Color(0x1C1C21), card = Color(0x28282E), cardDim = Color(0x222227)
    static let text = Color(0xF5F2FF), muted = Color(0x9A93C2), accent = Color(0x9BE29F), warn = Color(0xFF8A5E)
}

/// SKView in SwiftUI (SpriteView doesn't let us keep the scene's own scale mode and mouse handling)
struct SceneView: NSViewRepresentable {
    let scene: OfficeScene

    func makeNSView(context: Context) -> SKView {
        let view = SKView()
        view.allowsTransparency = true
        view.ignoresSiblingOrder = true
        view.preferredFramesPerSecond = 30
        view.presentScene(scene)
        return view
    }

    func updateNSView(_ view: SKView, context: Context) {}
}

struct OfficeView: View {
    @ObservedObject var store: OfficeStore
    let scene: OfficeScene
    @State private var tick = Date()
    private let clock = Timer.publish(every: 10, on: .main, in: .common).autoconnect()

    var body: some View {
        let s = store.state
        VStack(spacing: 0) {
            header(s)
            HStack(alignment: .top, spacing: 16) {
                VStack(spacing: 6) {
                    SceneView(scene: scene)
                        .aspectRatio(Assets.shared.size.width / Assets.shared.size.height, contentMode: .fit)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    Text(Copy.caption(working: s.busy.count, slacking: s.slacking.count, scolding: s.scold != nil))
                        .font(.system(size: 20, weight: .black))
                        .kerning(1)
                        .foregroundColor(.text)
                        .frame(minHeight: 30)
                }
                PanelView(store: store)
                    .frame(width: 340)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 20)
        }
        .background(Color.bg)
        .onReceive(clock) { tick = $0 }
    }

    private func header(_ s: OfficeState) -> some View {
        HStack {
            HStack(spacing: 12) {
                Image(nsImage: StatusIcon.working.image).resizable().scaledToFit()
                    .frame(width: 28, height: 28).foregroundColor(.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.settings.officeName).font(.system(size: 18, weight: .black)).foregroundColor(.text).lineLimit(1)
                    Text("B3 工区 · Claude Code 实时").font(.system(size: 12)).foregroundColor(.muted)
                }
            }
            Spacer()
            HStack(spacing: 8) {
                chip { Text("在岗 ").foregroundColor(.text) + Text("\(s.busy.count) / \(s.agents.count)").bold().foregroundColor(.accent) }
                chip { Text("今日交付 ").foregroundColor(.text) + Text("\(s.stats.delivered)").bold().foregroundColor(.accent) }
                let taxi = Copy.taxiCountdown()
                Text(taxi.map { "距打车报销 \($0)" } ?? "打车可报销")
                    .font(.system(size: 13, weight: .bold)).foregroundColor(Color(0x3A2410))
                    .padding(.horizontal, 14).frame(height: 32)
                    .background(Capsule().fill(Color(0xFFD27A)))
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 34) // below the transparent title bar
        .padding(.bottom, 12)
    }

    private func chip(@ViewBuilder _ content: () -> Text) -> some View {
        content().font(.system(size: 13))
            .padding(.horizontal, 14).frame(height: 32)
            .background(Capsule().fill(Color(0x1C1C21)))
    }
}

private struct PanelView: View {
    @ObservedObject var store: OfficeStore
    @State private var reportOpen = false
    @State private var reportFile: String?
    @State private var reportFailed = false
    @State private var copied = false

    var body: some View {
        Group {
            if store.selectedEmployeeId != nil {
                EmployeeProfileView(store: store)
            } else {
                overview
            }
        }
        .padding(18)
        .background(RoundedRectangle(cornerRadius: 22).fill(Color.panel))
    }

    private var overview: some View {
        let s = store.state
        let waitingIds = Set(s.pending.map(\.agentId))
        let asks = s.pending.compactMap { p in s.agent(p.agentId).map { (p, $0) } }
        let busy = s.agents.filter { !waitingIds.contains($0.id) && $0.isBusy }
        let chill = s.agents.filter { $0.status == "idle" || $0.status == "leaving" }
        let slacking = s.slacking
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("OA 工作台").font(.system(size: 17, weight: .black)).foregroundColor(.text)
                Spacer()
                Toggle("在工区审批", isOn: Binding(get: { s.approvalsEnabled }, set: { store.setApprovals($0) }))
                    .toggleStyle(.checkbox).font(.system(size: 12)).foregroundColor(.muted)
                Button { store.openSettings() } label: { Image(systemName: "gearshape") }
                    .buttonStyle(.plain).foregroundColor(.muted).help("设置")
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    section("待我审批 · \(asks.count)", color: .warn)
                    if asks.isEmpty { empty("暂无审批，老板可以喝口茶") }
                    ForEach(asks, id: \.0.id) { p, a in askCard(p, a) }

                    section("加班中 · \(busy.count)", color: .accent)
                    if busy.isEmpty { empty("工位空空，AI 们都在摸鱼") }
                    ForEach(busy, id: \.id) { a in card(a, right: a.toolCalls > 0 ? "\(a.toolCalls) 次调用" : Copy.since(a.startedAt, now: s.now)) }

                    section("茶水间 · \(chill.count)", color: .muted)
                    ForEach(chill, id: \.id) { a in card(a, right: a.status == "leaving" ? "下班了" : "等验收", dim: true) }

                    if !slacking.isEmpty {
                        section("摸鱼中 · \(slacking.count)", color: .muted)
                        ForEach(slacking, id: \.id) { a in card(a, right: Copy.activity[a.activity ?? ""] ?? "摸鱼中", dim: true) }
                    }
                }
            }
            report(s)
            if store.record {
                Text("录屏模式：已隐藏文件名和命令").font(.system(size: 11)).foregroundColor(.muted).frame(maxWidth: .infinity)
            }
        }
    }

    private func section(_ title: String, color: Color) -> some View {
        Text(title).font(.system(size: 12, weight: .bold)).foregroundColor(color).padding(.top, 8)
    }

    private func empty(_ text: String) -> some View {
        Text(text).font(.system(size: 12)).foregroundColor(.muted).padding(.vertical, 6).padding(.horizontal, 2)
    }

    private func avatar(_ a: Agent) -> some View {
        Group {
            if let img = Assets.shared.avatar(a.cast) { Image(nsImage: img).resizable() } else { Color.clear }
        }
        .frame(width: 40, height: 40)
        .background(Color(0x34343B))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func card(_ a: Agent, right: String, dim: Bool = false) -> some View {
        let raw = store.raw(a.raw)
        let proj = store.project(a)
        let kindColor: [String: Color] = ["edit": .accent, "read": Color(0x7EC8F2), "search": Color(0x7EC8F2), "bash": Color(0xF2A65A), "web": Color(0xC78BE8), "fail": Color(0xFF8A80)]
        return Button { store.selectEmployee(a.id) } label: {
            HStack(spacing: 10) {
                avatar(a)
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(a.name).font(.system(size: 13, weight: .bold)).foregroundColor(.text).lineLimit(1)
                        Spacer()
                        Text(right).font(.system(size: 11)).foregroundColor(.muted).lineLimit(1)
                    }
                    Text(store.line(a)).font(.system(size: 12)).foregroundColor(.text).lineLimit(1)
                    if !raw.isEmpty {
                        Text(raw).font(.system(size: 11, design: .monospaced)).foregroundColor(kindColor[a.kind] ?? Color(0xC9BFE0)).lineLimit(1)
                    }
                    if !proj.isEmpty { Text("\(a.role) · \(proj)").font(.system(size: 11)).foregroundColor(.muted) }
                }
            }
            .padding(.vertical, 8).padding(.horizontal, 10)
            .background(RoundedRectangle(cornerRadius: 14).fill(dim ? Color.cardDim : Color.card))
            .contentShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("查看\(a.name)的员工档案")
    }

    private func askCard(_ p: Pending, _ a: Agent) -> some View {
        HStack(spacing: 10) {
            Button { store.selectEmployee(a.id) } label: { avatar(a) }.buttonStyle(.plain)
            VStack(alignment: .leading, spacing: 4) {
                Button(a.name) { store.selectEmployee(a.id) }
                    .buttonStyle(.plain).font(.system(size: 13, weight: .bold)).foregroundColor(.text)
                Text("想要：\(store.ask(p))").font(.system(size: 12)).foregroundColor(.text).lineLimit(2)
                    .onTapGesture { store.selectEmployee(a.id) }
                if p.holding {
                    HStack(spacing: 6) {
                        Button("同意") { store.decide(p.id, "allow") }.buttonStyle(Pill(bg: .accent, fg: Color(0x1F3A1B)))
                        Button("驳回") { store.decide(p.id, "deny") }.buttonStyle(Pill(bg: Color(0x3A3A42), fg: .text))
                    }
                } else {
                    Text("请在终端里确认").font(.system(size: 11)).foregroundColor(.muted)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 8).padding(.horizontal, 10)
        .background(RoundedRectangle(cornerRadius: 14).fill(Color(0x2C2421))
            .onTapGesture { store.selectEmployee(a.id) })
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.warn, lineWidth: 1.5))
    }

    private func makeReport() {
        reportFile = store.saveReport()
        reportFailed = reportFile == nil
        reportOpen = true
        copied = false
    }

    private func report(_ s: OfficeState) -> some View {
        let text = s.reportText
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("瓜老板的日报").font(.system(size: 15, weight: .bold))
                Spacer()
                Text("自动生成").font(.system(size: 11)).foregroundColor(Color(0x8A84A6))
            }
            if reportOpen {
                Text(text).font(.system(size: 13)).lineSpacing(4).fixedSize(horizontal: false, vertical: true)
                if let reportFile {
                    Text("已保存：\((reportFile as NSString).abbreviatingWithTildeInPath)")
                        .font(.system(size: 11)).foregroundColor(Color(0x6E6890)).lineLimit(1).truncationMode(.middle)
                        .help(reportFile)
                } else if reportFailed {
                    Text("HTML 没存上，检查一下日报保存目录").font(.system(size: 11)).foregroundColor(Color(0xC0392B))
                }
            }
            HStack {
                Text(reportOpen ? s.settings.officeName : "今日交付 \(s.stats.delivered) 项 · 工具调用 \(s.stats.toolCalls) 次")
                    .font(.system(size: 11)).foregroundColor(Color(0x8A84A6)).lineLimit(1)
                Spacer()
                if reportOpen {
                    if let reportFile {
                        Button("打开") { NSWorkspace.shared.open(URL(fileURLWithPath: reportFile)) }
                            .buttonStyle(Pill(bg: Color(0x2A2440), fg: .accent))
                    }
                    Button("更新") { makeReport() }.buttonStyle(Pill(bg: Color(0x2A2440), fg: .accent))
                    Button(copied ? "已复制" : "复制") {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString("\(text)\n— \(s.settings.officeName) · 来自 Melon Office", forType: .string)
                        copied = true
                    }.buttonStyle(Pill(bg: Color(0x2A2440), fg: .accent))
                } else {
                    Button("生成日报") { makeReport() }.buttonStyle(Pill(bg: Color(0x2A2440), fg: .accent))
                }
            }
        }
        .foregroundColor(Color(0x2A2440))
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color(0xFFFDF6)))
    }
}

private struct Pill: ButtonStyle {
    let bg: Color
    let fg: Color

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(fg)
            .padding(.horizontal, 16).frame(minHeight: 28)
            .background(Capsule().fill(bg))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

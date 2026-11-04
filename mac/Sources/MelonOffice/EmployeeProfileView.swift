import SwiftUI

/// The same employee badge reached from the scene, speech chip, list and desk widget.
struct EmployeeProfileView: View {
    @ObservedObject var store: OfficeStore
    private let ink = Color(0x272637)
    private let secondary = Color(0x747282)

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button { store.selectedEmployeeId = nil } label: {
                Label("返回工作台", systemImage: "arrow.left")
            }
            .buttonStyle(.plain).font(.system(size: 13, weight: .semibold)).foregroundColor(.text)
            ScrollView {
                if let id = store.selectedEmployeeId, let a = store.state.agent(id) {
                    VStack(alignment: .leading, spacing: 16) {
                        badge(a).padding(.top, 18)
                        ForEach(store.state.pending.filter { $0.agentId == id }, id: \.id) { request in
                            approval(request)
                        }
                        Text("最近动态").font(.system(size: 15, weight: .bold)).foregroundColor(.text)
                        if store.record {
                            note("录屏模式：已隐藏项目、命令和历史动态")
                        } else if a.profile.recent.isEmpty {
                            note("还没有工作动态，等待新任务。")
                        } else {
                            ForEach(a.profile.recent) { event in
                                HStack(alignment: .top, spacing: 10) {
                                    Circle().fill(Color.accent).frame(width: 6, height: 6).padding(.top, 5)
                                    Text(Copy.since(event.time, now: store.state.now))
                                        .font(.system(size: 11)).foregroundColor(.muted).frame(width: 34, alignment: .leading)
                                    VStack(alignment: .leading, spacing: 5) {
                                        Text(event.text).font(.system(size: 12)).foregroundColor(.text)
                                        if !event.raw.isEmpty {
                                            Text(event.raw).font(.system(size: 10, design: .monospaced)).foregroundColor(.muted)
                                                .textSelection(.enabled)
                                        }
                                    }.fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                    }
                } else {
                    note("这位员工已下班，返回工作台查看其他同事。")
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func note(_ text: String) -> some View {
        Text(text).font(.system(size: 12)).foregroundColor(.muted)
            .fixedSize(horizontal: false, vertical: true).padding(.vertical, 6)
    }

    private func badge(_ a: Agent) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("MELON OFFICE").font(.system(size: 10, weight: .bold)).kerning(1.3).foregroundColor(secondary)
                Spacer(minLength: 4)
                Text("员工档案").font(.system(size: 16, weight: .bold))
            }
            .padding(.top, 10)
            HStack(spacing: 14) {
                if let avatar = Assets.shared.avatar(a.cast) {
                    Image(nsImage: avatar).resizable().interpolation(.none).scaledToFit()
                        .frame(width: 88, height: 104)
                        .background(Color(0xD9EEF8)).clipShape(RoundedRectangle(cornerRadius: 12))
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(a.name).font(.system(size: 25, weight: .black)).fixedSize(horizontal: false, vertical: true)
                    Text([a.role, a.level].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.system(size: 12)).foregroundColor(secondary)
                    Text(a.profile.source.isEmpty ? "待分配" : a.profile.source)
                        .font(.system(size: 11)).foregroundColor(Color(0x455969))
                        .padding(.horizontal, 7).padding(.vertical, 4)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(0x9BA7C4)))
                    Text("AI 事业部").font(.system(size: 12)).foregroundColor(secondary)
                }
            }
            Divider()
            HStack(spacing: 7) {
                Circle().fill(a.status == "waiting" ? Color(0xB47427) : Color(0x388A51)).frame(width: 7, height: 7)
                Text(a.profile.status).font(.system(size: 12, weight: .bold))
            }
            .foregroundColor(a.status == "waiting" ? Color(0x87541C) : Color(0x255A40))
            .padding(8).background(RoundedRectangle(cornerRadius: 8).fill(a.status == "waiting" ? Color(0xFFF0D7) : Color(0xE2F2E7)))
            fact("当前项目", store.record ? "录屏模式已隐藏" : a.project.isEmpty ? "待分配" : a.project)
            HStack(alignment: .top) {
                fact("本次在岗", a.profile.tenure)
                Spacer()
                fact("工具调用", "\(a.toolCalls) 次")
            }
            VStack(alignment: .leading, spacing: 7) {
                Label("正在做什么", systemImage: "chevron.left.forwardslash.chevron.right")
                    .font(.system(size: 12, weight: .bold)).foregroundColor(Color(0x2D654B))
                Text(store.line(a)).font(.system(size: 13)).fixedSize(horizontal: false, vertical: true)
                if !store.raw(a.raw).isEmpty {
                    Text(store.raw(a.raw)).font(.system(size: 10, design: .monospaced))
                        .foregroundColor(Color(0x586B64)).fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading).padding(12)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color(0xE5F2EC)))
            HStack(spacing: 10) {
                Text("\(a.profile.employment) · \(store.state.settings.officeName)")
                    .font(.system(size: 9)).foregroundColor(secondary).fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                // Decorative bars only; no invented employee identifier or encoded session data.
                HStack(spacing: 2) {
                    ForEach(0..<14) { i in Rectangle().fill(secondary).frame(width: i % 3 == 0 ? 3 : 1) }
                }.frame(height: 15).accessibilityHidden(true)
            }
        }
        .foregroundColor(ink).padding(18)
        .background(RoundedRectangle(cornerRadius: 20).fill(Color(0xFAF9F5)))
        .overlay(RoundedRectangle(cornerRadius: 20).stroke(Color(0xD7D4DD)))
        .overlay(alignment: .top) {
            Capsule().fill(Color(0x292638)).frame(width: 38, height: 10).padding(.top, 9)
                .overlay(alignment: .top) {
                    RoundedRectangle(cornerRadius: 4).fill(Color(0x9BDEBB)).frame(width: 18, height: 28).offset(y: -12)
                }
                .accessibilityHidden(true)
        }
    }

    private func fact(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.system(size: 11)).foregroundColor(secondary)
            Text(value).font(.system(size: 13, weight: .bold)).fixedSize(horizontal: false, vertical: true)
        }
    }

    private func approval(_ p: Pending) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("待你审批").font(.system(size: 13, weight: .bold))
            Text(store.ask(p)).font(.system(size: 12)).fixedSize(horizontal: false, vertical: true)
            if p.holding {
                HStack {
                    Button("同意") { store.decide(p.id, "allow") }.tint(.accent)
                    Button("驳回") { store.decide(p.id, "deny") }
                }.buttonStyle(.bordered)
            } else {
                Text("请在终端里确认").font(.system(size: 11)).foregroundColor(.muted)
            }
        }
        .foregroundColor(.text).frame(maxWidth: .infinity, alignment: .leading).padding(12)
        .background(RoundedRectangle(cornerRadius: 14).fill(Color(0x2C2421)))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.warn))
    }
}

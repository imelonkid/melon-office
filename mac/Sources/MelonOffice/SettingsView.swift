import AppKit
import SwiftUI

/// Shared office settings and native app preferences, grouped away from the status menu.
struct SettingsView: View {
    @ObservedObject var store: OfficeStore
    @State private var name = ""
    @State private var dir = ""
    @State private var saved = false

    var body: some View {
        TabView {
            general.tabItem { Label("通用", systemImage: "gearshape") }
            office.tabItem { Label("工区", systemImage: "desktopcomputer") }
            connections.tabItem { Label("接入", systemImage: "link") }
        }
        .padding(16)
        .frame(width: 560, height: 530)
        .onAppear {
            name = store.state.settings.officeName
            dir = store.state.settings.reportDir
        }
    }

    private var general: some View {
        Form {
            if let problem = store.desktop.problem {
                Section("服务状态") {
                    Label("服务未启动", systemImage: "exclamationmark.triangle")
                        .foregroundColor(.orange)
                    Text(problem).font(.caption).textSelection(.enabled)
                }
            }
            Section {
                Toggle("开机启动", isOn: Binding(get: { store.desktop.launchAtLogin }, set: store.setLaunchAtLogin))
            }
            Section("工区信息") {
                TextField("工区名称", text: $name, prompt: Text(Settings().officeName))
                    .onChange(of: name) { _ in saved = false }
                Text("显示在工区左上角和日报抬头").font(.caption).foregroundColor(.secondary)
                HStack {
                    TextField("日报保存目录", text: $dir, prompt: Text(Settings().reportDir))
                        .onChange(of: dir) { _ in saved = false }
                    Button("选择…") { chooseFolder() }
                    Button { revealFolder() } label: { Image(systemName: "folder") }
                        .help("在 Finder 中显示")
                        .accessibilityLabel("在 Finder 中显示")
                }
                Text("「生成日报」会在这里写一份 日报-日期.html，同一天重复生成会覆盖").font(.caption).foregroundColor(.secondary)
                HStack {
                    Button("恢复默认") {
                        name = Settings().officeName
                        dir = Settings().reportDir
                    }
                    Spacer()
                    if saved { Text("已保存").foregroundColor(.secondary) }
                    Button("保存") {
                        store.saveSettings(Settings(officeName: name, reportDir: dir))
                        saved = true
                    }
                    .keyboardShortcut(.defaultAction)
                }
            }
            Text("Melon Office · v\(store.desktop.version)").font(.caption).foregroundColor(.secondary)
        }
        .formStyle(.grouped)
    }

    private var office: some View {
        Form {
            Section("显示") {
                Picker("桌面小窗大小", selection: Binding(get: { store.desktop.widgetWidth }, set: store.setWidgetWidth)) {
                    ForEach(WidgetWindow.sizes, id: \.1) { label, width in
                        Text(label).tag(width)
                    }
                }
                Toggle("录屏模式", isOn: Binding(get: { store.record }, set: store.setRecord))
                Text("隐藏项目、文件名、命令和最近动态中的具体内容").font(.caption).foregroundColor(.secondary)
            }
            Section("员工") {
                Picker("常驻员工", selection: Binding(get: { store.desktop.staff }, set: store.setResidentStaff)) {
                    ForEach(0...5, id: \.self) { n in
                        Text(n == 0 ? "不要常驻" : "\(n) 人").tag(n)
                    }
                }
                Text("调整人数会重建工区，进行中的会话会在下次活动时重新入场").font(.caption).foregroundColor(.secondary)
            }
            Section {
                Button("在浏览器中打开工区") { store.openInBrowser() }
            }
        }
        .formStyle(.grouped)
    }

    private var connections: some View {
        Form {
            Section("会话来源") {
                Toggle("Claude Code", isOn: Binding(get: { store.desktop.claudeConnected }, set: store.setClaudeConnected))
                    .disabled(store.desktop.claudeState == "unreadable")
                Text(claudeDescription).font(.caption).foregroundColor(.secondary)
                Toggle("Codex", isOn: Binding(get: { store.desktop.codexConnected }, set: store.setCodexConnected))
                    .disabled(store.desktop.codexState == "unreadable")
                Text(codexDescription).font(.caption).foregroundColor(.secondary)
                Text("两个来源可同时开启，新来源默认关闭。变更后请新开会话。").font(.caption).foregroundColor(.secondary)
            }
            Section("审批") {
                Toggle("在工区审批", isOn: Binding(get: { store.state.approvalsEnabled }, set: store.setApprovals))
                Text("接收已接入来源的权限请求；关闭后交回原应用处理").font(.caption).foregroundColor(.secondary)
            }
        }
        .formStyle(.grouped)
    }

    private var claudeDescription: String {
        switch store.desktop.claudeState {
        case "current": return "已接入，新会话会自动进入工区。关闭时只移除 Melon Office 的接入配置。"
        case "stale": return "已接入，配置将在下次启动时自动更新。"
        case "unreadable": return "无法读取 Claude Code 配置，请修复配置后重新打开设置。"
        default: return "开启后，新会话会自动进入工区，并备份原有 Claude Code 配置。"
        }
    }

    private var codexDescription: String {
        switch store.desktop.codexState {
        case "current", "stale": return "配置已写入。请在 Codex 的 Hooks 设置中审核并信任后，新开会话生效；命令行可用 /hooks 审核。"
        case "unreadable": return "无法读取 Codex hooks 配置，请修复配置后重新打开设置。"
        default: return "接入本机 Codex 会话。开启后需在 Codex 内审核并信任 hooks，不会修改模型、登录或其他来源。"
        }
    }

    private var expandedDir: String { ((dir.isEmpty ? Settings().reportDir : dir) as NSString).expandingTildeInPath }

    private func chooseFolder() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.canCreateDirectories = true
        panel.prompt = "选这个目录"
        panel.directoryURL = URL(fileURLWithPath: expandedDir).deletingLastPathComponent()
        if panel.runModal() == .OK, let url = panel.url {
            dir = (url.path as NSString).abbreviatingWithTildeInPath
        }
    }

    private func revealFolder() {
        let url = URL(fileURLWithPath: expandedDir)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }
}

final class SettingsWindow: NSWindowController {
    convenience init(store: OfficeStore) {
        let window = NSWindow(contentRect: .zero, styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "Melon Office 设置"
        window.isReleasedWhenClosed = false
        window.contentView = NSHostingView(rootView: SettingsView(store: store))
        window.setContentSize(window.contentView!.fittingSize)
        window.center()
        self.init(window: window)
    }

    func show() {
        NSApp.activate(ignoringOtherApps: true)
        // reload the fields from the current settings each time it opens
        if let store = (window?.contentView as? NSHostingView<SettingsView>)?.rootView.store {
            window?.contentView = NSHostingView(rootView: SettingsView(store: store))
        }
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
    }
}

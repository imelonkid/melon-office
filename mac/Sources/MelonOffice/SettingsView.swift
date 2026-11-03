import AppKit
import SwiftUI

/// 设置: office name and where the HTML daily report goes. Saved to ~/.config/melon-office/settings.json,
/// which the CLI version reads too.
struct SettingsView: View {
    @ObservedObject var store: OfficeStore
    @State private var name = ""
    @State private var dir = ""
    @State private var saved = false

    var body: some View {
        Form {
            Section {
                TextField("工区名称", text: $name, prompt: Text(Settings().officeName))
                    .onChange(of: name) { _ in saved = false }
                Text("显示在左上角和日报抬头，比如「西瓜网络 · 大模型中心」").font(.caption).foregroundColor(.secondary)
            }
            Section {
                HStack {
                    TextField("日报保存目录", text: $dir, prompt: Text(Settings().reportDir))
                        .onChange(of: dir) { _ in saved = false }
                    Button("选择…") { chooseFolder() }
                    Button("在 Finder 中显示") { revealFolder() }
                }
                Text("「生成日报」会在这里写一份 日报-日期.html，同一天重复生成会覆盖").font(.caption).foregroundColor(.secondary)
            }
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
        .formStyle(.grouped)
        .frame(width: 520)
        .onAppear {
            name = store.state.settings.officeName
            dir = store.state.settings.reportDir
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

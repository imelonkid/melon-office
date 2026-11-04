import AppKit
import ServiceManagement

/// Menu bar app: hosts the office, shows who's working / waiting in the menu bar, and opens the
/// full office window or the always-on-top desk widget.
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private let defaults = UserDefaults.standard
    private var core: MelonCore!
    private var server: OfficeServer!
    private let notifier = Notifier()
    private let updater = Updater()
    private let store = OfficeStore()
    private var statusItem: NSStatusItem!
    private var office: OfficeWindow?
    private var widget: WidgetWindow?
    private var settings: SettingsWindow?
    private var problem: String?

    private var port: Int { defaults.object(forKey: "port") as? Int ?? 7777 }
    private var staff: Int { defaults.object(forKey: "staff") as? Int ?? 3 }
    private var baseURL: URL { URL(string: "http://127.0.0.1:\(port)/")! }

    func applicationDidFinishLaunching(_ note: Notification) {
        guard let res = Bundle.main.resourceURL,
              let script = try? String(contentsOf: res.appendingPathComponent("core.js"), encoding: .utf8) else {
            fatal("App 资源不完整，请重新安装 Melon Office")
            return
        }
        core = MelonCore(script: script)
        server = OfficeServer(port: UInt16(port), dist: res.appendingPathComponent("dist"), core: core)
        core.onState = { [weak self] json in self?.stateChanged(json) }
        store.decide = { [weak self] id, behavior in self?.core.decide(id, behavior) }
        store.setApprovals = { [weak self] on in self?.core.setApprovals(on) }
        store.saveSettings = { [weak self] s in self?.core.setSettings(s) }
        store.saveReport = { [weak self] in
            guard let path = self?.core.saveReport(), FileManager.default.fileExists(atPath: path) else { return nil }
            return path
        }
        store.openSettings = { [weak self] in self?.openSettings() }
        store.openInBrowser = { [weak self] in self?.openInBrowser() }
        store.setResidentStaff = { [weak self] in self?.setStaff($0) }
        store.setWidgetWidth = { [weak self] in self?.setWidgetWidth($0) }
        store.setClaudeConnected = { [weak self] in self?.setClaudeConnected($0) }
        store.setLaunchAtLogin = { [weak self] in self?.setLaunchAtLogin($0) }
        store.setRecord = { [weak self] on in
            guard let self else { return }
            self.store.record = on
            self.stateChanged(self.core.snapshot())
        }
        store.revealEmployee = { [weak self] in self?.openOffice() }
        server.onSocketsChanged = { [weak self] in self?.updateClients() }

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.imagePosition = .imageLeading
        refreshTitle()
        let menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu

        notifier.onDecision = { [weak self] id, behavior in self?.core.decide(id, behavior) }
        notifier.onOpen = { [weak self] in self?.openOffice() }
        notifier.onAuthorization = { [weak self] in self?.updateClients() }
        notifier.setUp()

        core.start(staff: staff)
        updater.start() // 启动 10 秒后、之后每 6 小时、唤醒后读 latest.json（本机开发版不查）
        server.start { [weak self] err in
            guard let self else { return }
            self.problem = err
            self.refreshTitle()
            if err == nil {
                self.openOffice()
                if self.defaults.bool(forKey: "widget") { self.toggleWidget() }
                self.reconcileHooks()
            }
            self.refreshDesktopSettings()
        }
    }

    /// opening the app again (Finder, Spotlight) brings the office back
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
        openOffice()
        return false
    }

    // MARK: - state

    private func stateChanged(_ json: String) {
        server.broadcast(json)
        store.update(json: json)
        refreshTitle()
        notifier.update(asks.map { Notifier.Ask(id: $0.id, name: state.agent($0.agentId)?.name ?? "员工", detail: store.ask($0)) })
    }

    /// the app counts as a place to answer approvals once notifications are allowed
    private func updateClients() {
        core.setClients(server.socketCount + (notifier.authorized ? 1 : 0))
    }

    private var state: OfficeState { store.state }
    private var asks: [Pending] { state.holding }
    private var busy: Int { state.busy.count }
    private var slacking: Int { state.slacking.count }
    private var approvalsOn: Bool { state.approvalsEnabled }

    private func refreshTitle() {
        let icon: StatusIcon = problem != nil || !asks.isEmpty ? .attention : busy > 0 ? .working : .idle
        var title = busy > 0 ? " \(busy)" : ""
        if !asks.isEmpty { title += " · 审批 \(asks.count)" }
        statusItem.button?.image = icon.image
        statusItem.button?.title = title
        let summary = "加班 \(busy) · 摸鱼 \(slacking) · 待审批 \(asks.count)"
        statusItem.button?.toolTip = problem ?? summary
        statusItem.button?.setAccessibilityLabel("Melon Office：\(problem ?? summary)")
    }

    // MARK: - menu

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        if let problem {
            let item = action("服务未启动，查看详情…", #selector(openSettings))
            item.toolTip = problem
            menu.addItem(item)
        } else {
            menu.addItem(disabled("加班 \(busy) · 摸鱼 \(slacking) · 待审批 \(asks.count)"))
        }
        for ask in asks {
            let id = ask.id
            let who = state.agent(ask.agentId)?.name ?? "员工"
            let detail = store.ask(ask)
            let summary = detail.count > 30 ? String(detail.prefix(30)) + "…" : detail
            let item = NSMenuItem(title: "\(who)想要：\(summary)", action: nil, keyEquivalent: "")
            item.toolTip = detail
            let sub = NSMenu()
            sub.addItem(action("同意", #selector(decide(_:)), represented: [id, "allow"]))
            sub.addItem(action("驳回", #selector(decide(_:)), represented: [id, "deny"]))
            item.submenu = sub
            menu.addItem(item)
        }
        if let rel = updater.available {
            menu.addItem(action("有新版本 \(rel.tag)，点这里更新", #selector(showUpdate)))
        }
        menu.addItem(.separator())
        menu.addItem(action("打开工区", #selector(openOffice), key: "o"))
        menu.addItem(action("桌面小窗", #selector(toggleWidget), on: widget?.isVisible == true))
        menu.addItem(.separator())
        menu.addItem(action("设置…", #selector(openSettings), key: ","))
        menu.addItem(action("检查更新…", #selector(checkForUpdates)))
        menu.addItem(.separator())
        menu.addItem(action("退出 Melon Office", #selector(quit), key: "q"))
    }

    private func disabled(_ title: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.isEnabled = false
        return item
    }

    private func action(_ title: String, _ sel: Selector, key: String = "", on: Bool = false, represented: Any? = nil) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: sel, keyEquivalent: key)
        item.target = self
        item.state = on ? .on : .off
        item.representedObject = represented
        return item
    }

    @objc private func decide(_ sender: NSMenuItem) {
        guard let pair = sender.representedObject as? [String], pair.count == 2 else { return }
        core.decide(pair[0], pair[1])
    }

    @objc private func openOffice() {
        if office == nil { office = OfficeWindow(store: store) }
        office?.show()
    }

    private var widgetWidth: CGFloat { defaults.object(forKey: "widgetWidth") as? CGFloat ?? 520 }

    @objc private func toggleWidget() {
        if widget == nil { widget = WidgetWindow(store: store, width: widgetWidth) }
        guard let widget else { return }
        if widget.isVisible { widget.hide() } else { widget.show() }
        defaults.set(widget.isVisible, forKey: "widget")
    }

    private func setWidgetWidth(_ width: CGFloat) {
        defaults.set(width, forKey: "widgetWidth")
        widget?.resize(width: width)
        refreshDesktopSettings()
    }

    @objc private func openSettings() {
        refreshDesktopSettings()
        if settings == nil { settings = SettingsWindow(store: store) }
        settings?.show()
    }

    @objc private func openInBrowser() {
        NSWorkspace.shared.open(baseURL)
    }

    private func setStaff(_ n: Int) {
        defaults.set(n, forKey: "staff")
        core.start(staff: n) // rebuilds the office; sessions reappear with their next hook event
        updateClients()
        refreshDesktopSettings()
    }

    private func setClaudeConnected(_ connected: Bool) {
        if connected {
            installHooks()
        } else {
            core.hooksUninstall()
            hooksChoice = "declined" // removed on purpose: don't put them back on the next launch
            alert("已移除 Melon Office 的 hooks", "~/.claude/settings.json 里的其它配置原样保留。")
        }
        refreshDesktopSettings()
    }

    private func installHooks() {
        let r = core.hooksInstall(port: port, approvals: approvalsOn)
        hooksChoice = "accepted"
        var info = "写入：\(r["file"] as? String ?? "~/.claude/settings.json")"
        if let backup = r["backup"] as? String { info += "\n原配置已备份：\(backup)" }
        alert("已接入 Claude Code", info + "\n\n之后新开的 Claude Code 会话会自动走进工区。")
    }

    /// "accepted" | "declined" | nil (never asked). Older versions only remembered that they had asked.
    private var hooksChoice: String? {
        get { defaults.string(forKey: "hooksChoice") ?? (defaults.bool(forKey: "askedHooks") ? "declined" : nil) }
        set { defaults.set(newValue, forKey: "hooksChoice") }
    }

    /// every launch: make sure Claude Code is wired up the way this version expects
    ///   current → nothing; stale (older version, other port) → update quietly, keeping the approvals choice;
    ///   none → ask once, and never again after 以后再说 or 移除; unreadable settings.json → leave it alone
    private func reconcileHooks() {
        switch core.hooksState(port: port) {
        case "current":
            hooksChoice = "accepted"
        case "stale":
            hooksChoice = "accepted" // our hooks are there, so the user connected us at some point
            if core.hooksRepair(port: port) {
                notifier.info("已更新 Claude Code 接入", "~/.claude/settings.json 里 Melon Office 的 hooks 已更新到当前版本，其它配置原样保留。")
            }
        case "none":
            if hooksChoice == nil { offerHooks() }
        default:
            NSLog("[melon] ~/.claude/settings.json 不是合法的 JSON，跳过 hooks 检查")
        }
    }

    private func offerHooks() {
        hooksChoice = "declined" // until they click 接入
        let a = NSAlert()
        a.messageText = "接入 Claude Code？"
        a.informativeText = "Melon Office 会在 ~/.claude/settings.json 里加几条 hooks（先备份原文件），Claude Code 的会话才能走进工区。随时可以在「设置 → 接入」里关闭。"
        a.addButton(withTitle: "接入")
        a.addButton(withTitle: "以后再说")
        NSApp.activate(ignoringOtherApps: true)
        if a.runModal() == .alertFirstButtonReturn { installHooks() }
    }

    @objc private func showUpdate() {
        updater.prompt()
    }

    @objc private func checkForUpdates() {
        updater.check(manual: true)
    }

    private func setLaunchAtLogin(_ enabled: Bool) {
        do {
            if enabled { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
        } catch {
            alert("没能设置开机自启", "\(error.localizedDescription)\n把 Melon Office 放进「应用程序」文件夹后再试试。")
        }
        refreshDesktopSettings()
    }

    private func refreshDesktopSettings() {
        store.desktop = DesktopPreferences(staff: staff, widgetWidth: widgetWidth,
            launchAtLogin: SMAppService.mainApp.status == .enabled,
            claudeState: core.hooksState(port: port), problem: problem, version: updater.currentVersion)
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }

    private func alert(_ title: String, _ info: String) {
        let a = NSAlert()
        a.messageText = title
        a.informativeText = info
        NSApp.activate(ignoringOtherApps: true)
        a.runModal()
    }

    private func fatal(_ message: String) {
        alert("Melon Office 打不开", message)
        NSApp.terminate(nil)
    }
}

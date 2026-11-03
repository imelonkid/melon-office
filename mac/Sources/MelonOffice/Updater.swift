import AppKit
import Foundation

/// Checks for updates (project baseline "desktop app · client updates"): reads latest.json from the download site
/// and offers the newer version.
/// - 10 s after launch, then every 6 hours and 30 s after the Mac wakes; failures are silent and retried next time
/// - 检查更新… in the menu checks right away and always reports the result, even for a skipped version
/// - only a `version` strictly greater than CFBundleShortVersionString counts; local builds (CFBundleVersion dev-…) don't check
/// - each new version prompts once (download / skip this version / later); the menu keeps showing it until updated
/// Everything runs on the main thread: the network callback hops back to main before touching state or showing alerts.
final class Updater {
    /// latest.json fields (baseline contract: fields are only ever added)
    struct Release: Decodable, Equatable {
        let version: String
        let tag: String
        let notes: String?
        let files: [String: String]

        var download: URL? {
            #if arch(arm64)
            let arch = "arm64"
            #else
            let arch = "x86_64"
            #endif
            return (files[arch] ?? files["arm64"] ?? files.values.first).flatMap(URL.init(string:))
        }
    }

    static let manifestURL = URL(string: "https://melon-download.oss-cn-beijing.aliyuncs.com/melon-office/desktop/latest.json")!

    private(set) var available: Release?
    private let defaults = UserDefaults.standard
    private let skipKey = "update.skippedVersion"
    private var prompted: Set<String> = []
    private var timer: Timer?
    private var wakeObserver: NSObjectProtocol?

    var currentVersion: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0" }
    private var isDevBuild: Bool { (Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "dev").hasPrefix("dev") }

    func start() {
        guard !isDevBuild, timer == nil else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in self?.check() }
        timer = Timer.scheduledTimer(withTimeInterval: 6 * 3600, repeats: true) { [weak self] _ in self?.check() }
        // the network needs a moment after waking up
        wakeObserver = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
            DispatchQueue.main.asyncAfter(deadline: .now() + 30) { self?.check() }
        }
    }

    /// manual: from the menu, so always tell the user what happened
    func check(manual: Bool = false) {
        var req = URLRequest(url: Self.manifestURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        req.setValue("MelonOffice/\(currentVersion)", forHTTPHeaderField: "User-Agent")
        URLSession.shared.dataTask(with: req) { [weak self] data, resp, _ in
            let rel = (resp as? HTTPURLResponse)?.statusCode == 200 ? data.flatMap { try? JSONDecoder().decode(Release.self, from: $0) } : nil
            DispatchQueue.main.async { self?.received(rel, manual: manual) }
        }.resume()
    }

    private func received(_ rel: Release?, manual: Bool) {
        guard let rel else {
            if manual { notice("检查更新失败", "读不到版本信息，检查一下网络后再试。") }
            return
        }
        guard Self.newer(rel.version, than: currentVersion) else {
            available = nil
            if manual { notice("已是最新", "当前 v\(currentVersion) 已是最新版本。") }
            return
        }
        available = rel
        if manual || (defaults.string(forKey: skipKey) != rel.version && !prompted.contains(rel.version)) {
            prompted.insert(rel.version)
            prompt()
        }
    }

    /// release notes + 下载 / 跳过这个版本 / 以后再说 (also what the menu's 有新版本 item opens)
    func prompt() {
        guard let rel = available else { return }
        let a = NSAlert()
        a.messageText = "Melon Office \(rel.tag) 可以更新了"
        let notes = (rel.notes ?? "").isEmpty ? "" : "更新内容：\n\(rel.notes!)\n\n"
        a.informativeText = "当前版本 v\(currentVersion)。\n\n\(notes)下载后打开安装包，把 Melon Office 拖到「应用程序」覆盖即可。"
        a.addButton(withTitle: "下载")
        a.addButton(withTitle: "以后再说")
        a.addButton(withTitle: "跳过这个版本")
        NSApp.activate(ignoringOtherApps: true)
        switch a.runModal() {
        case .alertFirstButtonReturn: if let url = rel.download { NSWorkspace.shared.open(url) }
        case .alertThirdButtonReturn: defaults.set(rel.version, forKey: skipKey)
        default: break
        }
    }

    private func notice(_ title: String, _ info: String) {
        let a = NSAlert()
        a.messageText = title
        a.informativeText = info
        NSApp.activate(ignoringOtherApps: true)
        a.runModal()
    }

    /// semantic version compare on X.Y.Z (both sides come from tags, no pre-release suffixes)
    static func newer(_ a: String, than b: String) -> Bool {
        func parts(_ s: String) -> [Int] {
            let p = s.split(separator: ".").prefix(3).map { Int($0) ?? 0 }
            return p + Array(repeating: 0, count: 3 - p.count)
        }
        return parts(b).lexicographicallyPrecedes(parts(a))
    }
}

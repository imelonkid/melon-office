import Foundation
import JavaScriptCore

/// Runs the bundled office logic (mac/core/entry.js -> core.js) in JavaScriptCore.
/// Everything happens on the main thread: timers are main run loop timers, and callers are on main.
final class MelonCore {
    private let ctx = JSContext()!
    private var timers: [Int: Timer] = [:]
    private var nextTimer = 0

    var onState: ((String) -> Void)?
    var onPermissionDone: ((Int, String) -> Void)?

    init(script: String, homeDirectory: String = NSHomeDirectory()) {
        ctx.exceptionHandler = { _, err in NSLog("[melon core] %@", err?.toString() ?? "?") }
        let native = JSValue(newObjectIn: ctx)!
        func expose(_ name: String, _ block: Any) {
            native.setObject(block, forKeyedSubscript: name as NSString)
        }

        let setTimer: @convention(block) (JSValue, Double, Bool) -> Int = { [unowned self] fn, ms, repeats in
            self.nextTimer += 1
            let id = self.nextTimer
            let timer = Timer(timeInterval: max(ms, 0) / 1000, repeats: repeats) { [unowned self] _ in
                if !repeats { self.timers[id] = nil }
                fn.call(withArguments: [])
            }
            RunLoop.main.add(timer, forMode: .common) // keep ticking while a menu is open
            self.timers[id] = timer
            return id
        }
        let clearTimer: @convention(block) (Int) -> Void = { [unowned self] id in
            self.timers.removeValue(forKey: id)?.invalidate()
        }
        let stateChanged: @convention(block) (String) -> Void = { [unowned self] json in self.onState?(json) }
        let permissionDone: @convention(block) (Int, String) -> Void = { [unowned self] ticket, decision in
            self.onPermissionDone?(ticket, decision)
        }
        let log: @convention(block) (String) -> Void = { NSLog("[melon core] %@", $0) }

        // files, for hooks-config.mjs
        let fm = FileManager.default
        func fileError(_ error: Error) {
            let context = JSContext.current()!
            context.exception = JSValue(newErrorFromMessage: error.localizedDescription, in: context)
        }
        let fileExists: @convention(block) (String) -> Bool = { fm.fileExists(atPath: $0) }
        let readFile: @convention(block) (String) -> String = { path in
            do { return try String(contentsOfFile: path, encoding: .utf8) }
            catch { fileError(error); return "" } // JS exception prevents this value from being consumed.
        }
        let writeFile: @convention(block) (String, String) -> Void = { path, text in
            do { try text.write(toFile: path, atomically: true, encoding: .utf8) } catch { fileError(error) }
        }
        let mkdirp: @convention(block) (String) -> Void = { path in
            do { try fm.createDirectory(atPath: path, withIntermediateDirectories: true) } catch { fileError(error) }
        }
        let copyFile: @convention(block) (String, String) -> Void = { source, destination in
            do { try fm.copyItem(atPath: source, toPath: destination) } catch { fileError(error) }
        }
        let homedir: @convention(block) () -> String = { homeDirectory }

        expose("setTimer", setTimer)
        expose("clearTimer", clearTimer)
        expose("stateChanged", stateChanged)
        expose("permissionDone", permissionDone)
        expose("log", log)
        expose("fileExists", fileExists)
        expose("readFile", readFile)
        expose("writeFile", writeFile)
        expose("mkdirp", mkdirp)
        expose("copyFile", copyFile)
        expose("homedir", homedir)
        ctx.setObject(native, forKeyedSubscript: "native" as NSString)
        ctx.evaluateScript(script)
    }

    @discardableResult
    private func call(_ method: String, _ args: [Any] = []) -> JSValue? {
        ctx.objectForKeyedSubscript("MelonCore")?.invokeMethod(method, withArguments: args)
    }

    private func callJSON(_ method: String, _ args: [Any] = []) -> [String: Any] {
        guard let text = call(method, args)?.toString(), let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        return obj
    }

    func start(staff: Int) { call("start", [staff]) }
    @discardableResult
    func hook(_ json: String, provider: String = "claude") -> Bool { call("hook", [json, provider])?.toBool() ?? false }
    func permission(_ json: String, ticket: Int, provider: String = "claude") -> Bool { call("permission", [json, ticket, provider])?.toBool() ?? false }
    func decide(_ id: String, _ behavior: String) { call("decide", [id, behavior]) }
    func setApprovals(_ enabled: Bool) { call("setApprovals", [enabled]) }
    func setClients(_ n: Int) { call("setClients", [n]) }
    func snapshot() -> String { call("snapshot")?.toString() ?? "{}" }

    // settings (shared with the CLI via ~/.config/melon-office/settings.json) and the HTML daily report
    func setSettings(_ s: Settings) {
        let json = (try? JSONSerialization.data(withJSONObject: ["officeName": s.officeName, "reportDir": s.reportDir])).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        call("setSettings", [json])
    }
    func saveReport() -> String? { call("saveReport")?.toString() }

    // Codex uses its own hooks.json, never auth.json or config.toml.
    private var codexHome: String { ProcessInfo.processInfo.environment["CODEX_HOME"] ?? "" }
    func hooksInstall(port: Int, approvals: Bool, provider: String = "claude") -> [String: Any] { callJSON("hooksInstall", [port, approvals, provider, codexHome]) }
    func hooksUninstall(provider: String = "claude") -> [String: Any] { callJSON("hooksUninstall", [provider, codexHome]) }
    func hooksEvents(provider: String = "claude") -> [String] { callJSON("hooksStatus", [provider, codexHome])["events"] as? [String] ?? [] }
    /// "none" | "current" | "stale" | "unreadable" (see hooks-config.mjs check())
    func hooksState(port: Int, provider: String = "claude") -> String { callJSON("hooksCheck", [port, provider, codexHome])["state"] as? String ?? "unreadable" }
    /// updates stale hooks in place, keeping whether approvals were connected; true if it changed anything
    func hooksRepair(port: Int, provider: String = "claude") -> Bool { callJSON("hooksRepair", [port, provider, codexHome])["repaired"] as? Bool ?? false }
}

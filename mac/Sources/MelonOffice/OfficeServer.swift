import AppKit
import CryptoKit
import Foundation
import Network

/// The local bridge, same endpoints as server/index.mjs so the Claude Code hooks don't care which one runs:
///   POST /hook             passive hook events
///   POST /hook/permission  held open until someone answers in the office (or it times out)
///   /api/*                 state, decisions, approvals switch (local pages only)
///   /ws                    live state for the office pages
///   GET *                  the built web UI
/// Binds to 127.0.0.1 only: hook payloads contain your code, commands and file paths.
final class OfficeServer {
    let port: UInt16
    private let dist: URL
    private let core: MelonCore
    private var listener: NWListener?
    private var open: [ObjectIdentifier: Connection] = [:] // keeps connections alive until they close
    private var sockets: [ObjectIdentifier: Connection] = [:]
    private var waiting: [Int: Connection] = [:]
    private var nextTicket = 0
    private var lastState = "{}"
    private var lastReport: String?

    var onSocketsChanged: (() -> Void)?
    var socketCount: Int { sockets.count }

    init(port: UInt16, dist: URL, core: MelonCore) {
        self.port = port
        self.dist = dist.standardizedFileURL
        self.core = core
        core.onPermissionDone = { [weak self] ticket, decision in self?.finishPermission(ticket, decision) }
    }

    /// Calls back with nil once listening, or a message when the port can't be used.
    func start(_ done: @escaping (String?) -> Void) {
        let params = NWParameters.tcp
        params.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: port)!)
        params.allowLocalEndpointReuse = true
        do {
            let l = try NWListener(using: params)
            l.newConnectionHandler = { [weak self] c in self?.accept(c) }
            l.stateUpdateHandler = { state in
                switch state {
                case .ready: done(nil)
                case .failed(let err):
                    if case .posix(let code) = err, code == .EADDRINUSE {
                        done("端口 \(self.port) 被占用，可能命令行版 melon-office 正在运行")
                    } else {
                        done("服务启动失败：\(err)")
                    }
                default: break
                }
            }
            l.start(queue: .main)
            listener = l
        } catch {
            done("服务启动失败：\(error)")
        }
    }

    func broadcast(_ state: String) {
        lastState = state
        let msg = #"{"type":"state","state":"# + state + "}"
        for s in sockets.values { s.sendText(msg) }
    }

    // MARK: - connections

    private func accept(_ c: NWConnection) {
        let conn = Connection(c)
        conn.onData = { [weak self, unowned conn] in self?.process(conn) }
        conn.onClose = { [weak self, unowned conn] in
            guard let self else { return }
            self.open[ObjectIdentifier(conn)] = nil
            if self.sockets.removeValue(forKey: ObjectIdentifier(conn)) != nil { self.onSocketsChanged?() }
        }
        open[ObjectIdentifier(conn)] = conn
        conn.start()
    }

    private func process(_ conn: Connection) {
        if conn.isSocket {
            while let (opcode, payload) = conn.nextFrame() { socketMessage(conn, opcode, payload) }
            return
        }
        guard let req = conn.nextRequest() else { return }
        route(conn, req)
    }

    private func route(_ conn: Connection, _ req: Request) {
        let path = req.path
        switch (req.method, path) {
        case ("POST", "/hook"):
            if let body = String(data: req.body, encoding: .utf8), isJSONObject(req.body) { core.hook(body) }
            return conn.respond(200, json: "{}")
        case ("POST", "/hook/permission"):
            guard let body = String(data: req.body, encoding: .utf8), isJSONObject(req.body) else {
                return conn.respond(400, json: #"{"error":"bad json"}"#)
            }
            nextTicket += 1
            waiting[nextTicket] = conn
            core.permission(body, ticket: nextTicket)
            return
        case ("GET", "/ws"):
            guard req.isLocal, let key = req.headers["sec-websocket-key"], req.headers["upgrade"]?.lowercased() == "websocket" else {
                return conn.close()
            }
            conn.upgrade(key: key)
            sockets[ObjectIdentifier(conn)] = conn
            conn.sendText(#"{"type":"state","state":"# + core.snapshot() + "}")
            onSocketsChanged?()
            return
        default: break
        }
        if path.hasPrefix("/api/") {
            guard req.isLocal else { return conn.respond(403, json: #"{"error":"forbidden"}"#) }
            let body = (try? JSONSerialization.jsonObject(with: req.body) as? [String: Any]) ?? [:]
            switch (req.method, path) {
            case ("GET", "/api/state"): return conn.respond(200, json: core.snapshot())
            case ("POST", "/api/decision"):
                core.decide(body["id"] as? String ?? "", body["behavior"] as? String ?? "")
                return conn.respond(200, json: #"{"ok":true}"#)
            case ("POST", "/api/approvals"):
                core.setApprovals(body["enabled"] as? Bool ?? false)
                return conn.respond(200, json: #"{"ok":true}"#)
            case ("POST", "/api/settings"):
                core.setSettings(Settings(officeName: body["officeName"] as? String ?? "", reportDir: body["reportDir"] as? String ?? ""))
                return conn.respond(200, json: #"{"ok":true}"#)
            case ("POST", "/api/report"):
                guard let file = core.saveReport(), FileManager.default.fileExists(atPath: file) else {
                    return conn.respond(400, json: #"{"error":"report not saved"}"#)
                }
                lastReport = file
                let out = (try? JSONSerialization.data(withJSONObject: ["ok": true, "file": file])).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
                return conn.respond(200, json: out)
            // opens the last saved report (never an arbitrary path from the page)
            case ("POST", "/api/report/open"):
                guard let lastReport else { return conn.respond(404, json: #"{"error":"no report yet"}"#) }
                NSWorkspace.shared.open(URL(fileURLWithPath: lastReport))
                return conn.respond(200, json: #"{"ok":true}"#)
            default: return conn.respond(404, json: #"{"error":"not found"}"#)
            }
        }
        if req.method == "GET" { return serveStatic(conn, path) }
        conn.respond(405, json: "{}")
    }

    private func finishPermission(_ ticket: Int, _ decision: String) {
        guard let conn = waiting.removeValue(forKey: ticket) else { return }
        if decision.isEmpty { return conn.respond(200, json: "{}") }
        conn.respond(200, json: #"{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":""# + decision + #""}}}"#)
    }

    private func socketMessage(_ conn: Connection, _ opcode: UInt8, _ payload: Data) {
        guard opcode == 1,
              let msg = try? JSONSerialization.jsonObject(with: payload) as? [String: Any] else { return }
        switch msg["type"] as? String {
        case "decision": core.decide(msg["id"] as? String ?? "", msg["behavior"] as? String ?? "")
        case "approvals": core.setApprovals(msg["enabled"] as? Bool ?? false)
        default: break
        }
    }

    private static let mime: [String: String] = [
        "html": "text/html; charset=utf-8", "js": "text/javascript", "css": "text/css", "png": "image/png",
        "json": "application/json", "svg": "image/svg+xml", "woff2": "font/woff2", "ico": "image/x-icon",
    ]

    private func serveStatic(_ conn: Connection, _ path: String) {
        var file = dist.appendingPathComponent(path.removingPercentEncoding ?? path).standardizedFileURL
        guard file.path.hasPrefix(dist.path) else { return conn.respond(403, json: "{}") }
        var isDir: ObjCBool = false
        if !FileManager.default.fileExists(atPath: file.path, isDirectory: &isDir) || isDir.boolValue {
            file = dist.appendingPathComponent("index.html")
        }
        guard let data = try? Data(contentsOf: file) else { return conn.respond(404, json: "{}") }
        conn.respond(200, type: Self.mime[file.pathExtension] ?? "application/octet-stream", body: data)
    }

    private func isJSONObject(_ data: Data) -> Bool {
        (try? JSONSerialization.jsonObject(with: data)) is [String: Any]
    }
}

// MARK: - HTTP / WebSocket plumbing

struct Request {
    let method: String
    let path: String
    let headers: [String: String]
    let body: Data

    /// Only pages served from this machine may drive the office.
    var isLocal: Bool {
        guard let origin = headers["origin"] else { return true }
        let host = URL(string: origin)?.host
        return host == "127.0.0.1" || host == "localhost"
    }
}

final class Connection {
    private let c: NWConnection
    private var buffer = Data()
    private(set) var isSocket = false
    private var closed = false
    var onData: (() -> Void)?
    var onClose: (() -> Void)?

    init(_ c: NWConnection) { self.c = c }

    func start() {
        c.stateUpdateHandler = { [weak self] state in
            switch state {
            case .failed, .cancelled: self?.close()
            default: break
            }
        }
        c.start(queue: .main)
        receive()
    }

    private func receive() {
        c.receive(minimumIncompleteLength: 1, maximumLength: 1 << 16) { [weak self] data, _, done, err in
            guard let self else { return }
            if let data, !data.isEmpty {
                self.buffer.append(data)
                if self.buffer.count > 4 << 20 { return self.close() }
                self.onData?()
            }
            if done || err != nil { self.close() } else if !self.closed { self.receive() }
        }
    }

    func close() {
        guard !closed else { return }
        closed = true
        c.cancel()
        onClose?()
    }

    // MARK: http

    func nextRequest() -> Request? {
        guard let end = buffer.range(of: Data("\r\n\r\n".utf8)),
              let head = String(data: buffer[buffer.startIndex..<end.lowerBound], encoding: .utf8) else { return nil }
        var lines = head.components(separatedBy: "\r\n")
        let first = lines.removeFirst().split(separator: " ")
        guard first.count >= 2 else { close(); return nil }
        var headers: [String: String] = [:]
        for line in lines {
            guard let i = line.firstIndex(of: ":") else { continue }
            headers[line[..<i].lowercased()] = line[line.index(after: i)...].trimmingCharacters(in: .whitespaces)
        }
        let length = Int(headers["content-length"] ?? "") ?? 0
        guard buffer.count - end.upperBound >= length else { return nil }
        let body = buffer.subdata(in: end.upperBound..<(end.upperBound + length))
        buffer.removeSubrange(buffer.startIndex..<(end.upperBound + length))
        let target = String(first[1])
        let path = String(target.split(separator: "?", maxSplits: 1).first ?? "/")
        return Request(method: String(first[0]), path: path, headers: headers, body: body)
    }

    func respond(_ status: Int, json: String) {
        respond(status, type: "application/json", body: Data(json.utf8))
    }

    func respond(_ status: Int, type: String, body: Data) {
        let reason = [200: "OK", 400: "Bad Request", 403: "Forbidden", 404: "Not Found", 405: "Method Not Allowed"][status] ?? "OK"
        var head = "HTTP/1.1 \(status) \(reason)\r\nContent-Type: \(type)\r\nContent-Length: \(body.count)\r\n"
        head += "Cache-Control: no-cache\r\nConnection: close\r\n\r\n"
        c.send(content: Data(head.utf8) + body, completion: .contentProcessed { [weak self] _ in self?.close() })
    }

    // MARK: websocket (RFC 6455, text frames only)

    func upgrade(key: String) {
        let digest = Insecure.SHA1.hash(data: Data((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").utf8))
        let accept = Data(digest).base64EncodedString()
        let head = "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: \(accept)\r\n\r\n"
        isSocket = true
        c.send(content: Data(head.utf8), completion: .contentProcessed { _ in })
    }

    func sendText(_ text: String) {
        sendFrame(opcode: 1, Data(text.utf8))
    }

    private func sendFrame(opcode: UInt8, _ payload: Data) {
        guard !closed else { return }
        var frame = Data([0x80 | opcode])
        let n = payload.count
        if n < 126 {
            frame.append(UInt8(n))
        } else if n < 65536 {
            frame.append(126)
            frame.append(contentsOf: [UInt8(n >> 8), UInt8(n & 0xff)])
        } else {
            frame.append(127)
            frame.append(contentsOf: (0..<8).reversed().map { UInt8((UInt64(n) >> (UInt64($0) * 8)) & 0xff) })
        }
        frame.append(payload)
        c.send(content: frame, completion: .contentProcessed { _ in })
    }

    /// Next complete client frame; answers pings and closes by itself.
    func nextFrame() -> (UInt8, Data)? {
        while true {
            let b = [UInt8](buffer.prefix(14))
            guard b.count >= 2 else { return nil }
            let opcode = b[0] & 0x0f
            let masked = b[1] & 0x80 != 0
            var len = Int(b[1] & 0x7f)
            var at = 2
            if len == 126 {
                guard b.count >= 4 else { return nil }
                len = Int(b[2]) << 8 | Int(b[3]); at = 4
            } else if len == 127 {
                guard b.count >= 10 else { return nil }
                len = (2..<10).reduce(0) { $0 << 8 | Int(b[$1]) }; at = 10
            }
            let maskAt = at
            if masked { at += 4 }
            guard buffer.count >= at + len else { return nil }
            let start = buffer.startIndex
            var payload = buffer.subdata(in: (start + at)..<(start + at + len))
            if masked {
                let mask = [UInt8](buffer.subdata(in: (start + maskAt)..<(start + maskAt + 4)))
                payload = Data(payload.enumerated().map { $0.element ^ mask[$0.offset % 4] })
            }
            buffer.removeSubrange(start..<(start + at + len))
            switch opcode {
            case 8: close(); return nil
            case 9: sendFrame(opcode: 10, payload)
            case 10: break
            default: return (opcode, payload)
            }
        }
    }
}

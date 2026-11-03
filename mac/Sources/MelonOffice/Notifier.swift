import Foundation
import UserNotifications

/// Approval requests as macOS notifications with 同意 / 驳回 buttons, so you can answer without
/// opening the office. A notification goes away by itself once the request is settled elsewhere.
final class Notifier: NSObject, UNUserNotificationCenterDelegate {
    private let center = UNUserNotificationCenter.current()
    private var shown = Set<String>()
    private(set) var authorized = false

    var onDecision: ((String, String) -> Void)?
    var onOpen: (() -> Void)?
    var onAuthorization: (() -> Void)?

    func setUp() {
        center.delegate = self
        let allow = UNNotificationAction(identifier: "allow", title: "同意")
        let deny = UNNotificationAction(identifier: "deny", title: "驳回", options: [.destructive])
        center.setNotificationCategories([UNNotificationCategory(identifier: "approval", actions: [allow, deny], intentIdentifiers: [])])
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            DispatchQueue.main.async {
                self.authorized = granted
                self.onAuthorization?()
            }
        }
    }

    struct Ask {
        let id: String
        let name: String
        let detail: String
    }

    /// `asks`: approvals currently held open for the office to answer.
    func update(_ asks: [Ask]) {
        let ids = Set(asks.map(\.id))
        let gone = shown.subtracting(ids)
        if !gone.isEmpty {
            center.removeDeliveredNotifications(withIdentifiers: Array(gone))
            center.removePendingNotificationRequests(withIdentifiers: Array(gone))
        }
        for ask in asks where !shown.contains(ask.id) && authorized {
            let content = UNMutableNotificationContent()
            content.title = "\(ask.name) 举手要审批"
            content.body = "想要：\(ask.detail)"
            content.categoryIdentifier = "approval"
            content.sound = .default
            center.add(UNNotificationRequest(identifier: ask.id, content: content, trigger: nil))
        }
        shown = ids
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) {
        done([.banner, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler done: @escaping () -> Void) {
        let id = response.notification.request.identifier
        let action = response.actionIdentifier
        DispatchQueue.main.async {
            if action == "allow" || action == "deny" { self.onDecision?(id, action) } else { self.onOpen?() }
            done()
        }
    }
}

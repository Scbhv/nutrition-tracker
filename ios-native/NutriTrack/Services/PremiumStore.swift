import Foundation

/// Premium rules:
/// - Free: logging, barcode scanning, food library, backups, Apple Health.
/// - Premium: AI lookup, goals editor per weekday, theme gallery, community submissions.
/// - Status is cached per user; a failed check never removes premium.
@MainActor
final class PremiumStore: ObservableObject {
    static let shared = PremiumStore()
    @Published private(set) var isPremium = false
    @Published private(set) var checking = false

    private let cloud = Cloud.shared
    private func cacheKey(_ uid: String) -> String { "premium.\(uid)" }

    private init() {
        if let uid = cloud.session?.userId {
            isPremium = UserDefaults.standard.bool(forKey: cacheKey(uid))
        }
    }

    func refresh() async {
        guard let uid = cloud.session?.userId else { isPremium = false; return }
        isPremium = UserDefaults.standard.bool(forKey: cacheKey(uid))
        checking = true
        defer { checking = false }
        do {
            let data = try await cloud.rest("rpc/is_premium", method: "POST", json: ["p_user_id": uid])
            let value = (try? JSONDecoder().decode(Bool.self, from: data)) ?? false
            // Never downgrade on an ambiguous answer; only upgrade or confirm.
            if value || !isPremium { set(value, uid: uid) }
        } catch {
            // Offline / server error: keep cached value.
        }
    }

    /// Returns a user-facing message.
    func unlock(code: String) async throws -> String {
        let result = try await cloud.invoke("verify-unlock-code", body: ["code": code.trimmingCharacters(in: .whitespaces)])
        if result["success"] as? Bool == true, let uid = cloud.session?.userId {
            set(true, uid: uid)
            return (result["message"] as? String) ?? "Premium unlocked!"
        }
        throw CloudError.server((result["error"] as? String) ?? "Invalid or expired code.")
    }

    private func set(_ value: Bool, uid: String) {
        isPremium = value
        UserDefaults.standard.set(value, forKey: cacheKey(uid))
    }
}

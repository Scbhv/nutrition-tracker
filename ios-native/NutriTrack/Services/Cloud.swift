import Foundation
import Security
import CryptoKit

/// Optional cloud: sign-in, premium status, AI lookup, community foods and theme packs.
/// The app never needs it to log food — every failure falls back to local data.
enum CloudConfig {
    static let url = URL(string: "https://patfcksfnfxuxypqgaxq.supabase.co")!
    /// Publishable key — safe to ship in the app.
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdGZja3NmbmZ4dXh5cHFnYXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTQzMzEsImV4cCI6MjA4NTc5MDMzMX0.tdmj6r9jbOOaCEl7mpq9nXi4V3bkKE8DSPbm9JOuGgs"
}

struct CloudSession: Codable {
    var accessToken: String
    var refreshToken: String
    var userId: String
    var email: String?
    var expiresAt: Date
}

enum CloudError: LocalizedError {
    case notSignedIn
    case server(String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Sign in with Apple first."
        case .server(let message): return message
        }
    }
}

@MainActor
final class Cloud: ObservableObject {
    static let shared = Cloud()
    @Published private(set) var session: CloudSession?

    private init() { session = Keychain.loadSession() }

    var isSignedIn: Bool { session != nil }

    // MARK: Auth

    /// `idToken` + raw `nonce` come from Sign in with Apple.
    func signInWithApple(idToken: String, nonce: String) async throws {
        let data = try await raw("auth/v1/token?grant_type=id_token", method: "POST",
                                 json: ["provider": "apple", "id_token": idToken, "nonce": nonce],
                                 token: nil)
        try storeSession(from: data)
    }

    func signOut() {
        session = nil
        Keychain.saveSession(nil)
    }

    private func storeSession(from data: Data) throws {
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let access = obj["access_token"] as? String,
              let refresh = obj["refresh_token"] as? String,
              let user = obj["user"] as? [String: Any],
              let id = user["id"] as? String else { throw CloudError.server("Sign-in failed.") }
        let expires = (obj["expires_in"] as? Double) ?? 3600
        session = CloudSession(accessToken: access, refreshToken: refresh, userId: id,
                               email: user["email"] as? String,
                               expiresAt: Date().addingTimeInterval(expires - 60))
        Keychain.saveSession(session)
    }

    func validToken() async throws -> String {
        guard let s = session else { throw CloudError.notSignedIn }
        if s.expiresAt > Date() { return s.accessToken }
        let data = try await raw("auth/v1/token?grant_type=refresh_token", method: "POST",
                                 json: ["refresh_token": s.refreshToken], token: nil)
        try storeSession(from: data)
        return session!.accessToken
    }

    // MARK: Requests

    func rest(_ path: String, method: String = "GET", json: Any? = nil,
              prefer: String? = nil) async throws -> Data {
        let token = isSignedIn ? try await validToken() : nil
        return try await raw("rest/v1/\(path)", method: method, json: json, token: token, prefer: prefer)
    }

    func invoke(_ function: String, body: [String: Any]) async throws -> [String: Any] {
        let data = try await raw("functions/v1/\(function)", method: "POST", json: body,
                                 token: try await validToken())
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    func publicFileURL(bucket: String, path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        return CloudConfig.url.appendingPathComponent("storage/v1/object/public/\(bucket)/\(path)")
    }

    private func raw(_ path: String, method: String, json: Any?, token: String?,
                     prefer: String? = nil) async throws -> Data {
        var req = URLRequest(url: URL(string: path, relativeTo: CloudConfig.url)!)
        req.httpMethod = method
        req.timeoutInterval = 20
        req.setValue(CloudConfig.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(token ?? CloudConfig.anonKey)", forHTTPHeaderField: "Authorization")
        if let prefer { req.setValue(prefer, forHTTPHeaderField: "Prefer") }
        if let json {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: json)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let msg = (obj?["error"] as? String) ?? (obj?["message"] as? String)
                ?? (obj?["error_description"] as? String) ?? "Request failed (\(status))."
            throw CloudError.server(msg)
        }
        return data
    }

    // MARK: Sign in with Apple nonce

    static func randomNonce() -> String {
        (0..<32).map { _ in String(format: "%02x", UInt8.random(in: 0...255)) }.joined()
    }

    static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

/// Session tokens live in the Keychain, never in plain files.
enum Keychain {
    private static let account = "nutritrack.session"

    static func saveSession(_ session: CloudSession?) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                   kSecAttrAccount as String: account]
        SecItemDelete(base as CFDictionary)
        guard let session, let data = try? JSONEncoder().encode(session) else { return }
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    static func loadSession() -> CloudSession? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrAccount as String: account,
                                    kSecReturnData as String: true]
        var out: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess,
              let data = out as? Data else { return nil }
        return try? JSONDecoder().decode(CloudSession.self, from: data)
    }
}

extension Nutrients {
    /// Builds from the web app / Open Food Facts style keys (`energy-kcal`, `proteins`, …), per 100 g.
    init(webKeys dict: [String: Any]) {
        func d(_ k: String) -> Double? {
            if let v = dict[k] as? Double { return v }
            if let v = dict[k] as? Int { return Double(v) }
            if let v = dict[k] as? String { return Double(v) }
            return nil
        }
        self.init()
        energyKcal = d("energy-kcal")
        proteins = d("proteins")
        carbohydrates = d("carbohydrates")
        sugars = d("sugars")
        fat = d("fat")
        saturatedFat = d("saturated-fat")
        fiber = d("fiber")
        salt = d("salt")
        water = d("water")
        let known: Set = ["energy-kcal", "proteins", "carbohydrates", "sugars", "fat",
                          "saturated-fat", "fiber", "salt", "water"]
        for key in dict.keys where !known.contains(key) {
            if let v = d(key) { extras[key] = v }
        }
    }

    var webKeys: [String: Double] {
        var out = extras
        out["energy-kcal"] = energyKcal; out["proteins"] = proteins
        out["carbohydrates"] = carbohydrates; out["sugars"] = sugars
        out["fat"] = fat; out["saturated-fat"] = saturatedFat
        out["fiber"] = fiber; out["salt"] = salt; out["water"] = water
        return out
    }
}

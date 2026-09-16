import Foundation

/// Settings search: synonym expansion, subsequence fuzzy matching, ranked
/// typeahead suggestions, and persistence of the last query.
enum SettingsSearch {
    private static let queryKey = "nutritrack.settings.query"

    static var lastQuery: String {
        get { UserDefaults.standard.string(forKey: queryKey) ?? "" }
        set {
            if newValue.isEmpty { UserDefaults.standard.removeObject(forKey: queryKey) }
            else { UserDefaults.standard.set(newValue, forKey: queryKey) }
        }
    }

    /// Any word in a group matches every other word in that group.
    static let synonymGroups: [[String]] = [
        ["backup", "restore", "save", "archive", "snapshot"],
        ["export", "download", "share", "save file"],
        ["import", "upload", "load", "merge"],
        ["appearance", "theme", "look", "style", "design", "skin", "texture"],
        ["color", "colour", "accent", "hue", "palette"],
        ["dark mode", "night mode", "dark"],
        ["goals", "targets", "limits", "macros"],
        ["nutrition", "nutrients", "vitamins", "minerals"],
        ["sign out", "log out", "logout", "leave"],
        ["account", "profile", "user", "login"],
        ["premium", "pro", "paid", "subscription", "unlock", "donation"],
        ["feedback", "contact", "support", "help", "bug", "issue", "report"],
        ["offline", "no internet", "airplane", "local"],
        ["error", "log", "crash", "debug", "diagnostics"],
        ["apple health", "healthkit", "health", "shortcuts"],
        ["delete", "remove", "erase", "wipe"],
        ["sync", "cloud", "icloud", "server"],
        ["food", "library", "database", "foods"],
        ["recipe", "recipes", "meal", "mealplan"],
        ["history", "undo", "activity", "recent"],
    ]

    static func expand(_ query: String) -> [String] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return [] }
        var out: Set<String> = [q]
        for group in synonymGroups where group.contains(where: { $0.contains(q) || q.contains($0) }) {
            group.forEach { out.insert($0) }
        }
        return Array(out)
    }

    /// Substring first, then an in-order subsequence test ("bckp" → "backup").
    static func fuzzyMatch(_ needle: String, _ haystack: String) -> Bool {
        let n = needle.lowercased(), h = haystack.lowercased()
        if n.isEmpty { return true }
        if h.contains(n) { return true }
        guard n.count >= 3 else { return false }
        var i = n.startIndex
        for ch in h where ch == n[i] {
            i = n.index(after: i)
            if i == n.endIndex { return true }
        }
        return false
    }

    static func matches(query: String, keywords: [String]) -> Bool {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return true }
        let variants = expand(q)
        return keywords.contains { k in
            variants.contains { fuzzyMatch($0, k) || k.lowercased().contains($0) }
        }
    }

    struct Suggestion: Identifiable, Hashable {
        var id: String { label }
        let label: String
        let section: String
        let query: String
        let keywords: [String]
    }

    static let index: [Suggestion] = [
        .init(label: "Daily goals", section: "Goals & Nutrition", query: "goals",
              keywords: ["goals", "daily goals", "targets", "calories", "protein", "carbs", "fat", "fiber", "water"]),
        .init(label: "Serving size", section: "Goals & Nutrition", query: "serving",
              keywords: ["serving", "portion", "grams", "default"]),
        .init(label: "Per-weekday goals", section: "Goals & Nutrition", query: "weekday",
              keywords: ["weekday", "weekly", "day", "monday", "override"]),
        .init(label: "Nutrient library", section: "Goals & Nutrition", query: "nutrient library",
              keywords: ["nutrient library", "json", "import", "export", "foods"]),
        .init(label: "Theme & appearance", section: "Appearance", query: "appearance",
              keywords: ["appearance", "theme", "dark mode", "color", "accent"]),
        .init(label: "Apple Health export", section: "Data & Sync", query: "apple health",
              keywords: ["apple health", "healthkit", "shortcuts", "export"]),
        .init(label: "Backup & restore", section: "Advanced", query: "backup",
              keywords: ["backup", "restore", "archive", "save", "import", "overwrite"]),
        .init(label: "Settings history & undo", section: "Advanced", query: "history",
              keywords: ["history", "undo", "activity", "recent", "revert"]),
        .init(label: "Delete all data", section: "Advanced", query: "delete",
              keywords: ["delete", "erase", "wipe", "reset"]),
    ]

    /// Label prefix 100, label contains 80, keyword contains 60, fuzzy 30.
    static func suggestions(for query: String, limit: Int = 5) -> [Suggestion] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return [] }
        return index.compactMap { item -> (Suggestion, Int)? in
            let label = item.label.lowercased()
            let score: Int
            if label.hasPrefix(q) { score = 100 }
            else if label.contains(q) { score = 80 }
            else if item.keywords.contains(where: { $0.lowercased().contains(q) }) { score = 60 }
            else if matches(query: q, keywords: [item.label] + item.keywords) { score = 30 }
            else { return nil }
            return (item, score)
        }
        .sorted { $0.1 > $1.1 }
        .prefix(limit)
        .map(\.0)
    }

    /// Highlights every occurrence of `query` inside `text`.
    static func highlighted(_ text: String, query: String) -> AttributedString {
        var attributed = AttributedString(text)
        let q = query.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return attributed }
        var search = attributed.startIndex..<attributed.endIndex
        while let range = attributed[search].range(of: q, options: .caseInsensitive) {
            attributed[range].backgroundColor = .yellow.opacity(0.35)
            attributed[range].inlinePresentationIntent = .stronglyEmphasized
            guard range.upperBound < attributed.endIndex else { break }
            search = range.upperBound..<attributed.endIndex
        }
        return attributed
    }
}

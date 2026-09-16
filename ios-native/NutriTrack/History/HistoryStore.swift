import Foundation

enum HistoryKind: String, Codable, CaseIterable {
    case search, restore, delete, edit
}

struct HistoryEntry: Codable, Identifiable, Hashable {
    var id = UUID()
    var at = Date()
    var kind: HistoryKind
    var title: String
    var detail: String?
    /// Key into `UndoRegistry`. Absent = not undoable.
    var undoHandler: String?
    /// JSON-encoded snapshot handed back to the handler.
    var undoPayload: Data?
    var undone = false
}

/// Screens register the closures that can reverse their actions. A handler that
/// isn't registered (because its screen isn't on-screen) disables Undo instead
/// of silently doing nothing.
@MainActor
final class UndoRegistry: ObservableObject {
    static let shared = UndoRegistry()
    @Published private(set) var registered: Set<String> = []
    private var handlers: [String: (Data?) async throws -> Void] = [:]

    func register(_ name: String, _ fn: @escaping (Data?) async throws -> Void) {
        handlers[name] = fn
        registered.insert(name)
    }

    func unregister(_ name: String) {
        handlers[name] = nil
        registered.remove(name)
    }

    func has(_ name: String?) -> Bool {
        guard let name else { return false }
        return handlers[name] != nil
    }

    func run(_ name: String, payload: Data?) async throws {
        guard let fn = handlers[name] else {
            throw HistoryError.handlerMissing
        }
        try await fn(payload)
    }
}

enum HistoryError: LocalizedError {
    case handlerMissing
    case alreadyUndone

    var errorDescription: String? {
        switch self {
        case .handlerMissing: return "This action can only be undone from the Settings screen."
        case .alreadyUndone: return "Already undone."
        }
    }
}

/// Newest 60 entries, persisted to disk. When space runs short, payload-carrying
/// entries are dropped first and 20 headlines are kept.
@MainActor
final class HistoryStore: ObservableObject {
    static let shared = HistoryStore()

    @Published private(set) var entries: [HistoryEntry] = []

    private let maxEntries = 60
    private let store = JSONStore<[HistoryEntry]>(name: "history", fallback: [])
    private var lastSearchRecordedAt = Date.distantPast

    private init() {
        Task { entries = await store.load() }
    }

    private func persist() {
        entries = Array(entries.prefix(maxEntries))
        Task { await store.save(entries) }
    }

    func record(kind: HistoryKind, title: String, detail: String? = nil,
                undoHandler: String? = nil, payload: Encodable? = nil) {
        var data: Data?
        if let payload {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            data = try? encoder.encode(AnyEncodable(payload))
        }
        entries.insert(
            HistoryEntry(kind: kind, title: title, detail: detail,
                         undoHandler: undoHandler, undoPayload: data),
            at: 0
        )
        persist()
    }

    /// Repeating the same query in a row only refreshes the timestamp.
    func recordSearch(query: String, previous: String) {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        if let first = entries.first, first.kind == .search, first.title == trimmed {
            entries[0].at = Date()
            persist()
            return
        }
        record(kind: .search, title: trimmed, detail: "Settings search",
               undoHandler: "search", payload: SearchPayload(query: previous))
    }

    func canUndo(_ entry: HistoryEntry) -> Bool {
        !entry.undone && UndoRegistry.shared.has(entry.undoHandler)
    }

    func undo(_ entry: HistoryEntry) async throws {
        guard !entry.undone else { throw HistoryError.alreadyUndone }
        guard let handler = entry.undoHandler else { throw HistoryError.handlerMissing }
        try await UndoRegistry.shared.run(handler, payload: entry.undoPayload)
        if let idx = entries.firstIndex(where: { $0.id == entry.id }) {
            entries[idx].undone = true
            persist()
        }
    }

    func clear() {
        entries = []
        persist()
    }

    static func relativeTime(_ date: Date) -> String {
        let minutes = Int(Date().timeIntervalSince(date) / 60)
        if minutes < 1 { return "just now" }
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h ago" }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}

// MARK: - Payloads

struct SearchPayload: Codable { let query: String }
struct SettingsPayload: Codable { let settings: UserSettings }
struct FoodPayload: Codable { let food: FoodItem }
struct EntryPayload: Codable { let entry: FoodEntry; let dateKey: String }
struct BackupPayload: Codable { let bundle: Data }

private struct AnyEncodable: Encodable {
    let wrapped: Encodable
    init(_ wrapped: Encodable) { self.wrapped = wrapped }
    func encode(to encoder: Encoder) throws { try wrapped.encode(to: encoder) }
}

extension Data {
    func decoded<T: Decodable>(_ type: T.Type) throws -> T {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return try d.decode(T.self, from: self)
    }
}

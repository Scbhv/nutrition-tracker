import Foundation

/// Atomic, debounced JSON persistence in `Documents/NutriTrack/<name>.json`.
///
/// - Writes go to a `.tmp` sibling and are swapped in with `replaceItemAt`, so a
///   crash or power loss can never leave a half-written file.
/// - Saves are coalesced ~400 ms, so rapid edits cost one disk write.
/// - A file that fails to decode is preserved as `<name>.corrupt.json` and the
///   store starts empty instead of throwing data away silently.
actor JSONStore<Model: Codable & Sendable> {
    private let url: URL
    private let fallback: Model
    private var pending: Model?
    private var flushTask: Task<Void, Never>?

    private static var directory: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("NutriTrack", isDirectory: true)
    }

    init(name: String, fallback: Model) {
        self.url = Self.directory.appendingPathComponent("\(name).json")
        self.fallback = fallback
        try? FileManager.default.createDirectory(at: Self.directory, withIntermediateDirectories: true)
    }

    private var decoder: JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }

    private var encoder: JSONEncoder {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        e.outputFormatting = [.prettyPrinted, .sortedKeys]
        return e
    }

    func load() -> Model {
        guard let data = try? Data(contentsOf: url) else { return fallback }
        do {
            return try decoder.decode(Model.self, from: data)
        } catch {
            let corrupt = url.deletingPathExtension().appendingPathExtension("corrupt.json")
            try? FileManager.default.removeItem(at: corrupt)
            try? FileManager.default.moveItem(at: url, to: corrupt)
            return fallback
        }
    }

    /// Queue a save. Repeated calls within the debounce window collapse into one.
    func save(_ model: Model) {
        pending = model
        flushTask?.cancel()
        flushTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled else { return }
            await self?.flush()
        }
    }

    /// Write immediately — call on `scenePhase == .background`.
    func flush() {
        guard let model = pending else { return }
        pending = nil
        guard let data = try? encoder.encode(model) else { return }
        let tmp = url.appendingPathExtension("tmp")
        do {
            try data.write(to: tmp, options: .atomic)
            if FileManager.default.fileExists(atPath: url.path) {
                _ = try FileManager.default.replaceItemAt(url, withItemAt: tmp)
            } else {
                try FileManager.default.moveItem(at: tmp, to: url)
            }
            var resource = URLResourceValues()
            resource.isExcludedFromBackup = false
            var u = url
            try? u.setResourceValues(resource)
        } catch {
            try? FileManager.default.removeItem(at: tmp)
        }
    }
}

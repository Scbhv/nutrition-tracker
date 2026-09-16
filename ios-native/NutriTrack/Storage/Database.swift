import Foundation

/// The single source of truth: foods, logs and settings, each backed by its own
/// JSON document on disk. Every mutation persists, so data survives app
/// termination and device reboot.
@MainActor
final class Database: ObservableObject {
    @Published private(set) var foods: [FoodItem] = []
    @Published private(set) var logs: [String: DailyLog] = [:]
    @Published var settings = UserSettings() {
        didSet { Task { await settingsStore.save(settings) } }
    }

    private let foodStore = JSONStore<[FoodItem]>(name: "foods", fallback: [])
    private let logStore = JSONStore<[DailyLog]>(name: "logs", fallback: [])
    private let settingsStore = JSONStore<UserSettings>(name: "settings", fallback: UserSettings())

    // MARK: - Lifecycle

    func load() async {
        foods = await foodStore.load()
        let loaded = await logStore.load()
        logs = Dictionary(uniqueKeysWithValues: loaded.map { ($0.id, $0) })
        settings = await settingsStore.load()
        if foods.isEmpty { seedStarterFoods() }
    }

    func flush() async {
        await foodStore.flush()
        await logStore.flush()
        await settingsStore.flush()
    }

    private func persistFoods() { Task { await foodStore.save(foods) } }
    private func persistLogs() { Task { await logStore.save(Array(logs.values)) } }

    // MARK: - Foods

    func addFood(_ food: FoodItem) {
        foods.append(food)
        persistFoods()
    }

    @discardableResult
    func deleteFood(id: String) -> FoodItem? {
        guard let idx = foods.firstIndex(where: { $0.id == id }) else { return nil }
        let removed = foods.remove(at: idx)
        persistFoods()
        return removed
    }

    /// Dedupes by id first, then by barcode. Existing entries win.
    func mergeFoods(_ incoming: [FoodItem]) {
        var byId = Dictionary(uniqueKeysWithValues: foods.map { ($0.id, $0) })
        var barcodes = Set(foods.compactMap(\.barcode))
        for item in incoming {
            if byId[item.id] != nil { continue }
            if let code = item.barcode, barcodes.contains(code) { continue }
            byId[item.id] = item
            if let code = item.barcode { barcodes.insert(code) }
        }
        foods = byId.values.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        persistFoods()
    }

    func food(barcode: String) -> FoodItem? { foods.first { $0.barcode == barcode } }

    // MARK: - Logs

    func log(for date: Date) -> DailyLog {
        logs[DateKey.string(from: date)] ?? DailyLog(id: DateKey.string(from: date))
    }

    /// Logs `grams` of a food, storing the scaled nutrients on the entry itself.
    func logFood(_ food: FoodItem, grams: Double, on date: Date = Date()) {
        var day = log(for: date)
        day.foods.append(
            FoodEntry(foodId: food.id,
                      name: food.name,
                      grams: grams,
                      nutrients: food.nutrients.scaled(toGrams: grams))
        )
        logs[day.id] = day
        persistLogs()
    }

    @discardableResult
    func removeEntry(_ entryId: UUID, on date: Date) -> FoodEntry? {
        var day = log(for: date)
        guard let idx = day.foods.firstIndex(where: { $0.id == entryId }) else { return nil }
        let removed = day.foods.remove(at: idx)
        logs[day.id] = day
        persistLogs()
        return removed
    }

    func restoreEntry(_ entry: FoodEntry, on date: Date) {
        var day = log(for: date)
        day.foods.append(entry)
        logs[day.id] = day
        persistLogs()
    }

    func logExercise(_ exercise: ExerciseEntry, on date: Date = Date()) {
        var day = log(for: date)
        day.exercises.append(exercise)
        logs[day.id] = day
        persistLogs()
    }

    func goals(for date: Date) -> DailyGoals { settings.goals(for: date) }

    // MARK: - Backup

    func exportBundle() throws -> Data {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        return try encoder.encode(
            BackupBundle(foods: foods, logs: Array(logs.values), settings: settings)
        )
    }

    /// Replaces foods, logs and settings together. Rejects the whole file if it
    /// doesn't decode — never applies a backup partially.
    func importBundle(_ data: Data) throws {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let bundle = try decoder.decode(BackupBundle.self, from: data)
        foods = bundle.foods
        logs = Dictionary(uniqueKeysWithValues: bundle.logs.map { ($0.id, $0) })
        settings = bundle.settings
        persistFoods()
        persistLogs()
    }

    // MARK: - Seed

    private func seedStarterFoods() {
        func item(_ name: String, _ kcal: Double, _ p: Double, _ c: Double, _ f: Double,
                  _ fiber: Double, unit: (String, Double)? = nil) -> FoodItem {
            var n = Nutrients()
            n.energyKcal = kcal; n.proteins = p; n.carbohydrates = c; n.fat = f; n.fiber = fiber
            return FoodItem(
                name: name,
                nutrients: n,
                wholeUnits: unit.map { [WholeUnitPreset(label: $0.0, grams: $0.1)] } ?? []
            )
        }
        mergeFoods([
            item("Apple", 52, 0.3, 14, 0.2, 2.4, unit: ("1 medium apple", 182)),
            item("Banana", 89, 1.1, 23, 0.3, 2.6, unit: ("1 medium banana", 118)),
            item("Chicken breast", 165, 31, 0, 3.6, 0),
            item("Egg", 155, 13, 1.1, 11, 0, unit: ("1 large egg", 50)),
            item("Oats", 389, 17, 66, 7, 11),
            item("Whole milk", 61, 3.2, 4.8, 3.3, 0),
            item("Rice, cooked", 130, 2.7, 28, 0.3, 0.4),
            item("Almonds", 579, 21, 22, 50, 12.5),
            item("Wholegrain bread", 247, 13, 41, 3.4, 7, unit: ("1 slice", 32)),
            item("Greek yoghurt", 59, 10, 3.6, 0.4, 0),
        ])
    }
}

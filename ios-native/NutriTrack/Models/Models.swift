import Foundation

// MARK: - Nutrients

/// Nutrient values per 100 g. Missing values stay `nil` — never coerce to 0.
struct Nutrients: Codable, Hashable {
    var energyKcal: Double?
    var proteins: Double?
    var carbohydrates: Double?
    var sugars: Double?
    var fat: Double?
    var saturatedFat: Double?
    var fiber: Double?
    var salt: Double?
    var water: Double?
    /// Vitamins / minerals / user-defined nutrients, keyed by nutrient id.
    var extras: [String: Double] = [:]

    static let empty = Nutrients()

    func scaled(toGrams grams: Double) -> Nutrients {
        let f = grams / 100.0
        var out = Nutrients()
        out.energyKcal = energyKcal.map { $0 * f }
        out.proteins = proteins.map { $0 * f }
        out.carbohydrates = carbohydrates.map { $0 * f }
        out.sugars = sugars.map { $0 * f }
        out.fat = fat.map { $0 * f }
        out.saturatedFat = saturatedFat.map { $0 * f }
        out.fiber = fiber.map { $0 * f }
        out.salt = salt.map { $0 * f }
        out.water = water.map { $0 * f }
        out.extras = extras.mapValues { $0 * f }
        return out
    }

    static func + (lhs: Nutrients, rhs: Nutrients) -> Nutrients {
        func add(_ a: Double?, _ b: Double?) -> Double? {
            if a == nil && b == nil { return nil }
            return (a ?? 0) + (b ?? 0)
        }
        var out = Nutrients()
        out.energyKcal = add(lhs.energyKcal, rhs.energyKcal)
        out.proteins = add(lhs.proteins, rhs.proteins)
        out.carbohydrates = add(lhs.carbohydrates, rhs.carbohydrates)
        out.sugars = add(lhs.sugars, rhs.sugars)
        out.fat = add(lhs.fat, rhs.fat)
        out.saturatedFat = add(lhs.saturatedFat, rhs.saturatedFat)
        out.fiber = add(lhs.fiber, rhs.fiber)
        out.salt = add(lhs.salt, rhs.salt)
        out.water = add(lhs.water, rhs.water)
        out.extras = lhs.extras.merging(rhs.extras, uniquingKeysWith: +)
        return out
    }
}

// MARK: - Whole-unit presets

/// "1 apple", "1 slice of bread" — average edible weights in grams.
struct WholeUnitPreset: Codable, Hashable, Identifiable {
    var id: String { label }
    let label: String
    let grams: Double
}

// MARK: - Food

struct RecipeIngredient: Codable, Hashable, Identifiable {
    var id: UUID = UUID()
    var foodId: String?
    var name: String
    var grams: Double
}

struct RecipeInfo: Codable, Hashable {
    var ingredients: [RecipeIngredient] = []
    var servings: Int = 1
    var instructions: String = ""
    var prepTimeMinutes: Int?
    var tags: [String] = []
}

struct FoodItem: Codable, Hashable, Identifiable {
    var id: String = UUID().uuidString
    var name: String
    var brand: String?
    var barcode: String?
    /// Always per 100 g.
    var nutrients: Nutrients
    var wholeUnits: [WholeUnitPreset] = []
    var recipe: RecipeInfo?
    var createdAt: Date = Date()

    var isRecipe: Bool { recipe != nil }
}

// MARK: - Logs

/// Entries store denormalized nutrient values, so editing or deleting a food
/// never rewrites history.
struct FoodEntry: Codable, Hashable, Identifiable {
    var id: UUID = UUID()
    var foodId: String?
    var name: String
    var grams: Double
    /// Nutrients for this exact portion (already scaled).
    var nutrients: Nutrients
    var loggedAt: Date = Date()
}

struct ExerciseEntry: Codable, Hashable, Identifiable {
    var id: UUID = UUID()
    var name: String
    var burnedKcal: Double
    var loggedAt: Date = Date()
}

struct DailyLog: Codable, Hashable, Identifiable {
    /// `yyyy-MM-dd`
    var id: String
    var foods: [FoodEntry] = []
    var exercises: [ExerciseEntry] = []

    var totals: Nutrients { foods.reduce(Nutrients.empty) { $0 + $1.nutrients } }
    var burnedKcal: Double { exercises.reduce(0) { $0 + $1.burnedKcal } }
    /// Net calories = eaten − burned.
    var netKcal: Double { (totals.energyKcal ?? 0) - burnedKcal }
}

// MARK: - Settings

struct DailyGoals: Codable, Hashable {
    var energyKcal: Double = 2000
    var proteins: Double = 50
    var carbohydrates: Double = 300
    var fat: Double = 65
    var fiber: Double = 25
    var water: Double = 2000
    /// Goals for user-defined nutrients.
    var extras: [String: Double] = [:]
}

struct UserSettings: Codable, Hashable {
    var dailyGoals = DailyGoals()
    var weekdayGoalsEnabled = false
    /// Weekday index 1 (Sunday) … 7 (Saturday) → override.
    var weekdayGoals: [Int: DailyGoals] = [:]
    var defaultServingSize: Double = 100
    var hiddenNutrients: [String] = []
    var customNutrients: [String] = []

    func goals(for date: Date) -> DailyGoals {
        guard weekdayGoalsEnabled else { return dailyGoals }
        let wd = Calendar.current.component(.weekday, from: date)
        return weekdayGoals[wd] ?? dailyGoals
    }
}

// MARK: - Backup bundle

struct BackupBundle: Codable {
    var foods: [FoodItem]
    var logs: [DailyLog]
    var settings: UserSettings
    var exportedAt: Date = Date()
    var version: Int = 1
}

enum DateKey {
    static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func string(from date: Date) -> String { formatter.string(from: date) }
}

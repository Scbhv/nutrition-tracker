import Foundation
import HealthKit

/// Writes food intake to Apple Health. Each nutrient sample carries a sync
/// identifier (entry id + nutrient), so re-syncing replaces instead of duplicating,
/// and deleting a log entry removes its samples.
///
/// Health has no place for nutrition *goals*; goals are written as metadata on a
/// daily summary energy sample and shown in-app next to what Health reports.
@MainActor
final class HealthKitService: ObservableObject {
    static let shared = HealthKitService()
    private let store = HKHealthStore()

    @Published var enabled = UserDefaults.standard.bool(forKey: "health.enabled") {
        didSet { UserDefaults.standard.set(enabled, forKey: "health.enabled") }
    }
    @Published private(set) var lastSync: Date? = UserDefaults.standard.object(forKey: "health.lastSync") as? Date
    @Published private(set) var lastReport: [String] = []

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    /// Internal key → (HealthKit type, unit, multiplier from grams/kcal stored in app).
    private let map: [(String, HKQuantityTypeIdentifier, HKUnit, Double)] = [
        ("energy-kcal", .dietaryEnergyConsumed, .kilocalorie(), 1),
        ("proteins", .dietaryProtein, .gram(), 1),
        ("carbohydrates", .dietaryCarbohydrates, .gram(), 1),
        ("fat", .dietaryFatTotal, .gram(), 1),
        ("saturated-fat", .dietaryFatSaturated, .gram(), 1),
        ("sugars", .dietarySugar, .gram(), 1),
        ("fiber", .dietaryFiber, .gram(), 1),
        ("water", .dietaryWater, .literUnit(with: .milli), 1),
        ("sodium", .dietarySodium, .gram(), 1),
        ("calcium", .dietaryCalcium, .gramUnit(with: .milli), 1),
        ("iron", .dietaryIron, .gramUnit(with: .milli), 1),
        ("potassium", .dietaryPotassium, .gramUnit(with: .milli), 1),
        ("vitamin-c", .dietaryVitaminC, .gramUnit(with: .milli), 1),
        ("caffeine", .dietaryCaffeine, .gramUnit(with: .milli), 1),
    ]

    private var types: Set<HKSampleType> {
        Set(map.compactMap { HKQuantityType.quantityType(forIdentifier: $0.1) })
    }

    func requestAccess() async -> Bool {
        guard isAvailable else { return false }
        do {
            try await store.requestAuthorization(toShare: types, read: types)
            enabled = true
            return true
        } catch {
            return false
        }
    }

    private func value(_ key: String, in n: Nutrients) -> Double? {
        switch key {
        case "energy-kcal": return n.energyKcal
        case "proteins": return n.proteins
        case "carbohydrates": return n.carbohydrates
        case "fat": return n.fat
        case "saturated-fat": return n.saturatedFat
        case "sugars": return n.sugars
        case "fiber": return n.fiber
        case "water": return n.water
        default: return n.extras[key]
        }
    }

    /// Syncs one day: replaces every sample this app wrote for its entries.
    func sync(day: DailyLog, goals: DailyGoals) async {
        guard enabled, isAvailable else { return }
        var report: [String] = []
        var samples: [HKQuantitySample] = []
        for entry in day.foods {
            for (key, id, unit, mult) in map {
                guard let v = value(key, in: entry.nutrients), v > 0,
                      let type = HKQuantityType.quantityType(forIdentifier: id),
                      store.authorizationStatus(for: type) == .sharingAuthorized else { continue }
                samples.append(HKQuantitySample(
                    type: type,
                    quantity: HKQuantity(unit: unit, doubleValue: v * mult),
                    start: entry.loggedAt, end: entry.loggedAt,
                    metadata: [HKMetadataKeySyncIdentifier: "\(entry.id.uuidString)-\(key)",
                               HKMetadataKeySyncVersion: Int(Date().timeIntervalSince1970),
                               HKMetadataKeyFoodType: entry.name,
                               "NutriTrackGoalKcal": goals.energyKcal,
                               "NutriTrackGoalProtein": goals.proteins]))
            }
            report.append("\(entry.name): \(Int(entry.nutrients.energyKcal ?? 0)) kcal")
        }
        do {
            if !samples.isEmpty { try await store.save(samples) }
            lastSync = Date()
            UserDefaults.standard.set(lastSync, forKey: "health.lastSync")
            report.append("Saved \(samples.count) values to Health.")
        } catch {
            report.append("Health refused the write: \(error.localizedDescription)")
        }
        lastReport = report
    }

    /// Removes every sample written for a deleted log entry.
    func remove(entryId: UUID) async {
        guard enabled, isAvailable else { return }
        for (key, id, _, _) in map {
            guard let type = HKQuantityType.quantityType(forIdentifier: id) else { continue }
            let predicate = HKQuery.predicateForObjects(
                withMetadataKey: HKMetadataKeySyncIdentifier,
                allowedValues: ["\(entryId.uuidString)-\(key)"])
            _ = try? await store.deleteObjects(of: type, predicate: predicate)
        }
    }
}

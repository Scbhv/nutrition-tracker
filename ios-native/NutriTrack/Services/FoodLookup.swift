import Foundation

/// A lookup result ready to be reviewed and saved.
struct LookupResult {
    var food: FoodItem
    /// Grams in one serving as printed on the package (nil if unknown).
    var servingGrams: Double?
    var source: String   // "local-db", "openfoodfacts", "ai"
}

enum FoodLookup {
    /// Barcode → local library → Open Food Facts. No account needed.
    @MainActor
    static func barcode(_ code: String, db: Database) async throws -> LookupResult? {
        if let local = db.food(barcode: code) {
            return LookupResult(food: local, servingGrams: local.wholeUnits.first?.grams, source: "local-db")
        }
        let url = URL(string: "https://world.openfoodfacts.org/api/v2/product/\(code).json?fields=product_name,brands,nutriments,serving_quantity,serving_size")!
        var req = URLRequest(url: url)
        req.timeoutInterval = 15
        req.setValue("NutriTrack-iOS/1.0", forHTTPHeaderField: "User-Agent")
        let (data, _) = try await URLSession.shared.data(for: req)
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              (obj["status"] as? Int) == 1,
              let product = obj["product"] as? [String: Any] else { return nil }

        let n = product["nutriments"] as? [String: Any] ?? [:]
        var mapped: [String: Any] = [:]
        for key in ["energy-kcal", "proteins", "carbohydrates", "sugars", "fat",
                    "saturated-fat", "fiber", "salt", "sodium", "calcium", "iron",
                    "potassium", "vitamin-c", "caffeine"] {
            if let v = n["\(key)_100g"] { mapped[key] = v }
        }
        let serving: Double? = {
            if let v = product["serving_quantity"] as? Double { return v }
            if let s = product["serving_quantity"] as? String { return Double(s) }
            return nil
        }()
        var food = FoodItem(name: (product["product_name"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Scanned product",
                            brand: product["brands"] as? String,
                            barcode: code,
                            nutrients: Nutrients(webKeys: mapped))
        if let serving, serving > 0 {
            food.wholeUnits = [WholeUnitPreset(label: "1 serving", grams: serving)]
        }
        return LookupResult(food: food, servingGrams: serving, source: "openfoodfacts")
    }

    /// Free text → server (Open Food Facts, then AI). Premium only, server-enforced.
    @MainActor
    static func ai(_ query: String) async throws -> LookupResult {
        let r = try await Cloud.shared.invoke("food-lookup", body: ["query": query, "useAI": true])
        if let err = r["error"] as? String { throw CloudError.server(err) }
        let food = FoodItem(name: (r["name"] as? String) ?? query,
                            brand: r["brand"] as? String,
                            barcode: r["barcode"] as? String,
                            nutrients: Nutrients(webKeys: r["nutrients"] as? [String: Any] ?? [:]))
        return LookupResult(food: food, servingGrams: nil, source: (r["source"] as? String) ?? "ai")
    }
}

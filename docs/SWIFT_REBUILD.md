# NutriTrack — Rebuild Specification (for a Swift / SwiftUI implementation)

This document describes the complete behaviour of the existing React + Capacitor app so another
AI (or developer) can rebuild it natively in Swift without reading the web source.

---

## 1. Product summary

A nutrition tracker for iPhone. The user logs food (manual entry, barcode scan, AI lookup,
quick-add, recipes), tracks 40+ nutrients per day against day-specific goals, sees trends, and can
export everything to Apple Health and to offline JSON files. Premium features are unlocked by a
donation/unlock code. All data works offline; the cloud is optional sync/backup.

Design language: iOS 26 aesthetic — heavy glassmorphism (blurred translucent cards), 20px corner
radius, SF Pro with -0.03em tracking, centered floating action button navigation, haptics on every
meaningful action, swipe-to-delete rows, spring animations with staggered entry.

---

## 2. Data model

```swift
struct CustomNutrient: Codable, Identifiable { // user-defined nutrient
    var id: String        // kebab-case key, e.g. "custom-omega-3"
    var label: String
    var unit: String      // "g", "mg", "μg", "IU", "ml"
    var goal: Double
}

// Nutrients are a keyed dictionary so custom keys can be added freely.
typealias NutrientData = [String: Double]   // values are per 100 g

struct FoodItem: Codable, Identifiable {
    var id: String
    var name: String
    var barcode: String?
    var brand: String?
    var servingSize: Double      // grams
    var servingUnit: String
    var nutrients: NutrientData  // PER 100 G — always
    var createdAt: String        // ISO8601
    var updatedAt: String
    var recipe: Recipe?          // present when the item is a recipe
}

struct RecipeIngredient: Codable { var foodId: String; var name: String; var grams: Double }
struct Recipe: Codable {
    var ingredients: [RecipeIngredient]
    var servings: Int
    var instructions: [String]?
    var prepMinutes: Int?
    var tags: [String]?
    var notes: String?
}

struct FoodEntry: Codable, Identifiable {
    var id: String
    var foodId: String
    var servingAmount: Double     // multiplier of the food's servingSize
    var timestamp: String
    var editedAt: String?
    var previousServingAmount: Double?
}

struct ExerciseEntry: Codable, Identifiable {
    var id: String; var name: String
    var caloriesBurned: Double; var durationMinutes: Int?; var timestamp: String
}

struct DailyLog: Codable, Identifiable {
    var id: String
    var date: String              // "yyyy-MM-dd"
    var entries: [FoodEntry]
    var exerciseEntries: [ExerciseEntry]?
}
```

Known nutrient keys (all optional, values per 100 g):

- Macros: `energy-kcal`, `fat`, `saturated-fat`, `unsaturated-fat`, `carbohydrates`, `sugars`,
  `fiber`, `proteins`, `salt`, `water`
- Minerals: `sodium`, `potassium`, `calcium`, `magnesium`, `iron`, `zinc`, `copper`, `manganese`,
  `phosphorus`, `iodine`, `chloride`, `selenium`, `chrom`
- Vitamins: `vitamin-a`, `vitamin-b6`, `vitamin-b12`, `vitamin-c`, `vitamin-d`, `vitamin-e`,
  `vitamin-k`, `thiamine`, `riboflavin`, `pantothenic-acid`, `biotin`, `folate`
- Other: `cholesterol`, `caffeine`, `creatine`, `valine`, `isoleucine`, `leucine`,
  `electrolyte-mix`, `ashwaganda`
- Plus any `custom-*` key defined by the user.

### Core formulas

```
gramsEaten      = food.servingSize * entry.servingAmount
nutrientAmount  = food.nutrients[key] / 100 * gramsEaten
dayTotal(key)   = Σ nutrientAmount over all entries of the day
burnedCalories  = Σ exerciseEntries.caloriesBurned
netCalories     = dayTotal("energy-kcal") - burnedCalories
recipePerServing(key) = Σ(ingredient grams * sourceFood.nutrients[key] / 100) / recipe.servings
```

Recipes are stored as ordinary `FoodItem`s whose `nutrients` hold the per-100 g values computed
from the ingredients, so logging a recipe uses the exact same math as any other food.

---

## 3. Persistence

Two layers, local first:

1. **Local files (source of truth).** A `NutriTrack/` folder in the app's Documents directory with
   `foods.json`, `logs.json`, `settings.json`, plus theme/library packs. Written on every mutation
   (debounced ~300 ms), read at launch. Survives reboot and offline use. In Swift use
   `FileManager.default.urls(for: .documentDirectory, ...)` with `JSONEncoder`/`JSONDecoder`.
2. **Cloud (optional).** Supabase-equivalent backend for auth, premium status, community food
   library, feedback, theme packs, and checklist sync. Never required to use the app; if a network
   call fails, the app keeps working from local files and never downgrades premium state.

An **offline simulation toggle** forces every lookup to use only local files and reports which
source answered each request (`local-db`, `openfoodfacts`, `ai`, `cache`).

---

## 4. Screens

1. **Today (home).** Date strip / week view, calorie progress ring, macro cards, net-calorie card
   (intake − exercise), today's food list with swipe-to-delete and tap-to-edit-portion, exercise
   list, quick-add panel (recent foods, sortable by name / calories / protein).
2. **Food database.** Tabs: My Foods, Recipes, Community. Search, add/edit food, recipe builder
   (ingredients with grams, servings, instructions, prep time, tags), whole-unit presets
   ("1 apple" = 182 g, "1 slice", etc. from a USDA weight table) that convert to grams before
   logging.
3. **Trends.** Line charts per nutrient over 7/30/90 days, macro distribution donut, net-calorie
   trend, CSV export.
4. **Profile / Settings.** Search bar with fuzzy + synonym matching, typeahead suggestions,
   highlighted matches, and grouped sections: Account, Goals & Nutrition, Appearance, Data & Sync,
   Support, Advanced (collapsible).
5. **Admin-only:** system test page and step-by-step testing checklist, reachable only for the
   owner account.

### Entry methods

- Manual entry form (name, brand, serving size/unit, nutrient fields).
- Barcode scan → Open Food Facts lookup → AI fallback → manual. A test mode scans sample barcodes
  and shows the matched nutrients and serving calculation.
- AI lookup by free-text food name (server-side model call), returns per-100 g nutrients.
- Quick add from recents; recipe logging; JSON import.

---

## 5. Apple Health

The web app hands nutrient data to Health through a Shortcuts JSON/CSV payload. A native Swift app
should write directly with HealthKit instead:

- Request write authorization for `HKQuantityTypeIdentifier` dietary types (`dietaryEnergyConsumed`,
  `dietaryProtein`, `dietaryFatTotal`, `dietaryCarbohydrates`, `dietaryFiber`, `dietarySugar`,
  `dietarySodium`, vitamins/minerals, `dietaryWater`, `dietaryCaffeine`).
- Map each internal nutrient key to its HealthKit identifier and unit (g, mg, µg, kcal). Nutrients
  with no HealthKit equivalent (custom nutrients, supplements) are skipped and reported as such.
- Write one `HKQuantitySample` per nutrient per food entry, dated at the entry timestamp.
- A preflight check reports: HealthKit availability, authorization per type, and what is missing.
- A write report lists every nutrient written, its value and unit, and success/failure per item.

---

## 6. Premium & monetization

- Free tier: core logging and tracking.
- Premium unlocks: daily goals editor, AI lookup, theme packs, advanced tools.
- Unlock flow: donation link (Buy Me a Coffee) + verifiable unlock codes validated server-side.
- Premium state is cached per user locally; a failed verification never revokes access.

---

## 7. Safety rules to preserve

- Destructive or overwriting actions (restore a backup, delete account, clear error log, delete a
  food/entry) always require an explicit confirmation sheet naming exactly what will be lost, with
  a non-default destructive button.
- Restoring a backup overwrites foods, logs and settings — say so, and suggest exporting first.
- Roles/permissions are checked server-side, never from local storage.

---

## 8. Suggested Swift architecture

- SwiftUI + `@Observable` stores: `FoodStore`, `LogStore`, `SettingsStore`, `PremiumStore`.
- `FileRepository` actor for the JSON files; `SyncService` for optional cloud calls.
- `HealthKitService`, `BarcodeScannerService` (AVFoundation + Vision), `AIService`.
- Design tokens in a single `Theme` file (colors, radii 20pt, blur materials, SF Pro tracking).
- Haptics via `UIImpactFeedbackGenerator` on log, delete, toggle and success events.

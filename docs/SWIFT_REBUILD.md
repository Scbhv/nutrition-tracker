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

---

## 9. The database layer in detail

Three JSON documents in `Documents/NutriTrack/`, each written atomically (write to `*.tmp`, then `FileManager.replaceItemAt`) and debounced ~400 ms after a change.

| File | Contents |
| --- | --- |
| `foods.json` | `[FoodItem]` — the library, including recipes (a recipe is a FoodItem with `recipe` metadata: ingredients, servings, instructions, prepTime, tags) |
| `logs.json` | `[DailyLog]` — one per date, with **denormalized** nutrient values per entry so deleting a food never rewrites history |
| `settings.json` | `UserSettings` — daily goals, weekday overrides, custom nutrients, default serving size, appearance |

Swift shape:

```swift
protocol Store: Actor {
    associatedtype Model: Codable
    func load() async throws -> Model
    func save(_ model: Model) async
}

actor JSONStore<Model: Codable>: Store {
    private let url: URL           // Documents/NutriTrack/<name>.json
    private var flushTask: Task<Void, Never>?
    // debounce + atomic replace; on decode failure keep a .corrupt backup and start empty
}
```

Rules to preserve:
- Every write survives app termination and device reboot — never keep the only copy in memory or `UserDefaults`.
- Decoding is tolerant: unknown keys ignored, missing nutrients default to `nil`, never `0`.
- Import validation is schema-first (Zod in the web app → `Decodable` + explicit range checks in Swift). Reject the whole file if invalid; never partially apply.
- IDs are UUID strings; `mergeFoods` dedupes by `id` first, then by `barcode`.
- Backup export bundles all three documents into one JSON file; import replaces all three together.

## 10. Settings search

A single search field above the settings list filters sections and highlights matched substrings.

Pipeline (port `settingsSearch.ts`):
1. **Normalize** — trim + lowercase.
2. **Synonym expansion** — fixed groups; a query matching any word in a group also matches all the others. Groups include `backup/restore/save/archive/snapshot`, `export/download/share`, `import/upload/load/merge`, `appearance/theme/look/style`, `delete/remove/erase/wipe`, `premium/pro/unlock/donation`, `apple health/healthkit/shortcuts`.
3. **Fuzzy match** — substring first; otherwise an in-order subsequence test (`"bckp"` matches `"backup"`), only for queries of 3+ characters.
4. **Ranking for typeahead** — label prefix 100, label contains 80, keyword contains 60, synonym/fuzzy 30; top 5 shown.

```swift
func fuzzyMatch(_ needle: String, _ haystack: String) -> Bool {
    if haystack.contains(needle) { return true }
    guard needle.count >= 3 else { return false }
    var i = needle.startIndex
    for ch in haystack where ch == needle[i] {
        i = needle.index(after: i)
        if i == needle.endIndex { return true }
    }
    return false
}
```

UI requirements:
- Last query persists (`UserDefaults`) and is restored when returning to the screen.
- Typeahead list: arrow keys / VoiceOver rotor navigable, Return applies, Escape dismisses then clears.
- Matched text is highlighted inside each row (`AttributedString` range highlighting).
- Matching sections auto-expand; a "No settings match …" state offers a Clear action.
- Announce the result count with `AccessibilityNotification.Announcement` (the web app uses an `aria-live` region).
- Results feed a live **settings editor**: matched numeric goals (calories, protein, carbs, fat, fiber, water, default serving size) and the per-weekday goals toggle render as editable fields with inline validation (number, ≥ 0, ≤ 100000), a Save button disabled until dirty and valid, and a Discard button.

## 11. Restore / delete safety and history

Every destructive action follows the same three steps:

1. **Confirm** in a sheet that names the object and the exact loss ("Restoring `backup-2026-03-04.json` overwrites the foods, daily logs and settings on this device (214 foods · 96 days logged)"). Destructive button is not the default; the cancel option is phrased positively ("Keep them").
2. **Snapshot** the prior state before mutating.
3. **Record** a history entry.

```swift
enum HistoryKind: String, Codable { case search, restore, delete, edit }

struct HistoryEntry: Codable, Identifiable {
    let id: UUID
    let at: Date
    let kind: HistoryKind
    let title: String
    var detail: String?
    var undoHandler: String?     // key into the registry
    var undoPayload: Data?       // encoded snapshot
    var undone: Bool = false
}
```

- Store the newest 60 entries; when storage is tight, drop payload-carrying entries first, keep 20 headlines.
- An `UndoRegistry` maps handler names to closures registered by the live screens: `search` (restore the previous query), `database` (re-import the pre-restore snapshot), `settings` (re-apply the previous `UserSettings` fields), `food` (merge the deleted `FoodItem` back), `errorLog` (restore deleted error reports).
- A History screen lists all entries newest-first with filters (All / Searches / Restores / Deletes / Edits), relative timestamps, and an Undo button that is disabled when the entry is already undone or its handler isn't registered on this screen.
- Undo failures surface as a toast with the reason; they never silently no-op.
- Searches are coalesced: repeating the same query only refreshes the timestamp, and recording is debounced ~900 ms after typing stops.

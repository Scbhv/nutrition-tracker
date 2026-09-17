import SwiftUI

/// Turns search results into editable fields: whatever the query matched can be
/// changed and saved right here, with inline validation and an undoable save.
struct SettingsEditorSection: View {
    let query: String

    @EnvironmentObject private var db: Database
    @EnvironmentObject private var history: HistoryStore

    @State private var draft = UserSettings()
    @State private var loaded = false

    private struct Field: Identifiable {
        let id: String
        let label: String
        let unit: String
        let keywords: [String]
        let get: (UserSettings) -> Double
        let set: (inout UserSettings, Double) -> Void
    }

    private let fields: [Field] = [
        .init(id: "kcal", label: "Daily calories", unit: "kcal",
              keywords: ["calories", "kcal", "energy", "goals"],
              get: { $0.dailyGoals.energyKcal }, set: { $0.dailyGoals.energyKcal = $1 }),
        .init(id: "protein", label: "Protein", unit: "g",
              keywords: ["protein", "macros", "goals"],
              get: { $0.dailyGoals.proteins }, set: { $0.dailyGoals.proteins = $1 }),
        .init(id: "carbs", label: "Carbs", unit: "g",
              keywords: ["carbs", "carbohydrates", "macros", "goals"],
              get: { $0.dailyGoals.carbohydrates }, set: { $0.dailyGoals.carbohydrates = $1 }),
        .init(id: "fat", label: "Fat", unit: "g",
              keywords: ["fat", "macros", "goals"],
              get: { $0.dailyGoals.fat }, set: { $0.dailyGoals.fat = $1 }),
        .init(id: "fiber", label: "Fiber", unit: "g",
              keywords: ["fiber", "fibre", "goals"],
              get: { $0.dailyGoals.fiber }, set: { $0.dailyGoals.fiber = $1 }),
        .init(id: "water", label: "Water", unit: "ml",
              keywords: ["water", "hydration", "goals"],
              get: { $0.dailyGoals.water }, set: { $0.dailyGoals.water = $1 }),
        .init(id: "serving", label: "Default serving size", unit: "g",
              keywords: ["serving", "portion", "default", "grams"],
              get: { $0.defaultServingSize }, set: { $0.defaultServingSize = $1 }),
    ]

    private var matching: [Field] {
        fields.filter { SettingsSearch.matches(query: query, keywords: [$0.label] + $0.keywords) }
    }

    private var invalid: [String] {
        matching.compactMap { field in
            let v = field.get(draft)
            if v.isNaN || v < 0 || v > 100_000 { return field.label }
            return nil
        }
    }

    private var dirty: Bool { draft != db.settings }

    var body: some View {
        Section("Edit settings") {
            ForEach(matching) { field in
                HStack {
                    Text(SettingsSearch.highlighted(field.label, query: query))
                    Spacer()
                    TextField(field.label, value: Binding(
                        get: { field.get(draft) },
                        set: { field.set(&draft, $0) }
                    ), format: .number.precision(.fractionLength(0...1)))
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 90)
                        .monospacedDigit()
                    Text(field.unit)
                        .foregroundStyle(.secondary)
                        .frame(width: 32, alignment: .leading)
                }
            }

            if SettingsSearch.matches(query: query, keywords: ["weekday", "weekly", "day", "goals"]) {
                Toggle("Different goals per weekday", isOn: $draft.weekdayGoalsEnabled)
            }

            if !invalid.isEmpty {
                Label("\(invalid.joined(separator: ", ")) must be a number between 0 and 100000.",
                      systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }

            HStack {
                Button("Save") { save() }
                    .buttonStyle(.borderedProminent)
                    .disabled(!dirty || !invalid.isEmpty)
                Button("Discard") { draft = db.settings }
                    .buttonStyle(.bordered)
                    .disabled(!dirty)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 4)
        }
        .onAppear {
            if !loaded { draft = db.settings; loaded = true }
        }
        .onChange(of: db.settings) { _, new in
            if !dirty { draft = new }
        }
    }

    private func save() {
        let snapshot = db.settings
        db.settings = draft
        history.record(kind: .edit,
                       title: "Edited daily goals",
                       detail: matching.map(\.label).joined(separator: ", "),
                       undoHandler: "settings",
                       payload: SettingsPayload(settings: snapshot))
    }
}

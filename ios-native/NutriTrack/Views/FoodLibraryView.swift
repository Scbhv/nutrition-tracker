import SwiftUI

struct FoodLibraryView: View {
    /// When set, tapping a food opens the portion sheet and logs it to this day.
    var logTo: Date?

    @EnvironmentObject private var db: Database
    @EnvironmentObject private var history: HistoryStore
    @EnvironmentObject private var undo: UndoRegistry
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var portionTarget: FoodItem?
    @State private var pendingDelete: FoodItem?

    private var results: [FoodItem] {
        guard !query.trimmingCharacters(in: .whitespaces).isEmpty else { return db.foods }
        return db.foods.filter {
            SettingsSearch.fuzzyMatch(query, $0.name)
            || SettingsSearch.fuzzyMatch(query, $0.brand ?? "")
        }
    }

    var body: some View {
        Group {
            if logTo != nil { content } else { NavigationStack { content } }
        }
    }

    private var content: some View {
        List {
            ForEach(results) { food in
                Button {
                    portionTarget = food
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(SettingsSearch.highlighted(food.name, query: query))
                            .foregroundStyle(.primary)
                        Text("\(Int(food.nutrients.energyKcal ?? 0)) kcal · \(Int(food.nutrients.proteins ?? 0)) g protein per 100 g")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .swipeActions {
                    Button(role: .destructive) { pendingDelete = food } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .searchable(text: $query, prompt: "Search foods")
        .navigationTitle(logTo == nil ? "Foods" : "Add food")
        .sheet(item: $portionTarget) { food in
            PortionSheet(food: food, defaultGrams: db.settings.defaultServingSize) { grams in
                db.logFood(food, grams: grams, on: logTo ?? Date())
                portionTarget = nil
                if logTo != nil { dismiss() }
            }
            .presentationDetents([.medium])
        }
        .confirmationDialog(
            "Delete \(pendingDelete?.name ?? "")?",
            isPresented: Binding(get: { pendingDelete != nil },
                                 set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible
        ) {
            Button("Delete food", role: .destructive) { confirmDelete() }
            Button("Keep it", role: .cancel) { pendingDelete = nil }
        } message: {
            Text("It disappears from your library. Days you already logged it on keep their numbers.")
        }
        .onAppear {
            undo.register("food") { payload in
                guard let payload, let restored = try? payload.decoded(FoodPayload.self) else { return }
                await MainActor.run { db.mergeFoods([restored.food]) }
            }
        }
    }

    private func confirmDelete() {
        guard let food = pendingDelete else { return }
        pendingDelete = nil
        guard let removed = db.deleteFood(id: food.id) else { return }
        history.record(kind: .delete,
                       title: "Deleted \(removed.name)",
                       detail: "Removed from your food library",
                       undoHandler: "food",
                       payload: FoodPayload(food: removed))
    }
}

struct PortionSheet: View {
    let food: FoodItem
    let defaultGrams: Double
    let onLog: (Double) -> Void

    @State private var grams: Double

    init(food: FoodItem, defaultGrams: Double, onLog: @escaping (Double) -> Void) {
        self.food = food
        self.defaultGrams = defaultGrams
        self.onLog = onLog
        _grams = State(initialValue: defaultGrams)
    }

    private var preview: Nutrients { food.nutrients.scaled(toGrams: grams) }

    var body: some View {
        NavigationStack {
            Form {
                Section("Amount") {
                    HStack {
                        TextField("Grams", value: $grams, format: .number.precision(.fractionLength(0...1)))
                            .keyboardType(.decimalPad)
                            .font(.system(.title2, design: .rounded))
                        Text("g").foregroundStyle(.secondary)
                    }
                    if !food.wholeUnits.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack {
                                ForEach(food.wholeUnits) { unit in
                                    Button("\(unit.label) · \(Int(unit.grams)) g") {
                                        grams = unit.grams
                                    }
                                    .buttonStyle(.bordered)
                                }
                            }
                        }
                    }
                    HStack {
                        ForEach([50.0, 100, 150, 200], id: \.self) { preset in
                            Button("\(Int(preset)) g") { grams = preset }
                                .buttonStyle(.bordered)
                        }
                    }
                }

                Section("This portion") {
                    LabeledContent("Calories", value: "\(Int(preview.energyKcal ?? 0)) kcal")
                    LabeledContent("Protein", value: "\(Int(preview.proteins ?? 0)) g")
                    LabeledContent("Carbs", value: "\(Int(preview.carbohydrates ?? 0)) g")
                    LabeledContent("Fat", value: "\(Int(preview.fat ?? 0)) g")
                }
            }
            .navigationTitle(food.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Log") { onLog(grams) }
                        .disabled(!(grams > 0))
                }
            }
        }
    }
}

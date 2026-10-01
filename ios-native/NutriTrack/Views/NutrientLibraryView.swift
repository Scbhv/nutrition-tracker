import SwiftUI
import UniformTypeIdentifiers

/// Settings › Advanced › Nutrient Library: which nutrients show, custom
/// nutrients, and importing / exporting the foods JSON.
struct NutrientLibraryView: View {
    @EnvironmentObject private var db: Database
    @State private var newNutrient = ""
    @State private var importing = false
    @State private var exportDoc: BackupDocument?
    @State private var message: String?

    static let groups: [(String, [(String, String)])] = [
        ("Macronutrients", [("sugars", "Sugars"), ("saturated-fat", "Saturated fat"),
                            ("fiber", "Fiber"), ("salt", "Salt"), ("water", "Water")]),
        ("Minerals", [("sodium", "Sodium"), ("potassium", "Potassium"), ("calcium", "Calcium"),
                      ("iron", "Iron"), ("magnesium", "Magnesium"), ("zinc", "Zinc")]),
        ("Vitamins", [("vitamin-a", "Vitamin A"), ("vitamin-c", "Vitamin C"),
                      ("vitamin-d", "Vitamin D"), ("vitamin-b12", "Vitamin B12")]),
        ("Other", [("caffeine", "Caffeine"), ("cholesterol", "Cholesterol")]),
    ]

    var body: some View {
        Form {
            ForEach(Self.groups, id: \.0) { group in
                Section(group.0) {
                    ForEach(group.1, id: \.0) { key, label in
                        Toggle(label, isOn: Binding(
                            get: { !db.settings.hiddenNutrients.contains(key) },
                            set: { show in
                                if show { db.settings.hiddenNutrients.removeAll { $0 == key } }
                                else { db.settings.hiddenNutrients.append(key) }
                            }))
                    }
                }
            }
            Section {
                ForEach(db.settings.customNutrients, id: \.self) { Text($0) }
                    .onDelete { db.settings.customNutrients.remove(atOffsets: $0) }
                HStack {
                    TextField("Add custom nutrient", text: $newNutrient)
                    Button("Add") {
                        let v = newNutrient.trimmingCharacters(in: .whitespaces)
                        guard !v.isEmpty, !db.settings.customNutrients.contains(v) else { return }
                        db.settings.customNutrients.append(v)
                        newNutrient = ""
                    }
                    .disabled(newNutrient.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            } header: { Text("Custom") }
            Section {
                Button("Import foods from JSON…") { importing = true }
                Button("Export foods as JSON") {
                    let enc = JSONEncoder()
                    enc.outputFormatting = [.prettyPrinted, .sortedKeys]
                    enc.dateEncodingStrategy = .iso8601
                    if let data = try? enc.encode(db.foods) { exportDoc = BackupDocument(data: data) }
                }
                if let message { Text(message).font(.footnote).foregroundStyle(.secondary) }
            } header: { Text("Library file") } footer: {
                Text("Importing merges foods; matching foods you already have are kept.")
            }
        }
        .navigationTitle("Nutrient Library")
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            guard case .success(let url) = result else { return }
            let ok = url.startAccessingSecurityScopedResource()
            defer { if ok { url.stopAccessingSecurityScopedResource() } }
            let dec = JSONDecoder(); dec.dateDecodingStrategy = .iso8601
            if let data = try? Data(contentsOf: url), let foods = try? dec.decode([FoodItem].self, from: data) {
                db.mergeFoods(foods); message = "Imported \(foods.count) foods."
            } else {
                message = "That file isn't a valid food library, so nothing was changed."
            }
        }
        .fileExporter(isPresented: Binding(get: { exportDoc != nil }, set: { if !$0 { exportDoc = nil } }),
                      document: exportDoc, contentType: .json,
                      defaultFilename: "nutritrack-foods") { _ in }
    }
}

struct HealthSettingsView: View {
    @EnvironmentObject private var health: HealthKitService
    @EnvironmentObject private var db: Database
    @State private var syncing = false

    var body: some View {
        Form {
            Section {
                Toggle("Sync with Apple Health", isOn: Binding(
                    get: { health.enabled },
                    set: { on in
                        if on { Task { _ = await health.requestAccess() } } else { health.enabled = false }
                    }))
                    .disabled(!health.isAvailable)
                if let last = health.lastSync {
                    LabeledContent("Last sync", value: last.formatted(.relative(presentation: .named)))
                }
                Button {
                    Task { syncing = true; await syncRecent(); syncing = false }
                } label: {
                    HStack { Text("Sync last 7 days now"); if syncing { Spacer(); ProgressView() } }
                }
                .disabled(!health.enabled || syncing)
            } footer: {
                Text(health.isAvailable
                     ? "Each food you log is written to Health as calories, protein, carbs, fat and more. Deleting an entry removes it from Health. Health has no place for goals, so they stay in NutriTrack and are attached to each entry for reference."
                     : "Apple Health isn't available on this device.")
            }
            if !health.lastReport.isEmpty {
                Section("Last sync report") {
                    ForEach(health.lastReport, id: \.self) { Text($0).font(.footnote) }
                }
            }
        }
        .navigationTitle("Apple Health")
    }

    private func syncRecent() async {
        for offset in 0..<7 {
            let date = Calendar.current.date(byAdding: .day, value: -offset, to: Date())!
            await health.sync(day: db.log(for: date), goals: db.goals(for: date))
        }
    }
}

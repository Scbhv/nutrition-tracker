import SwiftUI
import VisionKit

/// Scan a package → look it up → review serving size, calories and macros → save & log.
struct BarcodeScanFlow: View {
    var logTo: Date
    @EnvironmentObject private var db: Database
    @Environment(\.dismiss) private var dismiss

    @State private var scanned: String?
    @State private var manualCode = ""
    @State private var lookingUp = false
    @State private var result: LookupResult?
    @State private var message: String?

    private var scannerSupported: Bool {
        DataScannerViewController.isSupported && DataScannerViewController.isAvailable
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                if scannerSupported {
                    BarcodeScanner { code in
                        guard scanned == nil else { return }
                        scanned = code
                        Haptics.success()
                        Task { await lookup(code) }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 12).stroke(.white.opacity(0.8), lineWidth: 2)
                            .frame(width: 240, height: 120)
                    }
                    .frame(maxHeight: 360)
                } else {
                    ContentUnavailableView("Camera scanning unavailable",
                                           systemImage: "barcode.viewfinder",
                                           description: Text("Type the number under the barcode instead."))
                }

                HStack {
                    TextField("Barcode number", text: $manualCode)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                    Button("Look up") { Task { await lookup(manualCode) } }
                        .buttonStyle(.borderedProminent)
                        .disabled(manualCode.count < 6 || lookingUp)
                }

                if lookingUp { ProgressView("Looking up \(scanned ?? manualCode)…") }
                if let message {
                    Text(message).font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                    Button("Scan again") { scanned = nil; self.message = nil }
                }
                Spacer(minLength: 0)
            }
            .padding()
            .navigationTitle("Scan barcode")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .sheet(item: Binding(get: { result.map(IdentifiedResult.init) },
                                 set: { if $0 == nil { result = nil; scanned = nil } })) { item in
                FoodReviewSheet(result: item.result, logTo: logTo) { dismiss() }
            }
        }
    }

    private func lookup(_ code: String) async {
        let code = code.trimmingCharacters(in: .whitespaces)
        guard !code.isEmpty else { return }
        lookingUp = true
        message = nil
        defer { lookingUp = false }
        do {
            if let found = try await FoodLookup.barcode(code, db: db) {
                result = found
            } else {
                Haptics.error()
                message = "No product found for \(code). You can add it by hand from the Foods tab."
            }
        } catch {
            Haptics.error()
            message = "Couldn't reach the product database. Check your connection and try again."
        }
    }
}

private struct IdentifiedResult: Identifiable {
    let result: LookupResult
    var id: String { result.food.id }
}

/// Editable review of a scanned / looked-up food. Values per 100 g plus serving size.
struct FoodReviewSheet: View {
    let result: LookupResult
    let logTo: Date
    var onDone: () -> Void

    @EnvironmentObject private var db: Database
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var serving: Double
    @State private var kcal: Double
    @State private var protein: Double
    @State private var carbs: Double
    @State private var fat: Double
    @State private var servings: Double = 1

    init(result: LookupResult, logTo: Date, onDone: @escaping () -> Void) {
        self.result = result; self.logTo = logTo; self.onDone = onDone
        let n = result.food.nutrients
        _name = State(initialValue: result.food.name)
        _serving = State(initialValue: result.servingGrams ?? 100)
        _kcal = State(initialValue: n.energyKcal ?? 0)
        _protein = State(initialValue: n.proteins ?? 0)
        _carbs = State(initialValue: n.carbohydrates ?? 0)
        _fat = State(initialValue: n.fat ?? 0)
    }

    private var grams: Double { serving * servings }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name)
                    if let brand = result.food.brand { LabeledContent("Brand", value: brand) }
                    LabeledContent("Source", value: sourceLabel)
                }
                Section("Serving") {
                    field("Serving size", $serving, "g")
                    Stepper(value: $servings, in: 0.25...20, step: 0.25) {
                        Text("\(servings.formatted()) × serving = \(Int(grams)) g")
                    }
                }
                Section("Per 100 g") {
                    field("Calories", $kcal, "kcal")
                    field("Protein", $protein, "g")
                    field("Carbs", $carbs, "g")
                    field("Fat", $fat, "g")
                }
                Section("You'll log") {
                    LabeledContent("Calories", value: "\(Int(kcal * grams / 100)) kcal")
                    LabeledContent("Protein · Carbs · Fat",
                                   value: "\(Int(protein * grams / 100)) · \(Int(carbs * grams / 100)) · \(Int(fat * grams / 100)) g")
                }
            }
            .navigationTitle("Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Log") { save() }.disabled(name.isEmpty || grams <= 0)
                }
            }
        }
    }

    private var sourceLabel: String {
        switch result.source {
        case "local-db": return "Your library"
        case "openfoodfacts": return "Open Food Facts"
        default: return "AI estimate"
        }
    }

    private func field(_ title: String, _ value: Binding<Double>, _ unit: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField(title, value: value, format: .number.precision(.fractionLength(0...1)))
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 90)
            Text(unit).foregroundStyle(.secondary).frame(width: 34, alignment: .leading)
        }
    }

    private func save() {
        var food = result.food
        food.name = name
        food.nutrients.energyKcal = kcal
        food.nutrients.proteins = protein
        food.nutrients.carbohydrates = carbs
        food.nutrients.fat = fat
        food.wholeUnits = [WholeUnitPreset(label: "1 serving", grams: serving)]
        if db.foods.contains(where: { $0.id == food.id }) {
            db.updateFood(food)
        } else {
            db.mergeFoods([food])
        }
        db.logFood(food, grams: grams, on: logTo)
        Haptics.success()
        dismiss()
        onDone()
    }
}

/// VisionKit live scanner for EAN/UPC barcodes.
struct BarcodeScanner: UIViewControllerRepresentable {
    var onScan: (String) -> Void

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.ean13, .ean8, .upce, .code128])],
            qualityLevel: .balanced,
            isHighlightingEnabled: true)
        vc.delegate = context.coordinator
        try? vc.startScanning()
        return vc
    }

    func updateUIViewController(_ vc: DataScannerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onScan: (String) -> Void
        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }

        func dataScanner(_ scanner: DataScannerViewController, didAdd items: [RecognizedItem],
                         allItems: [RecognizedItem]) {
            for item in items {
                if case .barcode(let code) = item, let value = code.payloadStringValue {
                    onScan(value); return
                }
            }
        }
    }
}

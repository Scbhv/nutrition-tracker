import SwiftUI

/// Premium: type a food, get per-100 g nutrients, review, log.
struct AILookupView: View {
    var logTo: Date
    @EnvironmentObject private var premium: PremiumStore
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var loading = false
    @State private var result: LookupResult?
    @State private var error: String?
    @State private var showUnlock = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("e.g. 2 scrambled eggs", text: $query)
                        .submitLabel(.search)
                        .onSubmit { Task { await run() } }
                    Button {
                        Task { await run() }
                    } label: {
                        HStack {
                            Text("Look up")
                            if loading { Spacer(); ProgressView() }
                        }
                    }
                    .disabled(query.trimmingCharacters(in: .whitespaces).count < 2 || loading)
                } footer: {
                    Text(premium.isPremium
                         ? "Checks Open Food Facts first, then estimates with AI. Always review the numbers."
                         : "AI lookup is a Premium feature.")
                }
                if let error {
                    Section { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("AI lookup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .sheet(isPresented: Binding(get: { result != nil }, set: { if !$0 { result = nil } })) {
                if let result { FoodReviewSheet(result: result, logTo: logTo) { dismiss() } }
            }
            .sheet(isPresented: $showUnlock) { UnlockView() }
        }
    }

    private func run() async {
        guard premium.isPremium else { showUnlock = true; return }
        loading = true; error = nil
        defer { loading = false }
        do { result = try await FoodLookup.ai(query) }
        catch { self.error = error.localizedDescription; Haptics.error() }
    }
}

import SwiftUI

struct SettingsHistoryView: View {
    @EnvironmentObject private var history: HistoryStore
    @EnvironmentObject private var undo: UndoRegistry

    @State private var filter: HistoryKind?
    @State private var showClearConfirm = false
    @State private var error: String?

    private var entries: [HistoryEntry] {
        guard let filter else { return history.entries }
        return history.entries.filter { $0.kind == filter }
    }

    private func icon(_ kind: HistoryKind) -> String {
        switch kind {
        case .search: return "magnifyingglass"
        case .restore: return "arrow.counterclockwise"
        case .delete: return "trash"
        case .edit: return "slider.horizontal.3"
        }
    }

    var body: some View {
        List {
            Section {
                Picker("Filter", selection: $filter) {
                    Text("All").tag(HistoryKind?.none)
                    Text("Searches").tag(HistoryKind?.some(.search))
                    Text("Restores").tag(HistoryKind?.some(.restore))
                    Text("Deletes").tag(HistoryKind?.some(.delete))
                    Text("Edits").tag(HistoryKind?.some(.edit))
                }
                .pickerStyle(.segmented)
            } footer: {
                Text("Every settings search, backup restore, deletion and edit on this iPhone. Undo puts things back the way they were.")
            }

            if entries.isEmpty {
                Text("Nothing here yet.").foregroundStyle(.secondary)
            }

            ForEach(entries) { entry in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Image(systemName: icon(entry.kind))
                        .foregroundStyle(.secondary)
                        .frame(width: 20)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.title)
                        Text([entry.detail, HistoryStore.relativeTime(entry.at),
                              entry.undone ? "undone" : nil]
                            .compactMap { $0 }
                            .joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Undo") { performUndo(entry) }
                        .buttonStyle(.bordered)
                        .controlSize(.small)
                        .disabled(!history.canUndo(entry))
                }
                .padding(.vertical, 2)
            }
        }
        .navigationTitle("History")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Clear", role: .destructive) { showClearConfirm = true }
                    .disabled(history.entries.isEmpty)
            }
        }
        .confirmationDialog("Clear your settings history?",
                            isPresented: $showClearConfirm,
                            titleVisibility: .visible) {
            Button("Clear it", role: .destructive) { history.clear() }
            Button("Keep history", role: .cancel) {}
        } message: {
            Text("The list disappears and nothing in it can be undone afterwards. Your foods, logs and settings stay exactly as they are.")
        }
        .alert("Couldn't undo", isPresented: Binding(get: { error != nil },
                                                     set: { if !$0 { error = nil } })) {
            Button("OK", role: .cancel) { error = nil }
        } message: {
            Text(error ?? "")
        }
    }

    private func performUndo(_ entry: HistoryEntry) {
        Task {
            do { try await history.undo(entry) }
            catch { self.error = error.localizedDescription }
        }
    }
}

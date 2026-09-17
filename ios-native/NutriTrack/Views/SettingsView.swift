import SwiftUI
import UniformTypeIdentifiers

struct SettingsView: View {
    @EnvironmentObject private var db: Database
    @EnvironmentObject private var history: HistoryStore
    @EnvironmentObject private var undo: UndoRegistry

    @State private var query = SettingsSearch.lastQuery
    @State private var previousQuery = SettingsSearch.lastQuery
    @State private var searchTask: Task<Void, Never>?

    @State private var showExporter = false
    @State private var showImporter = false
    @State private var pendingRestore: URL?
    @State private var exportDocument: BackupDocument?
    @State private var alert: String?

    private func visible(_ keywords: [String]) -> Bool {
        SettingsSearch.matches(query: query, keywords: keywords)
    }

    private var resultCount: Int {
        SettingsSearch.index.filter { visible([$0.label] + $0.keywords) }.count
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SettingsSearchField(query: $query, resultCount: resultCount)
                        .listRowInsets(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
                }

                if visible(["goals", "calories", "protein", "carbs", "fat", "fiber",
                            "water", "serving", "weekday", "edit settings", "targets"]) {
                    SettingsEditorSection(query: query)
                }

                if visible(["backup", "restore", "export", "import", "archive", "save"]) {
                    Section("Backup & Restore") {
                        LabeledContent("Library",
                                       value: "\(db.foods.count) foods · \(db.logs.count) days")
                        Button {
                            exportBackup()
                        } label: {
                            Label("Export backup", systemImage: "square.and.arrow.up")
                        }
                        Button {
                            showImporter = true
                        } label: {
                            Label("Restore from backup", systemImage: "square.and.arrow.down")
                        }
                        Text("A backup bundles your foods, daily logs and settings into one file.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                if visible(["history", "undo", "activity", "recent"]) {
                    Section("Advanced") {
                        NavigationLink {
                            SettingsHistoryView()
                        } label: {
                            Label("Settings history & undo", systemImage: "clock.arrow.circlepath")
                        }
                    }
                }

                if resultCount == 0 && !query.isEmpty {
                    Section {
                        VStack(spacing: 8) {
                            Text("No settings match “\(query)”.")
                                .foregroundStyle(.secondary)
                            Button("Clear search") { query = "" }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                    }
                }
            }
            .navigationTitle("Settings")
            .onChange(of: query) { _, newValue in
                SettingsSearch.lastQuery = newValue
                searchTask?.cancel()
                searchTask = Task {
                    try? await Task.sleep(nanoseconds: 900_000_000)
                    guard !Task.isCancelled else { return }
                    history.recordSearch(query: newValue, previous: previousQuery)
                    previousQuery = newValue
                }
            }
            .onAppear(perform: registerUndoHandlers)
            .fileExporter(isPresented: $showExporter,
                          document: exportDocument,
                          contentType: .json,
                          defaultFilename: "nutritrack-backup-\(DateKey.string(from: Date()))") { _ in }
            .fileImporter(isPresented: $showImporter,
                          allowedContentTypes: [.json]) { result in
                if case .success(let url) = result { pendingRestore = url }
            }
            .confirmationDialog("Replace your data with this backup?",
                                isPresented: Binding(get: { pendingRestore != nil },
                                                     set: { if !$0 { pendingRestore = nil } }),
                                titleVisibility: .visible) {
                Button("Restore & overwrite", role: .destructive) { confirmRestore() }
                Button("Keep my data", role: .cancel) { pendingRestore = nil }
            } message: {
                Text("This overwrites the \(db.foods.count) foods, \(db.logs.count) logged days and all settings on this iPhone. Export a fresh backup first if you're unsure.")
            }
            .alert("Backup", isPresented: Binding(get: { alert != nil },
                                                  set: { if !$0 { alert = nil } })) {
                Button("OK", role: .cancel) { alert = nil }
            } message: {
                Text(alert ?? "")
            }
        }
    }

    // MARK: - Backup

    private func exportBackup() {
        do {
            exportDocument = BackupDocument(data: try db.exportBundle())
            showExporter = true
        } catch {
            alert = "Could not create the backup: \(error.localizedDescription)"
        }
    }

    private func confirmRestore() {
        guard let url = pendingRestore else { return }
        pendingRestore = nil
        let snapshot = try? db.exportBundle()
        do {
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            let data = try Data(contentsOf: url)
            try db.importBundle(data)
            history.record(kind: .restore,
                           title: "Restored \(url.lastPathComponent)",
                           detail: "Replaced foods, logs and settings",
                           undoHandler: snapshot == nil ? nil : "database",
                           payload: snapshot.map { BackupPayload(bundle: $0) })
            alert = "Backup restored."
        } catch {
            alert = "That file isn't a valid backup, so nothing was changed."
        }
    }

    // MARK: - Undo handlers

    private func registerUndoHandlers() {
        undo.register("search") { payload in
            guard let payload, let restored = try? payload.decoded(SearchPayload.self) else { return }
            await MainActor.run {
                query = restored.query
                SettingsSearch.lastQuery = restored.query
            }
        }
        undo.register("database") { payload in
            guard let payload, let restored = try? payload.decoded(BackupPayload.self) else { return }
            try await MainActor.run { try db.importBundle(restored.bundle) }
        }
        undo.register("settings") { payload in
            guard let payload, let restored = try? payload.decoded(SettingsPayload.self) else { return }
            await MainActor.run { db.settings = restored.settings }
        }
    }
}

struct BackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data

    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}

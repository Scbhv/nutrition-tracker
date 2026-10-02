import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var db: Database
    @EnvironmentObject private var history: HistoryStore
    @EnvironmentObject private var undo: UndoRegistry

    @State private var date = Date()
    @State private var showPicker = false
    @State private var toast: String?
    @State private var showScanner = false
    @State private var showAI = false

    private var log: DailyLog { db.log(for: date) }
    private var goals: DailyGoals { db.goals(for: date) }
    private var totals: Nutrients { log.totals }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    WeekStrip(date: $date)
                        .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                }
                Section {
                    HStack {
                        Spacer()
                        GoalRing(value: totals.energyKcal ?? 0,
                                 goal: goals.energyKcal,
                                 label: "Calories",
                                 unit: "kcal")
                        Spacer()
                    }
                    .listRowSeparator(.hidden)

                    if log.burnedKcal > 0 {
                        HStack {
                            Label("Burned", systemImage: "figure.run")
                            Spacer()
                            Text("\(Int(log.burnedKcal)) kcal · net \(Int(log.netKcal))")
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                    }
                }

                Section {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible())], spacing: 10) {
                        MacroCard(name: "Protein", value: totals.proteins ?? 0, goal: goals.proteins, tint: .blue)
                        MacroCard(name: "Carbs", value: totals.carbohydrates ?? 0, goal: goals.carbohydrates, tint: .orange)
                        MacroCard(name: "Fat", value: totals.fat ?? 0, goal: goals.fat, tint: .pink)
                        MacroCard(name: "Fiber", value: totals.fiber ?? 0, goal: goals.fiber, tint: .green)
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                } header: { Text("Macros") }

                Section("Logged food") {
                    if log.foods.isEmpty {
                        Text("Nothing logged yet.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(log.foods) { entry in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.name)
                            Text("\(Int(entry.grams)) g · \(Int(entry.nutrients.energyKcal ?? 0)) kcal")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .swipeActions {
                            Button(role: .destructive) { remove(entry) } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                    }
                }
            }
            .navigationTitle(Calendar.current.isDateInToday(date)
                             ? "Today"
                             : date.formatted(date: .abbreviated, time: .omitted))
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button { showPicker.toggle() } label: {
                        Image(systemName: "calendar")
                    }
                    .accessibilityLabel("Pick a day")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        NavigationLink { FoodLibraryView(logTo: date) } label: {
                            Label("From my foods", systemImage: "list.bullet")
                        }
                        Button { showScanner = true } label: {
                            Label("Scan barcode", systemImage: "barcode.viewfinder")
                        }
                        Button { showAI = true } label: {
                            Label("AI lookup", systemImage: "sparkles")
                        }
                    } label: {
                        Label("Add food", systemImage: "plus.circle.fill")
                    }
                }
            }
            .fullScreenCover(isPresented: $showScanner) { BarcodeScanFlow(logTo: date) }
            .sheet(isPresented: $showAI) { AILookupView(logTo: date) }
            .sheet(isPresented: $showPicker) {
                DatePicker("Day", selection: $date, displayedComponents: .date)
                    .datePickerStyle(.graphical)
                    .padding()
                    .presentationDetents([.medium])
            }
            .overlay(alignment: .bottom) {
                if let toast {
                    Text(toast)
                        .font(.subheadline)
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .background(.ultraThinMaterial, in: Capsule())
                        .padding(.bottom, 12)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .animation(.spring(duration: 0.3), value: toast)
        }
        .onAppear(perform: registerUndo)
    }

    private func remove(_ entry: FoodEntry) {
        let key = DateKey.string(from: date)
        guard let removed = db.removeEntry(entry.id, on: date) else { return }
        history.record(kind: .delete,
                       title: "Removed \(removed.name)",
                       detail: "\(Int(removed.grams)) g from \(key)",
                       undoHandler: "logEntry",
                       payload: EntryPayload(entry: removed, dateKey: key))
        show("Removed \(removed.name)")
    }

    private func show(_ message: String) {
        toast = message
        Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            toast = nil
        }
    }

    private func registerUndo() {
        undo.register("logEntry") { payload in
            guard let payload,
                  let restored = try? payload.decoded(EntryPayload.self),
                  let day = DateKey.formatter.date(from: restored.dateKey) else { return }
            await MainActor.run { db.restoreEntry(restored.entry, on: day) }
        }
    }
}

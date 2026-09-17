import SwiftUI

@main
struct NutriTrackApp: App {
    @StateObject private var db = Database()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(db)
                .environmentObject(HistoryStore.shared)
                .environmentObject(UndoRegistry.shared)
                .task { await db.load() }
        }
        .onChange(of: scenePhase) { _, phase in
            // Never leave the only copy of a change in memory.
            if phase != .active { Task { await db.flush() } }
        }
    }
}

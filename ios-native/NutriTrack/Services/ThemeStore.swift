import SwiftUI

struct AppTheme: Identifiable, Codable, Hashable {
    var id: String
    var name: String
    var hue: Double            // 0…360
    var premium: Bool
    var remote = false

    var accent: Color { Color(hue: hue / 360, saturation: 0.72, brightness: 0.85) }
}

/// Built-in themes plus the community gallery (`theme_packs`).
/// Free: Classic. Premium: every other built-in theme and the gallery.
@MainActor
final class ThemeStore: ObservableObject {
    static let shared = ThemeStore()

    static let builtIn: [AppTheme] = [
        AppTheme(id: "classic", name: "Classic", hue: 142, premium: false),
        AppTheme(id: "ocean", name: "Ocean", hue: 205, premium: true),
        AppTheme(id: "sunset", name: "Sunset", hue: 18, premium: true),
        AppTheme(id: "berry", name: "Berry", hue: 330, premium: true),
        AppTheme(id: "graphite", name: "Graphite", hue: 220, premium: true),
    ]

    @Published private(set) var gallery: [AppTheme] = []
    @Published private(set) var loading = false
    @Published var current: AppTheme {
        didSet {
            if let data = try? JSONEncoder().encode(current) {
                UserDefaults.standard.set(data, forKey: "theme.current")
            }
        }
    }

    private init() {
        if let data = UserDefaults.standard.data(forKey: "theme.current"),
           let saved = try? JSONDecoder().decode(AppTheme.self, from: data) {
            current = saved
        } else {
            current = Self.builtIn[0]
        }
    }

    /// Falls back to Classic if premium was never granted on this device.
    func enforce(isPremium: Bool) {
        if current.premium && !isPremium { current = Self.builtIn[0] }
    }

    func loadGallery() async {
        loading = true
        defer { loading = false }
        struct Row: Decodable { let id: String; let name: String; let accent_hue: Double }
        guard let data = try? await Cloud.shared.rest(
            "theme_packs?is_published=eq.true&select=id,name,accent_hue&order=downloads.desc&limit=50"),
              let rows = try? JSONDecoder().decode([Row].self, from: data) else { return }
        gallery = rows.map { AppTheme(id: $0.id, name: $0.name, hue: $0.accent_hue, premium: true, remote: true) }
    }
}

struct ThemePickerView: View {
    @EnvironmentObject private var themes: ThemeStore
    @EnvironmentObject private var premium: PremiumStore
    @State private var showUnlock = false

    var body: some View {
        List {
            Section {
                ForEach(ThemeStore.builtIn) { row($0) }
            } footer: {
                Text("Classic is free. Other themes and the gallery come with Premium.")
            }
            Section("Gallery") {
                if themes.loading { ProgressView() }
                ForEach(themes.gallery) { row($0) }
                if !themes.loading && themes.gallery.isEmpty {
                    Text("No gallery themes available offline.").foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Theme")
        .task { await themes.loadGallery() }
        .sheet(isPresented: $showUnlock) { UnlockView() }
    }

    private func row(_ theme: AppTheme) -> some View {
        Button {
            if theme.premium && !premium.isPremium { showUnlock = true; return }
            themes.current = theme
            Haptics.success()
        } label: {
            HStack {
                Circle().fill(theme.accent).frame(width: 26, height: 26)
                Text(theme.name).foregroundStyle(.primary)
                Spacer()
                if theme.premium && !premium.isPremium {
                    Image(systemName: "lock.fill").foregroundStyle(.secondary)
                } else if themes.current.id == theme.id {
                    Image(systemName: "checkmark").foregroundStyle(theme.accent)
                }
            }
        }
    }
}

enum Haptics {
    static func tap() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    static func error() { UINotificationFeedbackGenerator().notificationOccurred(.error) }
}

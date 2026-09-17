import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "flame.fill") }
            FoodLibraryView()
                .tabItem { Label("Foods", systemImage: "carrot.fill") }
            SettingsView()
                .tabItem { Label("You", systemImage: "person.fill") }
        }
    }
}

// MARK: - Shared small pieces

struct GoalRing: View {
    let value: Double
    let goal: Double
    let label: String
    let unit: String

    private var progress: Double { goal > 0 ? min(value / goal, 1) : 0 }

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .stroke(Color.secondary.opacity(0.2), lineWidth: 12)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.spring(duration: 0.5), value: progress)
                VStack(spacing: 2) {
                    Text(value, format: .number.precision(.fractionLength(0)))
                        .font(.system(.title, design: .rounded, weight: .semibold))
                    Text("of \(Int(goal)) \(unit)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 160, height: 160)
            Text(label).font(.subheadline.weight(.medium))
        }
    }
}

struct MacroBar: View {
    let name: String
    let value: Double
    let goal: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(name).font(.subheadline.weight(.medium))
                Spacer()
                Text("\(Int(value)) / \(Int(goal)) g")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            ProgressView(value: goal > 0 ? min(value / goal, 1) : 0)
                .tint(.accentColor)
        }
    }
}

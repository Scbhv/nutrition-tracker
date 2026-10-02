import SwiftUI

/// Seven equal-width day pills that always fit the phone width (no horizontal scroll).
struct WeekStrip: View {
    @Binding var date: Date
    @EnvironmentObject private var db: Database

    private var days: [Date] {
        let cal = Calendar.current
        let start = cal.dateInterval(of: .weekOfYear, for: date)?.start ?? date
        return (0..<7).compactMap { cal.date(byAdding: .day, value: $0, to: start) }
    }

    var body: some View {
        HStack(spacing: 4) {
            ForEach(days, id: \.self) { day in
                let selected = Calendar.current.isDate(day, inSameDayAs: date)
                let logged = !db.log(for: day).foods.isEmpty
                Button {
                    date = day
                    Haptics.tap()
                } label: {
                    VStack(spacing: 4) {
                        Text(day.formatted(.dateTime.weekday(.narrow)))
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(selected ? Color.white.opacity(0.85) : .secondary)
                        Text(day.formatted(.dateTime.day()))
                            .font(.system(.callout, design: .rounded, weight: .semibold))
                            .foregroundStyle(selected ? .white : .primary)
                        Circle().fill(logged ? (selected ? Color.white : Color.accentColor) : .clear)
                            .frame(width: 4, height: 4)
                    }
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(selected ? Color.accentColor : Color.clear,
                                in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(day.formatted(date: .complete, time: .omitted))
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
    }
}

/// Compact macro card: 2 per row on any iPhone width.
struct MacroCard: View {
    let name: String
    let value: Double
    let goal: Double
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(name).font(.caption.weight(.medium)).foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text("\(Int(value))").font(.system(.title3, design: .rounded, weight: .semibold))
                Text("/ \(Int(goal)) g").font(.caption).foregroundStyle(.secondary)
            }
            .lineLimit(1).minimumScaleFactor(0.7)
            ProgressView(value: goal > 0 ? min(value / goal, 1) : 0).tint(tint)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

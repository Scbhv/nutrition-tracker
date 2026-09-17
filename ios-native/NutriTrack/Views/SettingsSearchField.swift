import SwiftUI

/// Search field with ranked typeahead, a clear button, and a VoiceOver
/// announcement of the number of matching settings.
struct SettingsSearchField: View {
    @Binding var query: String
    let resultCount: Int

    @FocusState private var focused: Bool
    @State private var announced = -1

    private var suggestions: [SettingsSearch.Suggestion] {
        SettingsSearch.suggestions(for: query)
    }

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                    .accessibilityHidden(true)
                TextField("Search settings", text: $query)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .focused($focused)
                    .accessibilityLabel("Search settings")
                    .accessibilityHint("Filters the settings below. Suggestions appear as you type.")
                if !query.isEmpty {
                    Button {
                        query = ""
                        focused = true
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear settings search")
                }
            }
            .padding(.vertical, 12)
            .padding(.horizontal, 14)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))

            if focused && !suggestions.isEmpty {
                VStack(spacing: 0) {
                    ForEach(suggestions) { suggestion in
                        Button {
                            query = suggestion.query
                            focused = false
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(SettingsSearch.highlighted(suggestion.label, query: query))
                                        .foregroundStyle(.primary)
                                    Text(suggestion.section)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "arrow.turn.down.left")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .contentShape(Rectangle())
                            .padding(.vertical, 12)
                            .padding(.horizontal, 14)
                        }
                        .buttonStyle(.plain)
                        Divider().opacity(0.4)
                    }
                }
                .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.spring(duration: 0.25), value: suggestions)
        .onChange(of: resultCount) { _, count in
            guard !query.isEmpty, count != announced else { return }
            announced = count
            AccessibilityNotification.Announcement(
                "\(count) setting\(count == 1 ? "" : "s") match \(query)"
            ).post()
        }
    }
}

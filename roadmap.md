# Roadmap

## Done
- Settings search: highlight matches, remembered query, synonyms + fuzzy matching, typeahead, accessibility
- Local data persistence (files on device, survives reboot)
- Confirmation dialogs + safety copy for restore / delete actions
- Swift rebuild guide (docs/SWIFT_REBUILD.md) incl. database, settings search, restore/delete safety + history
- Settings layout tuned for iPhone widths (single-column buttons under 390px, taller tap targets)
- Settings history page (/settings-history) with filters and per-entry undo
- Search results wired into an editable settings panel (goals, serving size, weekday goals)
- SwiftUI source scaffold in ios-native/ (JSON database, today/foods/settings, search, history + undo) — not compiled here

## Swift app next steps (needs Xcode on a Mac)
- Barcode scanning, AI food lookup, Apple Health writes
- Community library, theme packs, premium/donation gate

## Open (waiting on a decision)
- "Buy me a coffee": link change vs. new button vs. restyle
- 0.99 EUR per gallery theme: Stripe, Paddle or manual handling
- iOS native loading issue: needs symptoms/logs from device
- Which screen gets press/hover animations + real-time form validation

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

- Swift: barcode scan + review, AI lookup, Apple Health sync, community foods, themes, premium, Apple sign-in, nutrient library in Advanced, Apple-style settings, week strip + 2-column macro cards, instant settings save

## Swift app next steps
- Build in Xcode on a Mac and test on iPhone (cannot be done here)
- Community photo upload, theme textures, recipe builder

## Open (waiting on a decision)
- "Buy me a coffee": link change vs. new button vs. restyle
- 0.99 EUR per gallery theme: Stripe, Paddle or manual handling
- iOS native loading issue: needs symptoms/logs from device
- Which screen gets press/hover animations + real-time form validation

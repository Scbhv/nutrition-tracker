# NutriTrack — native SwiftUI source

A SwiftUI implementation of the core described in `docs/SWIFT_REBUILD.md`:
the on-device JSON database, daily logging, settings search (synonyms + fuzzy +
typeahead), the settings editor, and the history / undo system.

This folder contains **source files only** — it has not been compiled or run
here. Open it on a Mac with Xcode to build it.

## Create the Xcode project

1. Xcode → File → New → Project → iOS → App.
   - Product Name: `NutriTrack`
   - Interface: SwiftUI, Language: Swift, Storage: None
2. Delete the generated `ContentView.swift` and `NutriTrackApp.swift`.
3. Drag everything in `NutriTrack/` into the project (Copy items if needed,
   Create groups).
4. Set the deployment target to iOS 17.0 or later.
5. Select your team under Signing & Capabilities, plug in your iPhone, Run.

## Layout

```
NutriTrack/
  App/            NutriTrackApp.swift, RootView.swift
  Models/         FoodItem, DailyLog, UserSettings, Nutrients
  Storage/        JSONStore (atomic + debounced), Database (ObservableObject)
  Search/         SettingsSearch (synonyms, fuzzy, ranked typeahead)
  History/        HistoryStore, UndoRegistry
  Views/          Today, FoodLibrary, Settings, SettingsSearchField,
                  SettingsEditor, SettingsHistoryView
```

## Required capabilities (Signing & Capabilities tab)

- **HealthKit** (writes your food intake to Apple Health)
- **Sign in with Apple** (account, premium, community, AI lookup)

Info.plist keys:

- `NSCameraUsageDescription` — "Scan barcodes on food packages."
- `NSHealthShareUsageDescription` — "Read nutrition you logged to avoid duplicates."
- `NSHealthUpdateUsageDescription` — "Save the food you log to Apple Health."

Barcode scanning uses VisionKit and needs a real iPhone (not the simulator).
For Sign in with Apple, your app's bundle ID must be added to the Apple
sign-in client IDs in the backend auth settings.

## Check settings survive a restart

1. Run on your iPhone, open You › Daily goals, change calories, Save.
2. Swipe the app away, reopen (or reboot) — the value is still there.
Settings are written to `Documents/NutriTrack/settings.json` immediately on every change.

## Not yet in the Swift version

Photo upload for community foods, theme pack image textures (gallery themes
apply their accent colour only), recipes builder.

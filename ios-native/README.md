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

## What is intentionally not here yet

Barcode scanning, the AI food lookup, Apple Health writes, community library,
theme packs and the donation/premium gate. They are specified in the guide and
plug into `Database` the same way the included features do.

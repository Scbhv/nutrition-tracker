import SwiftUI

struct CommunityFood: Decodable, Identifiable {
    let id: String
    let user_id: String
    let name: String
    let brand: String?
    let barcode: String?
    let serving_size: Double
    let status: String
    let approval_count: Int
    let image_path: String?
    let nutrients: [String: Double]

    var asFoodItem: FoodItem {
        var f = FoodItem(id: "community-\(id)", name: name, brand: brand, barcode: barcode,
                         nutrients: Nutrients(webKeys: nutrients))
        f.wholeUnits = [WholeUnitPreset(label: "1 serving", grams: serving_size)]
        return f
    }
}

/// Community library: approved foods for everyone; pending foods need two
/// approvals from other people. Browsing is free, submitting needs Premium.
struct CommunityView: View {
    @EnvironmentObject private var db: Database
    @EnvironmentObject private var cloud: Cloud
    @EnvironmentObject private var premium: PremiumStore

    @State private var foods: [CommunityFood] = []
    @State private var approvedByMe: Set<String> = []
    @State private var tab = "approved"
    @State private var loading = false
    @State private var toast: String?
    @State private var showSubmit = false
    @State private var showUnlock = false

    private var visible: [CommunityFood] { foods.filter { $0.status == tab } }

    var body: some View {
        List {
            Picker("Show", selection: $tab) {
                Text("Approved").tag("approved")
                Text("Needs review").tag("pending")
            }
            .pickerStyle(.segmented)
            .listRowBackground(Color.clear)

            if loading { ProgressView() }
            ForEach(visible) { food in
                HStack(spacing: 12) {
                    AsyncImage(url: cloud.publicFileURL(bucket: "community-food-photos", path: food.image_path)) { img in
                        img.resizable().scaledToFill()
                    } placeholder: {
                        Image(systemName: "fork.knife").foregroundStyle(.secondary)
                    }
                    .frame(width: 44, height: 44)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(food.name)
                        Text("\(Int(food.nutrients["energy-kcal"] ?? 0)) kcal / 100 g · \(food.approval_count)/2 approvals")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if food.status == "approved" {
                        Button("Add") { db.mergeFoods([food.asFoodItem]); show("Added \(food.name)") }
                            .buttonStyle(.bordered)
                    } else if food.user_id != cloud.session?.userId && !approvedByMe.contains(food.id) {
                        Button("Approve") { Task { await approve(food) } }
                            .buttonStyle(.borderedProminent)
                            .disabled(!cloud.isSignedIn)
                    }
                }
            }
            if !loading && visible.isEmpty {
                Text(cloud.isSignedIn || tab == "approved" ? "Nothing here yet." : "Sign in to review foods.")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Community")
        .toolbar {
            Button {
                if premium.isPremium { showSubmit = true } else { showUnlock = true }
            } label: { Label("Submit food", systemImage: "plus") }
            .disabled(!cloud.isSignedIn)
        }
        .refreshable { await load() }
        .task { await load() }
        .sheet(isPresented: $showSubmit) { CommunitySubmitView { Task { await load() } } }
        .sheet(isPresented: $showUnlock) { UnlockView() }
        .overlay(alignment: .bottom) { ToastView(text: toast) }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        if let data = try? await cloud.rest("community_foods?status=in.(pending,approved)&select=*&order=created_at.desc&limit=500"),
           let rows = try? JSONDecoder().decode([CommunityFood].self, from: data) {
            foods = rows
        }
        if let uid = cloud.session?.userId,
           let data = try? await cloud.rest("community_food_approvals?user_id=eq.\(uid)&select=food_id"),
           let rows = try? JSONDecoder().decode([[String: String]].self, from: data) {
            approvedByMe = Set(rows.compactMap { $0["food_id"] })
        }
    }

    private func approve(_ food: CommunityFood) async {
        guard let uid = cloud.session?.userId else { return }
        do {
            _ = try await cloud.rest("community_food_approvals", method: "POST",
                                     json: ["food_id": food.id, "user_id": uid])
            Haptics.success()
            show("Approved \(food.name)")
            await load()
        } catch {
            show(error.localizedDescription)
        }
    }

    private func show(_ text: String) {
        toast = text
        Task { try? await Task.sleep(nanoseconds: 2_000_000_000); toast = nil }
    }
}

struct CommunitySubmitView: View {
    var onDone: () -> Void
    @EnvironmentObject private var cloud: Cloud
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var brand = ""
    @State private var barcode = ""
    @State private var serving: Double = 100
    @State private var kcal: Double = 0
    @State private var protein: Double = 0
    @State private var carbs: Double = 0
    @State private var fat: Double = 0
    @State private var error: String?
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $name)
                    TextField("Brand (optional)", text: $brand)
                    TextField("Barcode (optional)", text: $barcode).keyboardType(.numberPad)
                }
                Section("Per 100 g") {
                    num("Serving size (g)", $serving)
                    num("Calories", $kcal); num("Protein", $protein)
                    num("Carbs", $carbs); num("Fat", $fat)
                }
                Section {
                    Text("Two other people must approve it before everyone can use it.")
                        .font(.footnote).foregroundStyle(.secondary)
                    if let error { Text(error).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Submit food")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Submit") { Task { await submit() } }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || saving)
                }
            }
        }
    }

    private func num(_ label: String, _ v: Binding<Double>) -> some View {
        HStack {
            Text(label); Spacer()
            TextField(label, value: v, format: .number).keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing).frame(maxWidth: 90)
        }
    }

    private func submit() async {
        guard let uid = cloud.session?.userId else { return }
        saving = true
        defer { saving = false }
        let body: [String: Any] = [
            "user_id": uid, "name": name.trimmingCharacters(in: .whitespaces),
            "brand": brand.isEmpty ? NSNull() : brand, "barcode": barcode.isEmpty ? NSNull() : barcode,
            "serving_size": serving, "serving_unit": "g",
            "nutrients": ["energy-kcal": kcal, "proteins": protein, "carbohydrates": carbs, "fat": fat],
        ]
        do {
            _ = try await cloud.rest("community_foods", method: "POST", json: body)
            Haptics.success(); onDone(); dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

struct ToastView: View {
    let text: String?
    var body: some View {
        Group {
            if let text {
                Text(text).font(.subheadline)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.bottom, 12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.3), value: text)
    }
}

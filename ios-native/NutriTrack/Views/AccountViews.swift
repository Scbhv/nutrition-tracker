import SwiftUI
import AuthenticationServices

/// Settings › Account row content: Sign in with Apple, premium status.
struct AccountSection: View {
    @EnvironmentObject private var cloud: Cloud
    @EnvironmentObject private var premium: PremiumStore
    @State private var nonce = Cloud.randomNonce()
    @State private var error: String?
    @State private var showUnlock = false

    var body: some View {
        Section {
            if let s = cloud.session {
                LabeledContent("Signed in", value: s.email ?? "Apple ID")
                LabeledContent("Plan") {
                    if premium.checking { ProgressView() }
                    else { Text(premium.isPremium ? "Premium" : "Free") }
                }
                if !premium.isPremium {
                    Button("Unlock Premium") { showUnlock = true }
                }
                Button("Sign out", role: .destructive) { cloud.signOut(); Task { await premium.refresh() } }
            } else {
                SignInWithAppleButton(.signIn) { req in
                    nonce = Cloud.randomNonce()
                    req.requestedScopes = [.email]
                    req.nonce = Cloud.sha256(nonce)
                } onCompletion: { result in
                    Task { await handle(result) }
                }
                .frame(height: 44)
                .listRowInsets(EdgeInsets())
            }
            if let error { Text(error).font(.footnote).foregroundStyle(.red) }
        } header: {
            Text("Account")
        } footer: {
            Text("Logging, scanning, backups and Apple Health work without an account.")
        }
        .sheet(isPresented: $showUnlock) { UnlockView() }
    }

    private func handle(_ result: Result<ASAuthorization, Error>) async {
        do {
            let auth = try result.get()
            guard let cred = auth.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = cred.identityToken,
                  let token = String(data: tokenData, encoding: .utf8) else { return }
            try await cloud.signInWithApple(idToken: token, nonce: nonce)
            await premium.refresh()
            error = nil
            Haptics.success()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct UnlockView: View {
    @EnvironmentObject private var premium: PremiumStore
    @EnvironmentObject private var cloud: Cloud
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @State private var busy = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label("AI food lookup", systemImage: "sparkles")
                    Label("Themes and gallery", systemImage: "paintpalette")
                    Label("Per-weekday goals", systemImage: "calendar")
                    Label("Submit community foods", systemImage: "person.3")
                } header: { Text("Premium includes") }

                Section {
                    Link(destination: URL(string: "https://buymeacoffee.com")!) {
                        Label("Support with a coffee", systemImage: "cup.and.saucer")
                    }
                    TextField("Unlock code", text: $code)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    Button {
                        Task { await redeem() }
                    } label: {
                        HStack { Text("Redeem code"); if busy { Spacer(); ProgressView() } }
                    }
                    .disabled(code.isEmpty || busy || !cloud.isSignedIn)
                } footer: {
                    Text(cloud.isSignedIn ? "You'll get a code after your donation." : "Sign in with Apple in Settings first.")
                }
                if let message { Section { Text(message) } }
            }
            .navigationTitle("Premium")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
    }

    private func redeem() async {
        busy = true
        defer { busy = false }
        do {
            message = try await premium.unlock(code: code)
            Haptics.success()
        } catch {
            message = error.localizedDescription
            Haptics.error()
        }
    }
}

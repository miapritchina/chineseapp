import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    private enum Step {
        case email
        case code
    }

    @State private var step: Step = .email
    @State private var email = ""
    @State private var code = ""
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("中")
                    .font(.system(size: 34))
                Text("Sign in with the same email you use in the web app.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                if step == .email {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .textInputAutocapitalization(.never)
                    Button(action: sendCode) {
                        busy ? AnyView(ProgressView()) : AnyView(Text("Send code"))
                    }
                    .disabled(busy || email.isEmpty)
                } else {
                    Text(email)
                        .font(.footnote)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    TextField("Code", text: $code)
                        .textContentType(.oneTimeCode)
                    Button(action: verify) {
                        busy ? AnyView(ProgressView()) : AnyView(Text("Sign in"))
                    }
                    .disabled(busy || code.isEmpty)
                    Button("Different email") {
                        step = .email
                        code = ""
                        error = nil
                    }
                    .font(.footnote)
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                }

                if let error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
            }
        }
        .navigationTitle("Chinese")
    }

    private func sendCode() {
        busy = true
        error = nil
        Task {
            do {
                try await Supabase.requestCode(email: email.trimmingCharacters(in: .whitespaces))
                step = .code
            } catch {
                self.error = error.localizedDescription
            }
            busy = false
        }
    }

    private func verify() {
        busy = true
        error = nil
        Task {
            do {
                let session = try await Supabase.verifyCode(
                    email: email.trimmingCharacters(in: .whitespaces),
                    code: code
                )
                sessionStore.adopt(session)
            } catch {
                self.error = error.localizedDescription
            }
            busy = false
        }
    }
}

import Foundation

@MainActor
final class SessionStore: ObservableObject {
    @Published private(set) var session: Session?

    init() {
        session = Keychain.loadSession()
    }

    func adopt(_ new: Session) {
        session = new
        Keychain.saveSession(new)
    }

    func signOut() {
        session = nil
        Keychain.deleteSession()
    }

    // Returns a session whose access token is good for at least another
    // minute, refreshing through GoTrue if needed. A rejected refresh
    // token means the account state is gone — sign out so the login
    // screen comes back. Network failures keep the session and surface
    // as an error to the caller instead.
    func freshSession() async throws -> Session {
        guard let current = session else {
            throw SupabaseError(status: nil, message: "Signed out")
        }
        if current.expiresAt > Date().addingTimeInterval(60) {
            return current
        }
        do {
            let refreshed = try await Supabase.refresh(refreshToken: current.refreshToken)
            adopt(refreshed)
            return refreshed
        } catch let err as SupabaseError {
            if let status = err.status, (400..<500).contains(status) {
                signOut()
            }
            throw err
        }
    }
}

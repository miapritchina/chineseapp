import SwiftUI

@main
struct ChineseWatchApp: App {
    @StateObject private var sessionStore = SessionStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(sessionStore)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    var body: some View {
        if sessionStore.session == nil {
            LoginView()
        } else {
            QueueView()
        }
    }
}

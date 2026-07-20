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
    @StateObject private var heart = HeartRateModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        content
            .overlay(alignment: .topLeading) {
                HeartRateBadge(bpm: heart.bpm)
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active { heart.start() } else { heart.stop() }
            }
    }

    @ViewBuilder private var content: some View {
        if sessionStore.session == nil {
            LoginView()
        } else {
            QueueView()
        }
    }
}

// MARK: - Experimental heart-rate badge (not part of the learning flow).
struct HeartRateBadge: View {
    let bpm: Int?

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: "heart.fill")
                .foregroundStyle(.red)
            Text(bpm.map(String.init) ?? "--")
                .monospacedDigit()
        }
        .font(.system(size: 12, weight: .semibold))
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(.ultraThinMaterial, in: Capsule())
        .accessibilityLabel("Experimental heart rate")
        .accessibilityValue(bpm.map { "\($0) beats per minute" } ?? "no reading")
    }
}

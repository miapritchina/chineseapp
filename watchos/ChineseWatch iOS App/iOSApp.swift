import SwiftUI

// Minimal iOS companion. Its only job is to be the App Store delivery
// vehicle for the watch app (Xcode 26 can't upload a watch-only archive
// to App Store Connect — FB22730778). The watch app still runs
// independently on the watch.
@main
struct ChineseCompanionApp: App {
    var body: some Scene {
        WindowGroup { CompanionRootView() }
    }
}

struct CompanionRootView: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("中")
                .font(.system(size: 72, weight: .medium))
                .foregroundStyle(Color(red: 0.694, green: 0.165, blue: 0.165))
            Text("Chinese")
                .font(.title.weight(.semibold))
            Text("Open the app on your Apple Watch to review your due words.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .padding()
    }
}

#Preview { CompanionRootView() }

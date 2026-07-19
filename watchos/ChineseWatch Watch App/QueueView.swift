import SwiftUI

// Vertical crown-paged carousel: one due word per page, digital crown
// moves to the next word, tap opens the detail sheet. The last page is
// a status page with refresh + sign-out.
struct QueueView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @StateObject private var model = QueueModel()
    @State private var selection: String = "status"
    @State private var detail: QueueEntry?

    var body: some View {
        Group {
            switch model.state {
            case .idle, .loading:
                ProgressView("Loading queue…")
            case .failed(let message):
                VStack(spacing: 8) {
                    Text(message)
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                    Button("Retry") { reload() }
                }
            case .loaded(let entries):
                carousel(entries)
            }
        }
        .task { await model.load(using: sessionStore) }
    }

    private func carousel(_ entries: [QueueEntry]) -> some View {
        TabView(selection: $selection) {
            if entries.isEmpty {
                VStack(spacing: 6) {
                    Text("🎉")
                        .font(.title)
                    Text("All caught up")
                        .font(.headline)
                    Text("Nothing due right now.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .tag("empty")
            }
            ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                WordPageView(entry: entry, position: index + 1, total: entries.count)
                    .onTapGesture { detail = entry }
                    .tag(entry.id)
            }
            statusPage(count: entries.count)
                .tag("status")
        }
        .tabViewStyle(.verticalPage)
        .sheet(item: $detail) { entry in
            WordDetailView(entry: entry)
        }
        .onAppear {
            selection = entries.first?.id ?? "empty"
        }
    }

    private func statusPage(count: Int) -> some View {
        ScrollView {
            VStack(spacing: 8) {
                Text(count == 1 ? "1 word due" : "\(count) words due")
                    .font(.headline)
                Button("Refresh") { reload() }
                Text(sessionStore.session?.email ?? "")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Button("Sign out", role: .destructive) {
                    sessionStore.signOut()
                }
            }
        }
    }

    private func reload() {
        Task { await model.load(using: sessionStore) }
    }
}

struct WordPageView: View {
    let entry: QueueEntry
    let position: Int
    let total: Int

    private var hanziSize: CGFloat {
        switch entry.word.word.count {
        case 1: return 64
        case 2: return 52
        case 3: return 38
        default: return 30
        }
    }

    var body: some View {
        VStack(spacing: 4) {
            Spacer(minLength: 0)
            Text(entry.word.word)
                .font(.system(size: hanziSize, weight: .medium))
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            if !entry.word.pinyin.isEmpty {
                Text(entry.word.pinyin)
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Text("\(position) / \(total)")
                .font(.footnote)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
    }
}

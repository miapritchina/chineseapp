import Foundation

struct QueueEntry: Identifiable {
    let word: Word
    let dueAt: Date
    let facets: [String]
    var id: String { word.word }
}

// Human-readable names for the drill facets seeded by the web app
// (useReview.ts → expectedCards).
func facetLabel(_ facet: String) -> String {
    switch facet {
    case "meaningRecognition", "recognition": return "Meaning"
    case "soundRecognition": return "Sound"
    case "reverseRecognition": return "Reverse"
    case "clozeChar": return "Cloze"
    default: return facet
    }
}

@MainActor
final class QueueModel: ObservableObject {
    enum State {
        case idle
        case loading
        case loaded([QueueEntry])
        case failed(String)
    }

    @Published private(set) var state: State = .idle

    // Cap the carousel — the crown pages one word at a time, so past a
    // few dozen the tail is unreachable in practice anyway.
    private let pageCap = 30

    func load(using store: SessionStore) async {
        if case .loading = state { return }
        state = .loading
        do {
            let session = try await store.freshSession()
            let rows = try await Supabase.dueWordRows(session: session)

            // One page per word: keep the earliest due time, collect the
            // facets it is due under. Rows arrive due_at-ascending.
            var order: [String] = []
            var dueAt: [String: Date] = [:]
            var facets: [String: [String]] = [:]
            for row in rows {
                if dueAt[row.itemKey] == nil {
                    order.append(row.itemKey)
                    dueAt[row.itemKey] = row.dueAt
                }
                facets[row.itemKey, default: []].append(row.facet)
            }
            let keys = Array(order.prefix(pageCap))

            let words = try await Supabase.fetchWords(keys, session: session)
            let byKey = Dictionary(uniqueKeysWithValues: words.map { ($0.word, $0) })
            let entries = keys.map { key in
                QueueEntry(
                    word: byKey[key] ?? Word(word: key, pinyin: "", definitions: [], hsk: nil, rank: nil),
                    dueAt: dueAt[key] ?? Date(),
                    facets: facets[key] ?? []
                )
            }
            state = .loaded(entries)
        } catch {
            if store.session == nil {
                state = .idle
            } else {
                state = .failed(error.localizedDescription)
            }
        }
    }
}

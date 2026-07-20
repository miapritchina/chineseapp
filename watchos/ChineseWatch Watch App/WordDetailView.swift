import SwiftUI

// Detail sheet for one due word — the watch counterpart of the web
// app's EntitySheet, read-only.
struct WordDetailView: View {
    let entry: QueueEntry

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                VStack(spacing: 2) {
                    Text(entry.word.word)
                        .font(.system(size: 40, weight: .medium))
                        .minimumScaleFactor(0.4)
                        .lineLimit(1)
                    if !entry.word.pinyin.isEmpty {
                        Text(entry.word.pinyin)
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity)

                if !entry.word.definitions.isEmpty {
                    Divider()
                    ForEach(Array(entry.word.definitions.enumerated()), id: \.offset) { _, def in
                        Text("· \(def)")
                            .font(.footnote)
                    }
                }

                Divider()
                Text("Due \(entry.dueAt.formatted(.relative(presentation: .named)))")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                if !entry.facets.isEmpty {
                    Text("Drills: \(entry.facets.map(facetLabel).joined(separator: ", "))")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                HStack(spacing: 8) {
                    if let hsk = entry.word.hsk {
                        Text("HSK \(hsk)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    if let rank = entry.word.rank {
                        Text("#\(rank)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle(entry.word.word)
    }
}

#Preview {
    WordDetailView(entry: QueueEntry(
        word: Word(
            word: "中文",
            pinyin: "zhōngwén",
            definitions: ["Chinese language", "Mandarin"],
            hsk: 1,
            rank: 42
        ),
        dueAt: Date().addingTimeInterval(-3600),
        facets: ["meaningRecognition", "soundRecognition"]
    ))
}

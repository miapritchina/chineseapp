# Chinese App v2 — Redesign Plan

## Goals

1. **Search-first home.** A prominent search box is the primary entry point.
   Type 汉字 / pinyin / English → instant results from a bundled HSK word
   index (~2000 words). The current 103-word grid becomes a "Suggested" shelf
   underneath the search box.
2. **Dong-Chinese-style detail view.** When a word is opened, render each
   character as a large stroke-animated glyph where individual strokes are
   tinted by their etymological component (meaning / sound / iconic / …),
   using the `fragment: [start, end]` stroke ranges already provided by
   `chinese-lexicon`.
3. **Static, no backend.** Everything still ships as plain files served by
   GitHub Pages. No build step at runtime.

## What stays the same

- Repo layout (`chinese/` is still a static folder, `data.json` committed).
- HanziWriter from jsDelivr CDN; stroke SVG data auto-fetched per char.
- Modal stack pattern (`history.pushState` for browser back-button pop).
- Per-char "My story" mnemonics in `localStorage`.
- Cross-links between words sharing chars / components.

## Data pipeline changes (`scripts/extract-chinese.mjs`)

The current script seeds 103 hand-picked words and runs a BFS closure over
their components. v2 expands the seed to ~2000 HSK-common words while keeping
the same output shape.

1. **Source the seed list.** Use the official HSK 3.0 levels 1–4 vocabulary
   (~2000 words). Three viable sources, in order of preference:
   - Vendor a CSV/JSON of HSK 3.0 1–4 into `scripts/hsk-3.0-1-4.json`
     (one-time copy from a public list; cite source in the file header).
   - Fall back to old HSK 1–5 (~2500 words) if HSK 3.0 list is messy.
   - Manual augmentation list for anything `chinese-lexicon` doesn't have an
     entry for — drop those with a warning rather than fail.
2. **Filter to entries `chinese-lexicon` actually knows.** For each seed word,
   call `lexicon.getEntries(word)`; skip if empty (log count of skipped).
3. **Extend the BFS closure** so every char appearing in any seed word AND
   every component of those chars (one level deeper than today) lands in
   `data.chars`.
4. **Add an HSK level field** to each word: `{hanzi, pinyin, english, hsk: 1-4}`
   so the UI can badge / filter.
5. **Build a search index** sized for ~2000 entries. Inline as
   `data.searchIndex` — a flat array of
   `{w, p, e, idx}` records (hanzi, pinyin without tone marks, lowercased
   english gloss, index into `data.words`). Tone-stripped pinyin lets users
   type "ni hao" without diacritics.
6. **Output size budget.** Target < 800 KB uncompressed (≈ 200 KB gzip).
   If we blow past that, split: ship `data.words.json` + `data.chars.json`
   as two files, keep the search index small (no English defs in index, look
   them up by index on hit).

Output stays at `chinese/data.json` (or splits into `data.words.json` /
`data.chars.json` if needed — Pages workflow `cp` list updates accordingly).

## UI redesign (`chinese/index.html` + `app.js` + `styles.css`)

### Home screen

```
┌────────────────────────────────────────┐
│  ← Apps        中文                    │
├────────────────────────────────────────┤
│  ┌──────────────────────────────────┐  │
│  │ 🔍  Search 汉字, pinyin, English │  │   ← always-visible, large
│  └──────────────────────────────────┘  │
│  [ HSK 1 ] [ HSK 2 ] [ HSK 3 ] [ HSK 4 ]│   ← optional level chips
│                                        │
│  Suggested                             │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐         │   ← seed shelf, scrollable
│  │好│ │想│ │学│ │吃│ │家│ │…│          │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘         │
│                                        │
│  All HSK 1–4 words                     │
│  (virtualized grid, paged 60 at a time)│
└────────────────────────────────────────┘
```

- Search input is `position: sticky; top: 0` so it stays accessible while the
  grid scrolls.
- Live results dropdown under the search bar: top 20 matches ranked by
  (1) exact hanzi prefix, (2) pinyin prefix tone-stripped, (3) english
  substring. Each result is a clickable row with hanzi · pinyin · gloss.
- Hitting Enter on a non-empty query opens the top result's detail view.
- Esc / clearing the input restores the home view.
- Keep the seed-shelf grid for browsing without typing.

### Detail view (Dong-Chinese-style)

For each character of the opened word, render a `.char-section` with:

```
┌──────────────────────────────────┐
│  好  hǎo                          │
│  good; to like                    │
│                                  │
│  ┌──────────┐                    │
│  │          │   ← tinted stroke  │
│  │   好     │      glyph         │
│  │          │                    │
│  └──────────┘                    │
│  Components                      │
│  ● 女 nǚ  woman    (meaning)     │
│  ● 子 zǐ  child    (meaning)     │
│  Notes: It is good (好) for a … │
└──────────────────────────────────┘
```

The **tinted stroke glyph** is the centerpiece. Implementation:

- Use `HanziWriter.create(target, char, { showCharacter: false })` then call
  `.animateCharacter()` once on mount, with `onComplete` leaving the char
  visible.
- After hanzi-writer renders, walk the SVG paths it injected. Each `<path>`
  in the rendered char is one stroke, in stroke order.
- For each component in `lexicon.getEtymology(char).components`, read its
  `fragment` range (`[start]` means [start, totalStrokes); `[start, end]`
  means [start, end)) and assign every path in that range a CSS class
  `.role-meaning | .role-sound | .role-iconic | …`, mapped to the existing
  `--role-*` color tokens already in `styles.css`.
- Strokes that don't fall inside any fragment (rare) get `.role-unknown`.
- Component rows below the glyph are clickable; tapping one pushes a new
  modal stack entry for that component char, recursively. Hover/focus on a
  component row also temporarily highlights only its strokes (via
  `[data-active-component]` state on the glyph).

### Modal stack

Behavior is unchanged: clicking a component pushes; browser Back pops. The
search dropdown does NOT push history — only opening a detail does.

## File-level changes

| File | Change |
|---|---|
| `scripts/extract-chinese.mjs` | Replace `SEED_WORDS` with HSK loader; emit `searchIndex`; emit `hsk` level on each word; widen BFS closure. |
| `scripts/hsk-3.0-1-4.json` | New: vendored HSK 3.0 levels 1–4 vocabulary list with source attribution in a header field. |
| `chinese/data.json` | Regenerated. Possibly split into `data.words.json` + `data.chars.json` if size > 800 KB. |
| `chinese/index.html` | Search input becomes the centerpiece; remove `#empty` placeholder reuse; add `#suggested-shelf` and `#all-grid` containers; bump `?v=` and `page-id` to `chinese v5`. |
| `chinese/app.js` | New search module (debounced input → ranked filter against `data.searchIndex`); split rendering into `renderHome`, `renderResults`, `renderDetail`; new `paintComponentColors(svgEl, etymology)` helper that tints stroke paths by `fragment` ranges. |
| `chinese/styles.css` | Sticky search-bar styles; `.search-results` dropdown; `.glyph-svg path` color rules per `.role-*`; preserve existing component-chip / mnemonic styles. |
| `.github/workflows/pages.yml` | If `data.json` is split, add the new file(s) to the `cp` list. |

## Implementation steps (in order)

1. **Vendor HSK list.** Download HSK 3.0 1–4 word list to
   `scripts/hsk-3.0-1-4.json`; verify count (~2000) and that
   `chinese-lexicon` resolves > 95 % of entries.
2. **Extend extractor.** Add HSK loader, emit `searchIndex` and `hsk` level,
   widen BFS. Run it; sanity-check `data.json` size and that `好` etymology
   `fragment` data is preserved end-to-end.
3. **If size > 800 KB,** split into `data.words.json` + `data.chars.json`,
   update `app.js` to fetch both in parallel on boot, update Pages workflow.
4. **Build the search UI.** Sticky input → debounced filter → results list.
   Wire Enter / Esc. Verify pinyin tone-strip search works (`ni hao` finds
   你好).
5. **Build the tinted-stroke glyph.** New `paintComponentColors` helper.
   Test with multiple chars, especially ones with `fragment: [n]` (open-ended)
   and with components that span non-contiguous strokes (skip & log if any).
6. **Re-skin detail view** to the Dong-Chinese-style layout (large glyph,
   pinyin under hanzi, component rows with role dots, notes block).
   Preserve mnemonic textarea + cross-links.
7. **Suggested shelf.** Keep ~30 hand-picked seed words above the full HSK
   grid for first-time users.
8. **Bump `page-id` to `chinese v5`** and the `app.js?v=` query string. Push
   to `claude/chinese-learning-app-FwFiZ`. Verify GitHub Pages deploy and
   spot-check on iPhone (the existing mobile breakpoint logic still applies).

## Risks & open questions

- **HSK list licensing.** The official HSK 3.0 list is published by Hanban;
  community CSVs are widely redistributed but check the source's license
  before vendoring. If unclear, fall back to the older HSK 1–5 list (CC-BY
  variants exist).
- **Bundle size.** 2000 words × etymology + 2000-entry search index could
  push past 800 KB. Mitigation already noted (split data, drop English from
  the index, gzip-on-Pages is automatic).
- **`fragment` coverage.** Not every char in `chinese-lexicon` has etymology
  with `fragment` ranges. Falls back gracefully: untinted glyph, no component
  rows, just the definition + stroke animation. Log a count during extraction
  so we know how many chars are affected.
- **Stroke-path identity.** HanziWriter renders strokes as `<path>` children
  of a group — the CSS approach assumes path order matches stroke order.
  This is true today; a HanziWriter major-version bump could break it.
  Pin the CDN URL to `hanzi-writer@3.7` (already done) and add a
  smoke-check assertion in `app.js`.
- **First-load cost.** Single `data.json` ≥ a few hundred KB blocks the
  initial render. Show a tiny "loading lexicon…" spinner while fetching;
  the seed shelf can render skeleton cards in the meantime.

## Out of scope for v2

- Audio pronunciation.
- Spaced-repetition / progress tracking.
- Account sync (mnemonics still localStorage-only).
- Sentence examples (chinese-lexicon doesn't ship them; would need a
  separate corpus).

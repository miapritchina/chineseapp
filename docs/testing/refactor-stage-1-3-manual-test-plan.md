# Manual test plan — refactor stages 1–3

For Claude Cowork (or any agent with browser access). The goal is to
verify that the cloud-sync extraction, context migration, Zustand UI
store, and auto-import hook in commits `dfda42d…7850db3` preserved
existing behavior — none of these stages added features.

## Setup

1. Check out the branch:
   ```
   git checkout claude/add-documentation-files-B6rCj
   git pull
   ```
2. Install + start:
   ```
   npm install
   npm run dev
   ```
3. Open the dev URL (default `http://localhost:5173/chineseapp/`) in a real
   browser. Keep the devtools Console open — **any red error or
   `useXxxCtx used outside <AppStateProvider>` throw is a regression**.
4. Run the automated suites first:
   ```
   npm test          # ~37 cases, must all pass
   npm run typecheck # must be clean
   ```
   Stop and report if either fails.

## What to verify

Work through each section. For each row, do the action and check the
expected result. **Stop and report on any mismatch** — that's the
regression the refactor was supposed to avoid.

### 1. Saved-shelf + status (covers useSaved + SavedCtx)

| Action | Expected |
|---|---|
| Open the home shelf with no auth | Saved/Learned/Wrote/Need-to-learn sections render; if cold the shelf empty-state shows |
| Search `你好`, tap the ★ on the result | Result row's status pill flips; word appears in the Saved section of the home shelf |
| Tap the status pill on a saved card → 🎓 Learned | Card moves to the Learned section |
| Tap → ✒ Wrote | Card moves to Wrote section; in the next step the Review queue should now seed a `production` card for it |
| Tap → ❗ Need-to-learn | Card moves to "Need to learn" |
| Tap status → ☆ (clear) | Card disappears from the shelf |
| Reload the page | All status changes persist exactly as they were (this exercises localCache + Supabase reconcile) |
| In another tab open the same URL, change a status there, switch back to the first tab | The first tab updates within ~1 second of regaining focus (this exercises `useReconcileTriggers` focus reconcile) |

### 2. Search (covers Zustand `useUIStore` + `useDictCtx`)

| Action | Expected |
|---|---|
| Type `nihao` slowly | Debounced search fires after ~200ms; results show within a second |
| Clear the input | Empty state / saved shelf returns |
| Switch search mode to "By component" | Search behavior changes to component-closure; UI mode pill is selected |
| Switch to "Sentence" | `SentenceStudio` renders instead of results |
| Switch back to "All" | Default behavior restored |
| Refresh the page | None of these mode/query values persist (they live in Zustand, intentionally not persisted) |

### 3. Modal stack + deep links (covers `useModalStack` — kept as-is)

| Action | Expected |
|---|---|
| Tap a result | `EntitySheet` slides up; URL becomes `#/w/<word>` |
| In the sheet, tap a constituent char chip | A new sheet stacks on top; URL updates |
| Tap ⤢ "full tree" | `TreeModal` opens for the topmost entry |
| Press Esc | Tree closes, returning to the sheet |
| Press the OS / browser Back button repeatedly | Stack pops one entry per Back, then exits to home |
| Reload `#/c/字` directly | Page boots and opens the char sheet for 字 |

### 4. Review surface (covers `useReview` + `useReconcileTriggers` + ReviewCtx)

| Action | Expected |
|---|---|
| Save 3–5 words, then open Review from the hamburger | `ReviewLaunch` shows facet counts and starts on tap |
| Grade a card Good | Card advances; the next due card appears |
| Grade a saved single-char ✒ word | A `production` (Hanzi-Writer trace) card should appear eventually |
| Close & re-open Review from a fresh page load | Queue state is restored from Supabase/local cache |
| Sign in (magic link) while on Review | The queue stays intact; no duplicate cards seeded |
| ClusterRecall (≥3 saved words) → "Start cluster" | Cluster cells render, taps reveal, grading the cluster returns to the launch screen |

### 5. PhoneticsPage (covers `useSavedCtx`)

| Action | Expected |
|---|---|
| Open the Phonetics page from the hamburger | List of phonetic components loads |
| Change a component's status via the inline status pill | New status reflects in the Saved shelf; reload persists it |

### 6. Sign in (covers `useAuthCtx`)

| Action | Expected |
|---|---|
| Tap "Sign in" → enter a real email → submit | Magic link is sent (or staging-mode behavior); modal closes once session lands |
| Sign out | Saved set falls back to local-only; no `Cannot read properties of null` errors |

### 7. Mnemonics (covers `useMnemonicsCtx`)

| Action | Expected |
|---|---|
| Open an EntitySheet → 💡 Make it stick → type a mnemonic | The text persists across page reloads |
| Edit the mnemonic on another device / tab (or simulate by editing localStorage) | After tab refocus, the newer version wins |

### 8. Auto-import (covers `useAutoImport`)

| Action | Expected |
|---|---|
| Open `?import=/chineseapp/sample-saved.json` (host a small JSON `{ "saved": ["你好","谢谢"] }` somewhere same-origin) | Confirm dialog → words land in saved set → URL strips `?import=` |
| Open a share link generated from the hamburger "Share my words" | Confirm dialog → words land → URL strips `?share=` |
| Open `?clear=1` | Confirm dialog → saved set cleared → URL strips `?clear=` |
| Reload the same `?import=` URL | Effect must NOT re-fire (URL was already stripped) |

### 9. Modal sheet variants (covers `useCharsCtx` + `useDictCtx` + `useMnemonicsCtx`)

| Action | Expected |
|---|---|
| Open the sheet for a word with etymology | "Made of" section shows constituent chars with pinyin + glosses |
| Open the sheet for a phonetic component | Family list renders |
| Tap the speaker icon on the sheet | Web Speech speaks the word/char |

## Regression report shape

If anything diverges from the expected column, capture:
- A screenshot of the broken state
- The URL when it happened
- Any Console error (red text in devtools)
- The browser + OS

Post that in a reply or as a PR comment — don't try to fix in this
session; the next session will pick it up with full context.

## Things the refactor did NOT touch (skip these)

- The Cytoscape graphs at `/network/` and `/components/` — still
  plain-HTML, unchanged.
- The visual styling — `styles.css` is unchanged (Stage 6 deferred).
- Drill component internals — `CombinedRecognitionCard`,
  `PhoneticTapCard`, etc. still own their own state (Stage 4 deferred).
- The `EntitySheet` internals — still a single file (Stage 5 deferred).

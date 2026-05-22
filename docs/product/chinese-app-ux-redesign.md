# Chinese App — UX/UI Redesign Spec

Owner interview + QA findings, May 12 2026. Paste sections into Claude Code as needed.

---

## ✅ Shipped (as of v90)

A UX implementation pass landed most of this spec before the v90 baseline (tagged
`UX-2`, `UX-10`, … in `styles.css`/components) but was never recorded here. Verified
against the code on this branch:

| Spec item | Status | Evidence |
|---|---|---|
| 1A — 3-tab home (Dictionary / My Words by Component / Sentence) | ✅ | `SearchBar.tsx` `TABS` |
| 1B — Sentence is a tab (also reachable via `#/sentence`) | ✅ | `App.tsx` `searchMode === "sentence"` |
| 2A — four grade colors, Easy ≠ red | ✅ | `--grade-again/hard/good/easy` tokens; `.review-btn-*` |
| 2B — swipe-to-grade (right = Good, left = Again) | ✅ | `CombinedRecognitionCard.tsx` `onTouchStart/End` |
| 2C / "transient hints" | ✅ | `UX-2` once-per-session continue hint |
| 3 — type scale | ✅ | `--hanzi-hero|large|medium|small`, `--heading-1/2`, `--body`, `--caption` in `styles.css :root` |
| 4F — review progress bar | ✅ | `ReviewProgressBar` in `ReviewPage.tsx` |
| 4I — dark-mode role colors lightened | ✅ | `UX-10`, dark `:root` block |
| 4K — distinct status-tier icons/colors | ✅ | `--status-saved/learned/wrote/review`; `StatusButton` icons |
| BUG-2 — Supabase persistence | ✅ | cloud-first hooks ([ADR-0001](../decisions/0001-supabase-source-of-truth.md)) |
| BUG-3 — search exact-match ranking | ✅ | `useDictionary.ts` exact-match partition |
| BUG-5 — Easy grade red border | ✅ | per-grade `--grade-color` outline |
| 9.2 — role hues single-sourced (no hex in `roleColor()`) | ✅ | `EntitySheet.tsx` uses `var(--role-*)` |

**Still pending** (the real backlog): §0 unified `<Entity>`, §8 shared UI components,
1C drop-2-drills (deferred by owner), 4G graph performance. BUG-1 (deep links) appears
wired in `App.tsx` but awaits a live browser confirmation.

---

## 0. Core Design Primitive — The `<Entity>` Component

### The Problem

A character/word entity appears in **8 different places**, each with different amounts of info and different visual treatment. They don't feel like the same thing. The owner wants one configurable component with consistent visual DNA across all sizes.

### Where it appears today (all of these are the same conceptual element):

| Context | Current look | Size tier |
|---------|-------------|-----------|
| Graph node (network/components) | Circle or shape, label only | **Tiny** |
| Etymology glyph (EntitySheet decomposition) | Role-colored character, small | **Small** |
| Phonetics family preview character | Plain character in a row | **Small** |
| Saved shelf card | Card with pinyin/hanzi/english/star | **Medium** |
| Search result row | Row with pinyin/hanzi/english/star | **Medium** |
| Sentence word bank chip | Chip with POS stripe + hanzi | **Medium** |
| Tree modal node | Card with role color + definition | **Medium** |
| EntitySheet header | Large hanzi + eyebrow + POS | **Large** |

### The `<Entity>` component spec

One component: `<Entity char="好" size="tiny|sm|md|lg" />`

**Always rendered (all sizes):** hanzi + pinyin + meaning (English gloss)

**Progressive disclosure layers** (added as size increases):

| Layer | Added at size | What it shows |
|-------|--------------|---------------|
| Base | All sizes | Hanzi, pinyin, first English gloss |
| +POS | Small and up | Part-of-speech tag (noun, verb, adj…) |
| +Status | Medium and up | ★/🟢/✒/❗ status indicator |
| +Components | Large only | Component breakdown, etymology, full gloss list |

### The 4 size variants

**Tiny** (graph nodes) — ~22px hanzi. Pinyin and meaning appear on hover/long-press, not inline. The component renders as a compact circle/pill. Role-color border if applicable.

**Small** (etymology glyphs, phonetics preview) — ~28px hanzi. Pinyin below, meaning as tooltip or single-line truncated. POS as a subtle colored dot or left-edge stripe. Role-color border when used in etymology context.

**Medium** (shelf cards, search rows, word bank chips, tree nodes) — ~40px hanzi. Pinyin above or beside, meaning below (truncated to 1 line). POS badge visible. Status icon visible. Role-color border when applicable (tree nodes). This is the workhorse size — used in most contexts.

**Large** (EntitySheet header) — ~56px hanzi. Full eyebrow (pinyin · tone · frequency). Full POS + all glosses. Status dropdown. Component breakdown section. This is the entry point to the full EntitySheet.

### Visual DNA (shared across all sizes)

These rules apply no matter the size:

- **Hanzi is always the visually dominant element** — largest font in the component
- **Pinyin is always adjacent to its hanzi** — never separated by other content
- **Role colors** follow the same palette everywhere: Iconic = blue border, Meaning = green border, Sound = red border. Applied as a left-edge stripe or full border depending on context.
- **Status icons** use the same color/icon mapping everywhere (see section 4K)
- **Font ratios** are proportional: pinyin = ~50% of hanzi size, meaning = ~40% of hanzi size
- **Tap behavior:** default is open EntitySheet. Parent can override (e.g. Sentence tab adds to composer instead). Graph nodes use double-tap to navigate.
- **Spacing rhythm:** internal padding scales with size (8px tiny, 12px small, 16px medium, 20px large)

### Owner's M→P Mapping Decisions (May 12 2026)

Card-by-card decisions on which proposed variant replaces each existing card type. See `card-type-catalog.html` for visual reference.

| Existing | Name | → Target | Notes |
|----------|------|----------|-------|
| M1 | Shelf Card | **P3** | Medium Entity. Primary use case. |
| M2 | Result Row | **Keep M2** | Current horizontal row layout is correct. Don't unify. |
| M3 | EntitySheet Header | **P4** | Large Entity. Owner likes M4's role-color fills (not just borders) for component glyphs inside. |
| M4 | Etymology Glyph | **Keep M4** | Role-colored text approach works better than bordered cards in decomposition equation. |
| M5 | "In Your Saved Words" | **→ M2** | Merge into Result Row layout. Same horizontal style. |
| M6 | NodeCard (tree) | **Custom redesign** | Keep role-colored border + etymology note. Not a standard P variant — needs its own treatment. |
| M7 | Bank Chip | **P2** | Small Entity. Downsized from P3. |
| M8 | Composer Token | **P1** | Tiny Entity. Downsized from P2. |
| M9 | Phonetics Row | **Custom (M6+M2)** | Row layout like M2, richness like M6. **Add 🔊 sound button.** Family preview strip stays. |
| M10 | Component Chip | **P1** | Tiny Entity pill. |
| M11 | Review Hanzi | **P5 (modified)** | Hero, but with **white background** and **even bigger hanzi** than current P5. |
| M12 | Drill Pick Button | **P1** | Tiny Entity with correct/wrong border flash. |
| M13 | Cluster Cell | **P2** | Small Entity with hidden/revealed state overlay. |
| M14 | Disambig Cell | **P2** | Small Entity in side-by-side layout. Downsized from P5. |
| M15 | Graph Node | **P1** | Tiny Entity. Role-colored circle. |
| M16 | Saved Sentence Row | **Custom (M9+M5+M2)** | Hybrid: M2's row layout + M5's saved-words context + M9's phonetics features. |

**Key takeaways:**
- **Not everything unifies.** M2 (Result Row) and M4 (Etymology Glyph) stay as-is. M6, M9, M16 need custom redesigns.
- **P2 (Small) gets more work** than originally planned — now covers M7, M13, M14 in addition to original assignments.
- **P1 (Tiny) is the most-used variant** — M8, M10, M12, M15 all map to it.
- **P5 (Hero) only applies to M11** (review drill), with white bg + bigger hanzi modification.
- **Three custom cards** (M6, M9, M16) need individual design work — they're hybrids that don't fit a single P variant.

### Why this matters

Building one component means:
- Visual consistency is automatic — change it once, it updates everywhere
- New contexts (future features) just pick a size
- The type scale (section 3) gets enforced through the component, not through scattered CSS
- Easier to maintain and reason about

---

## 1. Architecture Changes

### 1A. Merge Home Page — Kill the Dictionary/My Words Split

**Current:** Two tabs — "DICTIONARY" (search only) and "MY WORDS BY COMPONENT" (grouped saved words). Saved shelf is a separate scroll-down section under Dictionary.

**New design:** Three tabs above the search bar: **Dictionary** / **My Words by Component** / **Sentence**

Behavior of the **Dictionary** tab:
- **Idle (no query):** Show the saved words grid (the current "shelf"). This is the user's personal dictionary — the default landing view.
- **Typing:** Search the full dictionary (all words, not just saved). Saved words in results get a ★ marker to distinguish them from unsaved words.
- **Clear search:** Return to saved words grid.

This means the current separate "saved shelf" section is removed — the idle state of Dictionary IS the shelf.

**My Words by Component** tab stays as-is (grouped view of saved words by shared components).

**Sentence** tab — see section 1B.

### 1B. Sentence Studio Becomes a Tab (Not a Separate Page)

**Current:** Sentence Studio is a separate page accessed via hamburger menu → Sentence (`#/sentence`).

**New:** Sentence is the third tab on the main page, next to Dictionary and My Words by Component. It uses the same search bar — typing filters the word bank (saved words only). Tapping a word adds it as a token to the sentence composer.

The hamburger menu link to "Sentence" should be removed (or redirect to the main page with Sentence tab active).

The Sentence page's current functionality stays the same — composer area, token chips, POS-colored word bank, pinyin output, save/copy. It just lives in a tab instead of a separate route.

### 1C. Review Drills — Drop 2, Keep 4

**Drop:**
- ~~Tap the sound component~~ (asks user to tap which component gives the sound — too granular)
- ~~Sound of a component~~ (asks user to identify a component's sound — too granular)

**Keep:**
- **Meaning** — recognize the meaning of a character/word
- **Sound** — recognize the pronunciation
- **Combined Recognition** — recognize both meaning and sound together
- **Family Transfer** — recognize sound patterns across phonetic families
- **Write** — produce the character from memory

That's 5 drill types remaining (4 recognition + 1 production).

Update the review launch screen to only show these 5. Remove the dropped drill types from the codebase.

---

## 2. Review Card UX Fixes

### 2A. Grading Buttons — Keep All Four, Fix Colors

The owner wants to **keep** Again/Hard/Good/Easy grading (not simplify). But:

**Bug:** When grading "Easy", the card border flashes **red** as if it's an error. The border color should match the button semantics:
- Again → red border
- Hard → orange border  
- Good → green border
- Easy → blue or bright green border (currently shows red — BUG)

Fix the border-color mapping so it matches the grading button that was pressed.

### 2B. Reduce Taps in Review Flow

Current flow: see prompt → tap to reveal → see answer → tap grade button = 2 taps per card.

Suggested improvement: after revealing, let the user **swipe** to grade (swipe right = Good, swipe left = Again) as an alternative to tapping buttons. Buttons remain for Hard/Easy. This makes the common case (Good) a single gesture instead of a tap.

### 2C. More Whitespace on Drill Cards

Cards feel cramped. Add more vertical spacing:
- Between the instruction text and the hanzi: increase from current to ~24px
- Between the hanzi and the answer/options area: increase to ~32px
- Between answer area and grading buttons: increase to ~24px
- Overall card padding: increase to 24px on all sides

---

## 3. Typography Overhaul

### The Problem

Font sizes feel random — no clear hierarchy. The owner's #1 pain point is **visual density**. Characters are too small everywhere.

### Proposed Type Scale

The app needs a strict scale with clear roles. Here's a proposal for the owner to review:

| Role | Current (approx) | Proposed | Where used |
|------|------------------|----------|------------|
| **hanzi-hero** | 80px | **120px** | Review drill card focal character |
| **hanzi-large** | 32–36px | **52px** | Saved shelf cards, EntitySheet main character |
| **hanzi-medium** | 24–28px | **36px** | Search results, Sentence word bank chips, component preview |
| **hanzi-small** | 14–18px | **22px** | Phonetics family preview, inline component references |
| **heading-1** | ~18px | **20px** | Section headers (ETYMOLOGY, MAKE IT STICK) |
| **heading-2** | ~14px | **16px** | Sub-headers, POS labels |
| **body** | ~13px | **15px** | English glosses, descriptions, pinyin |
| **caption** | ~10px | **12px** | Metadata, timestamps, frequency labels |

Key principles:
- Hanzi is always the largest element on any screen
- Minimum touch target: 44×44px
- Pinyin always appears with its hanzi, at body size
- English glosses are secondary — never compete with hanzi for attention

**Action:** Present this scale to the owner for feedback before implementing. It's a proposal, not final.

---

## 4. Specific UX Fixes

### 4A. Saved Shelf Cards — Bigger Hanzi

Bump card hanzi from ~32px to **52px** (per type scale). Cards have room. English gloss stays at 12px caption size.

### 4B. Search Result Rows — Bigger Hanzi  

Result row hanzi from ~28px to **36px**. Saved words get a ★ marker (filled orange for saved, outline for unsaved).

### 4C. Sentence Word Bank Chips — Bigger Hanzi

Chip hanzi from ~24px to **36px**. POS indicator should be a thin colored left-edge stripe, not an overlaid pill competing for space.

### 4D. Long Words Overflow (发展中国家)

For words >3 characters: reduce hanzi font size adaptively on the card (e.g. 52px → 36px → 28px as length increases). Pinyin can wrap to a second line. The card should never overflow.

### 4E. EntitySheet — Make Components/Etymology More Prominent

Keep current section order, but:
- Make the ETYMOLOGY section header and the role-colored decomposition visually larger
- The component glyphs in the decomposition (e.g. 女 + 子 = 好) should use hanzi-medium (36px), not the current ~24px
- The ⤢ tree button should be more prominent — larger icon, not just a small button

### 4F. Review Progress Bar

Add a thin progress bar under the review header ("1 / 12"). Fills left to right as cards are completed. Simple gradient or solid color.

### 4G. Graph Pages — Performance + Usability

Both graphs are core features but have two problems:
1. **Performance:** Force layout is slow and janky on mobile. Investigate: reduce node count (show only 1-hop neighbors by default, expand on tap), use WebGL renderer if Cytoscape supports it, or pre-compute layout positions.
2. **Usability:** Nodes are too small to tap. Labels overlap. Fix: increase minimum node size to 44px, add label collision avoidance, make tap targets larger than visual nodes.

Add gesture hint on first visit: "Long-press for translation · Double-tap to open" — auto-dismiss after 5 seconds.

### 4H. Phonetics Page — Needs Visual Refresh

The owner knows this page and uses it, but the presentation needs work. Specific fixes:
- Increase family preview character size from ~14px to **22px** (hanzi-small)
- Make the main component character larger: from ~32px to **44px**
- Better visual grouping between families
- Consider adding a search/filter for the 250 components

### 4I. Dark Mode Role Colors

Lighten the green (meaning) and blue (iconic) etymology role colors by ~20% in dark mode. Use CSS custom properties with a `prefers-color-scheme: dark` override.

### 4J. "Save Sentence" Button Contrast

Currently a ghost button that looks disabled. Give it a visible border or light fill so it looks tappable. Primary action (save) should be more visually prominent than secondary (copy).

### 4K. Status Tier Icons — Consistency

Use distinct colors/icons per tier everywhere (shelf cards, EntitySheet, dropdown):
- ★ orange → Saved
- 🟢 green → Learned  
- ✒ purple → Wrote
- ❗ red → Need to learn
- ☆ outline → Remove/unsaved

Currently the shelf shows the same orange star for all tiers.

---

## 5. Bugs (from QA, repeated for completeness)

| ID | Severity | Description |
|----|----------|-------------|
| BUG-1 | Medium | Deep links `#/c/好` and `#/w/你好` don't open EntitySheet |
| BUG-2 | Medium | localStorage used for persistence — should be Supabase for signed-in users |
| BUG-3 | Low | Search "中国" saves "发展中国家" — exact match should rank first |
| BUG-4 | Cosmetic | Hamburger dismiss: Escape causes layout shift, outside-click sometimes misses |
| BUG-5 | Medium | Review: "Easy" grade shows red border (should be green/blue) |

---

## 6. What's Working Well (Don't Break)

- 0 console errors across all pages
- Dark mode is solid everywhere
- EntitySheet bottom-sheet (mobile) / centered modal (desktop) pattern
- Back/forward hash navigation
- Crushed POS tabs regression is FIXED in v84
- Auth magic-link flow is clean
- Etymology drill-down (tap component → new sheet → Back returns) works perfectly
- Tree modal with role-colored nodes is the app's most impressive feature

---

## Priority Order for Implementation

1. **BUG-5** — Easy grade red border (quick fix, high annoyance)
2. **Typography scale** — present proposal, get approval, implement (biggest visual impact)
3. **BUG-1** — Deep link routes
4. **1A** — Merge home page tabs (biggest architecture change)
5. **1B** — Sentence as tab
6. **1C** — Drop 2 drill types
7. **BUG-3** — Search exact-match ranking
8. **4G** — Graph performance + usability
9. **BUG-2** — localStorage → Supabase
10. Everything else in section 4

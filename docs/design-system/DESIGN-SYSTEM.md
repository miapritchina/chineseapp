# Design System — Chinese-Character Learning App

> For import into Claude Design or as a reference when designing new screens.
> Hand-maintained reference, current as of the v90 UX pass. Values mirror the codebase (`src/styles.css`, `src/lib/pos.ts`, `src/lib/tree.ts`, `src/lib/types.ts`, component source files) — re-verify against `src/styles.css :root` when it changes. See also `design-tokens.css` for a token file and `style-guide.html` for a visual reference.

---

## 1. Brand & Voice

A warm "paper and ink" palette: off-white background, near-black ink, a single muted-red ("vermillion") accent. Color is **functional, not decorative** — the only saturated hues are the role colors that encode a character's decomposition semantics (blue = iconic, green = meaning, red = sound, purple = simplified) and the part-of-speech tints in the Sentence Studio. Dark mode is a first-class citizen, not an afterthought. The app is mobile-first, targeting iPhone Safari in 3–7 minute sessions, with a desktop breakpoint at 700 px that switches bottom sheets to centered modals. Typography prioritizes large, readable hanzi with restrained Latin UI text.

---

## 2. Color

### 2.1 Core palette

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg` | `#faf8f4` | `#16140f` | Page background |
| `--card-bg` | `#ffffff` | `#211e15` | Card surfaces in the saved grid |
| `--surface` | `#fefdfb` | `#1d1a13` | Elevated panel (hamburger, review card, status menu, composer, bank chip, sheet) |
| `--surface-2` | `#f0ece4` | `#272319` | Hover fills, active pill backgrounds, subtle elevation |
| `--text` | `#1d1b18` | `#ece7dc` | Primary ink / body text |
| `--muted` | `#6b6359` | `#a39c8f` | Secondary text, captions, hints |
| `--accent` | `#b12a2a` | `#e07070` | Vermillion — CTAs, active states, error links |
| `--border` | `#e4dfd5` | `#2a2620` | Dividers, card outlines, input borders |

> **Note:** `--surface` is now **defined in `:root`** (`#fefdfb` light, `#1d1a13` dark) — a slightly elevated tier between `--bg` and `--card-bg`. The `var(--surface, var(--bg))` fallbacks in the rules are now redundant but harmless.

### 2.2 Decomposition role colors

Used to tint tree-node cards, SVG link strokes, role badges, and etymology-row glyphs. Each character component is colored by its semantic role in the decomposition.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--role-iconic` | `#16a34a` | `#4ade80` | Pictographic / form (Dong Chinese: green) |
| `--role-meaning` | `#dc2626` | `#f87171` | Semantic (Dong Chinese: red) |
| `--role-sound` | `#2563eb` | `#60a5fa` | Phonetic (Dong Chinese: blue) |
| `--role-remnant` | `#84cc16` | `#bef264` | Derived from part of another character (chartreuse) |
| `--role-simplified` | `#0d9488` | `#5eead4` | Component changed during simplification (teal) |
| `--role-deleted` | `#6b7280` | `#9ca3af` | Component removed during simplification |
| `--role-distinguishing` | `#9333ea` | `#c084fc` | Added to distinguish a similar character (purple) |
| `--role-unknown` | `#6b7280` | `#9ca3af` | Role undetermined |
| `--role-word` | `#1d1b18` | `#ece7dc` | Word-root node (matches `--text`) |

The eight component categories follow the [Dong Chinese taxonomy](https://www.dong-chinese.com/wiki/home#components): _meaning_, _sound_, _iconic_, _remnant_, _simplified_, _deleted_, _distinguishing_, _unknown_.

### 2.3 Part-of-speech colors (Sentence Studio)

Set inline as `--pos-c` per chip/token in `SentenceStudio.tsx`. Values from `src/lib/pos.ts` `POS_COLOR`. Not yet defined as CSS custom properties in the stylesheet — promoted to tokens in `design-tokens.css`.

| POS | Hex | Label |
|---|---|---|
| `pron` | `#6b3a8a` | Pronoun (purple) |
| `v` | `#b14430` | Verb (vermillion) |
| `n` | `#2f5a8e` | Noun (steel blue) |
| `adj` | `#4f7d3a` | Adjective (leaf green) |
| `adv` | `#8a6a26` | Adverb (ochre) |
| `part` | `#8a8273` | Particle (warm gray) |
| `conj` | `#7a6a8a` | Conjunction (mauve) |

These are **not overridden for dark mode** — they're used as border-left accents and tiny POS badge backgrounds, which remain legible on both themes.

### 2.4 Status tier colors

> v99 ([ADR-0011](../decisions/0011-two-tier-status-model.md)): only
> **saved** and **learned** are selectable; the review/wrote tokens
> remain for legacy data rendering.

| Status | Emoji | Light | Dark |
|---|---|---|---|
| ★ Saved | ★ | `#d97706` | `#f59e0b` |
| ❗ Need to learn | ❗ | `#c2410c` | `#fb923c` |
| 🎓 Learned | 🎓 | `#2e7d32` | `#6dba84` |
| ✒ Wrote | ✒ | `#7a3aa8` | `#b07ad8` |

Used in `StatusButton` (`.status-btn`, `.status-menu-item`), the result-row star, and the `card-usage-icon`.

### 2.5 Grade button colors

| Grade | Token | Light | Dark |
|---|---|---|---|
| Again | `--grade-again` | `#b91c1c` | `#f87171` |
| Hard | `--grade-hard` | `#d97706` | `#fbbf24` |
| Good | `--grade-good` | `#15803d` | `#4ade80` |
| Easy | `--grade-easy` | `#1d4ed8` | `#60a5fa` |

Each `.review-btn-*` sets `--grade-color` to its tier color; the picked button takes `outline: 2px solid var(--grade-color)` (this is the BUG-5 fix — Easy reads blue, not red).

### 2.6 Feedback / drill result colors

| State | Text (light) | Background (light) | Border (light) |
|---|---|---|---|
| Correct | `#2e7d32` | `rgba(46, 125, 50, 0.12)` | `#2e7d32` |
| Wrong | `#b91c1c` | `rgba(185, 28, 28, 0.12)` | `#b91c1c` |

Dark overrides: Correct → `#6dba84` / `rgba(109,186,132,0.15)` / `#6dba84`; Wrong → `#f87171` / `rgba(248,113,113,0.15)` / `#f87171`.

### 2.7 Other one-off colors

| Value | Where | Note |
|---|---|---|
| `#b03a2e` bg + `#fff` text | `.error-banner` | Global error strip |
| `rgba(20, 18, 14, 0.42)` | `.popup-backdrop` (light) | Warm translucent overlay |
| `rgba(0, 0, 0, 0.6)` | `.popup-backdrop` (dark) | Neutral translucent overlay |
| `rgba(0, 0, 0, 0.34)` | `.sheet-backdrop` | Entity sheet scrim |
| `#222` / `#ddd` | HanziWriter fallbacks in EntitySheet + ProductionCard | Read via getComputedStyle; should use `var(--text)` / `var(--border)` |

### 2.8 CSS token blocks

```css
:root {
  --bg: #faf8f4;
  --card-bg: #ffffff;
  --surface-2: #f0ece4;
  --text: #1d1b18;
  --muted: #6b6359;
  --accent: #b12a2a;
  --border: #e4dfd5;

  --role-iconic:         #16a34a;
  --role-meaning:        #dc2626;
  --role-sound:          #2563eb;
  --role-remnant:        #84cc16;
  --role-simplified:     #0d9488;
  --role-deleted:        #6b7280;
  --role-distinguishing: #9333ea;
  --role-unknown:        #6b7280;
  --role-word:           #1d1b18;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16140f;
    --card-bg: #211e15;
    --surface-2: #272319;
    --text: #ece7dc;
    --muted: #a39c8f;
    --accent: #e07070;
    --border: #2a2620;

    --role-iconic:         #4ade80;
    --role-meaning:        #f87171;
    --role-sound:          #60a5fa;
    --role-remnant:        #bef264;
    --role-simplified:     #5eead4;
    --role-deleted:        #9ca3af;
    --role-distinguishing: #c084fc;
    --role-unknown:        #9ca3af;
    --role-word:           #ece7dc;
  }
}
```

---

## 3. Typography

### 3.1 Font stacks

| Name | Stack | Usage |
|---|---|---|
| **Body / UI** | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif` | All body text, buttons, labels |
| **Hanzi** | `"PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", system-ui, sans-serif` | Every Chinese character display: cards, sheets, drills, etymology rows, composer tokens |
| **Mono** | `ui-monospace, SFMono-Regular, Menlo, monospace` | Eyebrow labels (Nº 01 · ETYMOLOGY), POS tags, section numbers, sheet-pos |

### 3.2 Type scale

**Canonical scale tokens** (defined in `styles.css :root`, added in the v90 UX pass — prefer these over raw px in new work):

| Token | Value | Role |
|---|---|---|
| `--hanzi-hero` | `120px` | review drill focal character |
| `--hanzi-large` | `52px` | EntitySheet header, shelf cards |
| `--hanzi-medium` | `36px` | search results, word bank, component preview |
| `--hanzi-small` | `22px` | phonetics preview, inline refs |
| `--heading-1` | `20px` | section headers |
| `--heading-2` | `16px` | sub-headers, POS labels |
| `--body` | `15px` | glosses, pinyin, descriptions |
| `--caption` | `12px` | metadata, timestamps |

The detailed per-class tables below are the historical/raw inventory; where a class predates the tokens it still uses literal px. New components should consume the tokens.

#### Display hanzi (hero glyphs)

| Size | Weight | Line-height | Where |
|---|---|---|---|
| 120 px | 500 | 1 | `.sheet-glyph-fallback` — EntitySheet single-char |
| `clamp(40px, 13vw, 60px)` | 500 | 1.05 | `.sheet-glyph-text` — EntitySheet multi-char word |
| 96 px | 500 | 1 | `.phonetic-tap-glyph` — PhoneticTap / ComponentSound drill prompt |
| 84 px | 500 | 1.1 | `.review-hanzi` — Combined recognition card |
| 80 px | 500 | 1.1 | `.family-transfer-target` — FamilyTransfer drill |
| 64 px | 500 | 1 | `.disambig-cell-glyph` — Disambiguation compare |
| 132 px | 400 | 1 | `.card-glyph-fallback` — DecompositionTree node (inside SVG foreignObject, so actually renders at node scale) |

> **Design preference:** Prefer larger hanzi. On mobile, anything below ~40 px for a focal glyph feels cramped. The `clamp(40px, 13vw, 60px)` on multi-char words is a good pattern.

#### Large hanzi (in-context)

| Size | Weight | Where |
|---|---|---|
| 46 px | 400 | `.card .char` — saved-grid cards |
| 38 px | 400 | `.card .char` at ≤ 480 px breakpoint |
| 36 px | 500 | `.cluster-cell-hanzi` |
| 32 px | 400 | `.result-row .r-hanzi` (22 px at ≤ 480 px) |
| 30 px | — | `.sheet-etym-glyph`, `.phonetics-row-char`, `.phonetic-tap-pick-char` |
| 26 px | 500 | `.bank-chip-c` — Sentence Studio word bank |
| 24 px | — | `.family-transfer-question`, `.review-attrib-pick` |
| 22 px | 500 | `.composer-token-c` |
| 20 px | — | `.sheet-saved-hanzi` — "in your saved words" rows |
| 17 px | — | `.saved-sentence-hanzi` |

#### Body / UI text

| Size | Weight | LH | Where |
|---|---|---|---|
| 22 px | — | — | `.review-pinyin`, `.production-prompt-pinyin` |
| 18 px | 500 | — | `.review-pinyin-lg` (is actually 32 px; see below), `.signin-title`, `.modal-title`, `.review-empty-title`, `.component-sound-pinyin` |
| 17 px | 500 | — | `.topbar h1` |
| 16 px | — | 1.4 | `.sheet-defs`, `.review-gloss`, `.phonetics-row-family` |
| 15 px | 500 | — | `.review-btn`, `.launch-option-label`, `.signin-submit`, `.search-bar input` (declared twice; also 16 px) |
| 14 px | — | 1.4 | `.hamburger-item`, `.mnemonic-display`, `.status-menu-item`, `.phonetics-row-pinyin`, `.saved-empty`, `.component-sound-tones`, `.sheet-etym-note`, `.production-prompt-gloss`, `.composer-input`, `.sentence-cta` |
| 13.5 px | — | — | `.result-row .r-pinyin` |
| 13 px | — | — | `.review-progress`, `.review-tap-hint`, `.review-gloss-sm`, `.r-gloss`, `.sheet-saved-pinyin`, `.auth-button`, `.sheet-network-link`, `.review-attrib-skip`, `.review-tap-replay`, `.phonetic-tap-prompt`, `.cluster-prompt` |

> `.review-pinyin-lg` is actually 32 px / weight 500 despite the "lg" suffix. This is the large-pinyin treatment for sound-recognition drills.

#### Meta / labels

| Size | Weight | Letter-spacing | Where |
|---|---|---|---|
| 12 px | — | 2.5 px | `.sheet-eyebrow` (mono) |
| 12 px | — | 1.4 px | `.component-table-title`, `.composer-label`, `.saved-sentences-head` |
| 12 px | — | 1 px | `.launch-section-title`, `.review-attrib-title` |
| 12 px | — | 0.6 px | `.review-prompt-hint`, `.disambig-banner` |
| 12 px | — | 0.5 px | `.phonetic-tap-prompt` (already listed), `.review-tap-replay`, `.drill-skip` |
| 12.5 px | — | — | `.saved-empty-hint` |
| 12 px | — | — | `.phonetics-row-count`, `.component-table-hint`, `.cluster-cell-gloss`, `.disambig-cell-gloss`, `.saved-sentence-pinyin`, `.composer-foot .composer-pinyin`, `.bank-chip-g`, `.launch-option-hint`, `.auth-email`, `.phonetic-tap-pick-pinyin`, `.combined-replay`, `.pos-tab` |

#### Mono micro-labels

| Size | Weight | Letter-spacing | Where |
|---|---|---|---|
| 12 px | — | 2.5 px | `.sheet-eyebrow` |
| 11 px | 600 | 2 px | `.sheet-section-name` |
| 11 px | 600 | 1.6 px | `.sheet-pos` |
| 11 px | — | 1 px | `.shelf-title`, `.sort-pill`, `.search-mode-tab`, `.shelf-action`, `.hamburger-soon`, `.composer-clear` |
| 10 px | 500 | 1 px | `.review-kind-tag`, `.modal-title .title-hsk` |
| 10 px | — | 0.6 px | `.mnemonic-saved-tag` |
| 10 px | — | 0.4 px | `.bank-chip-p`, `.composer-token-p` |
| 9 px | 600 | 0.12 em | `.card-role-badge` |
| 8 px | — | 1 px | `.bank-chip-pos` (mono) |

### 3.3 Design note on text sizing

Hanzi and Latin text require different treatment: CJK characters are full-width squares that read well at sizes where Latin text would appear oversized. The app correctly uses the dedicated hanzi font stack for all Chinese character display and the body stack for Latin UI text. On mobile (≤ 480 px), the saved-grid card hanzi drops from 46 → 38 px and result-row hanzi from 32 → 22 px. **Flag:** some body text (12–13 px captions on mobile) may feel tight — consider 13 px as the mobile floor for interactive touch targets' labels.

---

## 4. Spacing & Layout

### 4.1 Spacing values in use

The app uses a loose spacing scale with no strict 4-px or 8-px grid. Commonly recurring values: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 60, 80 px. Padding is typically 8–14 px on mobile, 16–22 px on EntitySheet, 14–18 px on the topbar/search bar.

### 4.2 Border radius scale

| Token | Size | Usage |
|---|---|---|
| `--radius-xs` | 3 px | `.bank-chip-pos` micro-tag |
| `--radius-sm` | 6 px | `.auth-signout`, `.composer-clear` |
| `--radius-md` | 8 px | Buttons (`.hamburger-btn`, `.back-btn`, `.status-btn`), tabs |
| `--radius-base` | 10 px | `.bank-chip`, `.mnemonic-display`, `.sheet-saved-row`, `.auth-dropdown` |
| `--radius-lg` | 12 px | Cards (`.card`), menus (`.hamburger-menu`, `.status-menu`), `.review-btn`, `.launch-option` |
| `--radius-xl` | 14 px | `.phonetic-tap-pick`, `.cluster-cell`, `.disambig-cell`, `.composer` |
| `--radius-2xl` | 16 px | `.node-card` (DecompositionTree) |
| `--radius-3xl` | 18 px | `.popup-panel`, `.review-card` |
| `--radius-4xl` | 22 px | `.sheet-panel` |
| `--radius-pill` | 999 px | Pills, badges, search input, auth button, CTAs |

### 4.3 Shadows

| Name | Value | Usage |
|---|---|---|
| Menu | `0 6px 20px rgba(0,0,0,0.15)` | `.hamburger-menu`, `.status-menu` |
| Sheet (mobile) | `0 -10px 40px rgba(0,0,0,0.22)` | `.sheet-panel` bottom-sheet |
| Modal (desktop) | `0 24px 64px rgba(0,0,0,0.28)` | `.sheet-panel` at ≥ 700 px |
| Dropdown | `0 4px 16px rgba(0,0,0,0.18)` | `.auth-dropdown` |
| CTA (primary) | `0 4px 12px rgba(0,0,0,0.18)` | `.sentence-cta` floating button |
| CTA (secondary) | `0 2px 8px rgba(0,0,0,0.14)` | `.sentence-cta-2nd` |
| Chip lift | `0 2px 0 var(--pos-c, var(--border))` | `.bank-chip:hover` |

### 4.4 Breakpoints

| Query | Width | Effect |
|---|---|---|
| `max-width: 380px` | ≤ 380 px | Word bank → single column |
| `max-width: 480px` | ≤ 480 px | Saved grid condenses, card font shrinks, result-row hanzi shrinks |
| `max-width: 699px` | ≤ 699 px | (Not used in styles.css — only `min-width: 700px` is) |
| `min-width: 700px` | ≥ 700 px | EntitySheet switches from bottom-sheet to centered modal |

> **Inconsistency:** The 700 px boundary uses `min-width: 700px` for the desktop case but there's no matching `max-width: 699px` guard elsewhere. Recommend a canonical breakpoint set: `≤ 380` (compact), `≤ 480` (narrow phone), `≥ 700` (desktop/tablet).

### 4.5 Safe-area usage

The app respects iOS safe areas throughout: `env(safe-area-inset-top)` on `.topbar`, `.review-root`, `.phonetics-root`, `.sentence-root`, `.modal-header`, `.popup-root`; `env(safe-area-inset-bottom)` on `body`, `.review-actions`, `.review-attrib`, `.sentence-cta-wrap`, `.sheet-panel` padding, `.word-bank` bottom padding.

### 4.6 Z-index layers

| Z-index | Element |
|---|---|
| 2 | `.card-status-corner`, `.sheet-grip-zone`, `.modal-header` |
| 3 | `.sheet-dismiss`, `.sheet-status` |
| 4 | `.search-bar` (sticky) |
| 5 | `.topbar` |
| 10 | `.modal-root` (TreeModal) |
| 30 | `.boot-loading` |
| 50 | `.popup-root` (old CharPopup / SignInModal) |
| 55 | `.sheet-root` (EntitySheet) |
| 60 | `.review-root`, `.phonetics-root`, `.sentence-root`, `.auth-dropdown` |
| 80 | `.hamburger-menu`, `.status-menu` |

---

## 5. Motion

### 5.1 Keyframe animations

| Name | Keyframes | Duration / Easing | Usage |
|---|---|---|---|
| `sheet-rise` | `translateY(100%) → translateY(0)` | 0.26 s / `cubic-bezier(0.22, 1, 0.36, 1)` | Mobile bottom-sheet entrance |
| `sheet-pop` | `translateY(10px) scale(0.98) opacity(0) → identity` | 0.18 s / `ease-out` | Desktop modal entrance |
| `drill-tap-hint-pulse` | `opacity: 0.7 → 1 → 0.7` | 1.6 s / `ease-in-out` infinite | "Tap to continue" hint pulse |

### 5.2 Transitions

| Property | Duration | Easing | Usage |
|---|---|---|---|
| `transform` | 0.25 s | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Tree-node position changes |
| `height`, `y` | 0.25 s | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Tree-node foreignObject resize |
| `background`, `border-color` | 0.15 s | — | `.phonetic-tap-pick` state changes |
| `color`, `opacity`, `background` | 0.15 s | ease | `.header-grad`, `.header-brush` hover/active |
| `transform`, `box-shadow` | 0.12 s | ease | `.bank-chip` hover lift |

### 5.3 Motion principles

Per [ADR-0007](../decisions/0007-tap-anywhere-to-advance.md): **No auto-advance timers in drills.** All progression is user-initiated (tap-anywhere-to-advance). The "tap to continue" hint uses a subtle pulse animation (`drill-tap-hint-pulse`) rather than a static label — **design preference: hints should be transient** (fade after ~1.5–2 s or first-occurrence-only), not permanent on-screen text.

---

## 6. Layout Patterns

### 6.1 Bottom sheet / centered modal (EntitySheet shell)

The primary detail surface. On mobile (< 700 px): slides up from the bottom with a drag-handle, rounded top corners (22 px), translucent backdrop with 1 px blur. The grip zone is sticky at the top for drag-to-dismiss. On desktop (≥ 700 px): centered modal with all-round 22 px radius, deeper shadow (`0 24px 64px`), scale-in animation (`sheet-pop`), no drag handle.

Key CSS: `.sheet-root` (fixed inset, z-index 55, flex align-items: flex-end) → `.sheet-backdrop` → `.sheet-panel` (max-height 90vh, overflow-y auto, padded with safe-area). The `@media (min-width: 700px)` block switches `align-items: center`, caps width at `min(480px, calc(100vw - 32px))`, and hides the handle.

### 6.2 Full-screen page

Review, Phonetics, and Sentence Studio all use the same pattern: `position: fixed; inset: 0; z-index: 60; background: var(--bg)` with safe-area padding. A header bar (`.review-header`) provides: back button (left, `--accent` colored), a pill tag (`.review-kind-tag`), and progress text (right, tabular-nums). The body is a flex-grow scrollable area.

### 6.3 Fixed bottom CTA bar

Sentence Studio uses a fixed-bottom bar with a gradient fade: `background: linear-gradient(180deg, transparent 0%, var(--bg) 45%)` so content scrolls under it. Buttons float inside with `pointer-events: none` on the wrapper, `pointer-events: auto` on the buttons. Primary CTA is vermillion (`--accent`) with pill radius (28 px) and drop shadow (`0 4px 12px`).

### 6.4 Modal / hash routing stack

The app uses two coexisting routing patterns: a **modal stack** (`useModalStack`) that pushes `#/w/<word>` or `#/c/<char>` hash entries and integrates with `history.pushState` for OS back-button support, and **top-level page flags** (`#/review`, `#/phonetics`, `#/sentence`) toggled by a plain `hashchange` listener. Entries carry `{ kind: "word"|"char", key, view: "sheet"|"tree" }`.

---

## 7. Component Inventory

> **Living version:** `npm run storybook` renders the shared primitives
> with autodocs prop tables (deployed at `/chineseapp/storybook/`).
> This inventory stays as the narrative map; Storybook is the
> always-current reference.

### 7.1 Entity *(replaces Card, v92)*

**What:** The unified character/word tile (redesign §0) — one component, five sizes, consistent pinyin → hanzi → meaning DNA. Resolves its own data from context given an `itemKey`. **Where:** SavedShelf (md), ComponentTable + SentenceStudio chips (tiny/sm), ClusterRecall + DisambiguationCard cells (sm), review focal glyph (hero). **Props:** `itemKey`/`word`, `size` (`tiny|sm|md|lg|hero`), `showPinyin`, `showMeaning`, `showStatus`, `showPos` (off by default), `roleColor`, `trailing`, `hanziSlot`, `onTap`. **Classes:** `.entity`, `.entity-{tiny,sm,md,lg,hero}`, `.entity-pinyin`, `.entity-hanzi`, `.entity-meaning`, `.entity-pos`, `.entity-status`; drill flash modifiers `.is-correct` / `.is-wrong` / `.is-reveal`. **Tokens:** `--entity-hanzi-size` (per-size hanzi scale, multiplied by `--hanzi-scale`), `--entity-stack-gap`, `--entity-role` (role-tint override).

### 7.2 NodeCard

**What:** Tree-node card inside the SVG decomposition tree. **Where:** `DecompositionTree` (inside `<foreignObject>`). **Props:** `node`, `charData`, `strokeData`, `cardW`, `usageCount`. **Classes:** `.node-card`, `.card-top-row`, `.card-role-badge`, `.card-usage`, `.card-pinyin`, `.card-glyph`, `.card-glyph-fallback`, `.card-glyph-svg`, `.card-gloss`, `.card-etym`, `.card-word`. **Variants:** role-tinted border (`.role-iconic`, `.role-meaning`, etc.), word-root (`.is-word`). Internal sub-components: `WordGlyph`, `CharGlyph`.

### 7.3 StatusButton

**What:** 4-tier status dropdown. **Where:** TreeModal header, EntitySheet, Card corner, ResultsList, PhoneticsPage. **Props:** `status`, `variant` (`"icon"` | `"iconLg"`), `onChange`, `defaultIfEmpty`. **Classes:** `.status-wrapper`, `.status-btn`, `.status-menu`, `.status-menu-item`, `.status-menu-icon`. **States:** open/closed menu, current tier highlight (`.is-current`). Sub-component: `StatusIcon` (renders the appropriate icon for each tier).

### 7.4 EntitySheet

**What:** Unified word/char/component detail surface. **Where:** Main detail view, opened from search results, saved grid, etymology rows. **Classes:** `.sheet-root` through `.sheet-network-link` (~40 classes). **Sections:** eyebrow label, glyph display (stroke animation or static text), definitions, etymology row, "in your saved words" list, mnemonic editor, network link. **Notable:** contains `roleColor()` function that **hardcodes** role hues (`#b14430`, `#4f7d3a`, `#2f5a8e`) — these duplicate `--role-*` tokens.

### 7.5 TreeModal

**What:** Full-screen recursive decomposition tree view (d3). **Where:** Opened via "Explore tree" from EntitySheet. **Props:** `entry`, `word`, `chars`, `stackLen`, `saved`, `getStatus`, `setStatus`, `onPop`, `onNodeClick`. **Classes:** `.modal-root`, `.modal-header`, `.back-btn`, `.modal-title`, `.header-actions`, `.modal-body`.

### 7.6 DecompositionTree

**What:** d3-hierarchy + d3-zoom SVG tree with foreignObject `NodeCard` nodes. **Where:** Inside `TreeModal`. **Constants:** `CARD_W = 220`, `CARD_BASE_H = 220`, `CARD_MIN_H = 240`, `Y_GAP = 28`, `X_GAP = 10`. **Classes:** `.tree-svg`, `.link` (role-tinted), `.node`, `.node-card-fo`.

### 7.7 HamburgerMenu

**What:** Top-bar left-slot drawer. **Where:** Topbar. **Props:** `version`, `reviewHref`, `reviewBadge`, `phoneticsHref`, `sentenceHref`. **Classes:** `.hamburger-wrapper`, `.hamburger-btn`, `.hamburger-menu`, `.hamburger-item`, `.hamburger-badge`, `.hamburger-soon`, `.hamburger-divider`, `.hamburger-version`. **States:** open (`.is-open`), disabled items (`.is-disabled`).

### 7.8 SearchBar

**What:** Sticky search with mode tabs. **Where:** Home view. **Props:** `value`, `onChange`, `onEnter`, `mode` (`"all"` | `"byComponent"`), `onModeChange`. **Classes:** `.search-bar`, `.search-mode-tabs`, `.search-mode-tab`, `.search-field`, `.search-clear`. **States:** active tab (`.is-active`), focus (border → accent).

### 7.9 ResultsList

**What:** Search result rows. **Where:** Below SearchBar. **Classes:** `.results`, `.result-row`, `.r-hanzi`, `.r-mid`, `.r-pinyin`, `.r-gloss`, `.r-status`, `.r-saved`. Has `StatusButton` in each row.

### 7.10 SavedShelf

**What:** Home grid with status sections + sort pills. **Where:** Home view. **Classes:** `.saved-section`, `.shelf-header`, `.shelf-title`, `.shelf-count`, `.sort-bar`, `.sort-pill`, `.saved-empty`, `.saved-grid`. **Sort modes:** recent, pinyin, strokes, hsk, common.

### 7.11 ComponentTable

**What:** Grid of component chars when by-component search is active with empty query. **Where:** Home view (by-component mode). **Classes:** `.component-table`, `.component-chip`, `.component-chip-char`, `.component-chip-pinyin`, `.component-chip-count`.

### 7.12 ReviewPage + DrillFrame

**What:** Full-screen SRS review surface, routing by facet to sub-components. **Where:** `#/review`. **Internal helper:** `DrillFrame` — wraps each drill with header (back + tag + progress), body slot, and skip button. **Classes:** `.review-root`, `.review-header`, `.review-body`, `.review-actions`, `.review-card`, `.review-hanzi`, `.review-tap-hint`, `.review-pinyin`, `.review-gloss`, `.review-empty`, `.review-attrib`, `.drill-skip`, `.drill-skip-header`.

### 7.13 CombinedRecognitionCard

**What:** Dual-facet recognition card (meaning + sound). **Where:** ReviewPage (facet = meaningRecognition/soundRecognition). **Classes:** `.combined-card-surface`, `.combined-card-stack`, `.combined-grade-block`, `.combined-grade-label`, `.combined-grade-row`, `.drill-tap-hint`.

### 7.14 PhoneticTapCard *(removed in v95)*

Retired drill (facet = phoneticTap; dropped from the launch screen in v85, component deleted in v95). The `.phonetic-tap-*` classes remain in use by the surviving drill cards.

### 7.15 ComponentSoundCard *(removed in v95)*

Retired drill (facet = componentSound); same story as 7.14.

### 7.16 FamilyTransferCard *(removed in v107)*

Retired drill (facet = familyTransfer) — owner saw no value. Component deleted; legacy rows scrubbed like 7.14/7.15.

### 7.17 ProductionCard

**What:** HanziWriter trace quiz. **Where:** ReviewPage (facet = production). **Classes:** `.production-prompt`, `.production-prompt-pinyin`, `.production-prompt-gloss`, `.production-writer`, `.production-status`.

### 7.18 DisambiguationCard

**What:** Side-by-side comparison of confusable cluster members. **Where:** ReviewPage (leech interleave). **Classes:** `.disambig-root`, `.disambig-banner`, `.disambig-grid`, `.disambig-cell`, `.disambig-actions`.

### 7.19 ClusterRecallCard

**What:** 3–4 related saved words, tap to reveal, then one grade for the group. **Where:** ReviewPage (facet = clusterRecall, v107 — was a standalone page pre-v107). **Classes:** `.cluster-grid` plus the shared `.phonetic-tap-*` drill chrome.

### 7.20 PhoneticsPage

**What:** Full-screen list of productive sound components. **Where:** `#/phonetics`. **Classes:** `.phonetics-root`, `.phonetics-list`, `.phonetics-row`, `.phonetics-row-char`, `.phonetics-row-pinyin`, `.phonetics-row-count`, `.phonetics-row-family`.

### 7.21 SentenceStudio

**What:** Build-a-sentence composer with POS-colored word bank. **Where:** `#/sentence`. **Classes:** `.sentence-root`, `.composer`, `.composer-tokens`, `.composer-token`, `.pos-tabs`, `.pos-tab`, `.word-bank`, `.bank-chip`, `.sentence-cta-wrap`, `.sentence-cta`, `.saved-sentences`.

### 7.22 ReviewLaunch

**What:** Drill-type toggles + settings before starting review. **Where:** Intermediate screen between `#/review` and the actual session. **Classes:** `.launch-body`, `.launch-section`, `.launch-options`, `.launch-option`.

### 7.23 AuthButton + SignInModal

**What:** Email one-time-code auth flow (v95; was magic-link). **AuthButton classes:** `.auth-button`, `.auth-loading`, `.auth-menu`, `.auth-dropdown`. **SignInModal classes:** `.popup-root`, `.popup-panel`, `.signin-panel`, `.signin-form`, `.signin-sent`.

### 7.24 Shared UI primitives (`src/components/ui/`) *(v91)*

**What:** The extracted stage-A/B primitives: `PageHeader` (back + tag + progress), `EmptyState` (title + hint variants), `Eyebrow` (mono uppercase micro-label), `SectionHeader` (numbered sheet section head), `SpeakButton` (wraps `lib/speech.ts`), `DrillShell` (drill chrome: header incl. Skip + body slot), `GradeButtons` (Again/Good/Easy trio with `--grade-color` outline), `HanziGlyph` (HanziWriter animate/quiz mount + fallback). Each emits the pre-existing classNames, so their CSS is documented under the consuming surfaces above.

### 7.25 v98 drill cards *(WordInferenceCard, ReverseRecognitionCard, ClozeCharCard, FamilySweepCard)*

**What:** The four recognition drills from [recognition-drills.md](../product/recognition-drills.md). All reuse the `.phonetic-tap*` surface (tap-anywhere post-answer) and `<Entity>` picks with `.is-correct/.is-wrong/.is-reveal/.is-selected` flashes. **New classes:** `.inference-grade-row`, `.reverse-gloss`, `.reverse-row`, `.reverse-pick`, `.cloze-word`, `.cloze-blank`, `.cloze-solved`, `.sweep-grid`, `.sweep-confirm`, `.entity.is-selected`. Pure material generation in `src/lib/drillGen.ts`.

---

## 8. Componentization Proposals

Ordered by leverage (most-duplicated / most-impactful first).

### 8.1 `<Sheet>` — Unified bottom-sheet / modal shell

**Absorbs:** `.sheet-root`, `.sheet-backdrop`, `.sheet-panel`, `.sheet-grip-zone`, `.sheet-handle`, `.sheet-dismiss`, plus the `@media (min-width: 700px)` desktop switch. Also `.popup-root`, `.popup-backdrop`, `.popup-panel` from `SignInModal`.
**Currently duplicated in:** `EntitySheet` (inline), `SignInModal` (older `.popup-root` shell).
**Props:** `open`, `onClose`, `width?` (default `min(480px, …)`), `children`.
**Effort:** **M** — straightforward extraction but needs care around drag-to-dismiss gesture handling and the sticky grip zone.

### 8.2 `<Popover>` / `<Menu>` — Outside-click + Escape + anchored panel

**Absorbs:** The open/close/outside-click/Escape pattern + anchored-panel positioning from both `StatusButton` (`.status-menu`) and `HamburgerMenu` (`.hamburger-menu`), and `AuthButton` (`.auth-dropdown`).
**Currently duplicated in:** `StatusButton`, `HamburgerMenu`, `AuthButton` — all three implement `useEffect` with `mousedown` + `keydown` listeners.
**Props:** `trigger: ReactNode`, `open`, `onOpenChange`, `align?: "start" | "end"`, `children`.
**Effort:** **S** — mostly a hook + wrapper div.

### 8.3 `<DrillShell tag progress onClose onSkip>` — Generalized drill frame ✅ *(shipped v91)*

**Absorbs:** The in-file `DrillFrame` helper in `ReviewPage.tsx` (`.review-root`, `.review-header`, `.review-body`, `.drill-skip-row`). Currently every drill (CombinedRecognition, PhoneticTap, ComponentSound, FamilyTransfer, Production, Disambiguation) shares this chrome but it's an unexported inner component.
**Props:** `tag: string`, `progress: { current: number; total: number }`, `onClose`, `onSkip?`, `children`.
**Design note:** ~~The skip button should only appear pre-answer.~~ v105: Skip moved into the header (`PageHeader onSkip`, `.drill-skip-header`) — always available, out of the thumb zone so it can't be tapped by mistake. The "tap to continue" hint (`.drill-tap-hint`) should be **transient** — fade out after ~1.5 s or show only on first occurrence, per the owner's preference against permanent instructional text.
**Effort:** **S** — just export and parameterize `DrillFrame`.

### 8.4 `<PageHeader back tag progress actions?>` — Shared top bar ✅ *(shipped v91)*

**Absorbs:** The header pattern from ReviewPage/DrillFrame (`.review-header`), TreeModal (`.modal-header`), PhoneticsPage, SentenceStudio — all use the same back-button + tag + progress layout with minor variations (some have action buttons on the right).
**Props:** `onBack`, `tag?: string`, `progress?: string`, `actions?: ReactNode`.
**Effort:** **S**

### 8.5 `<PillTabs>` — Horizontal pill strip

**Absorbs:** `.pos-tabs` / `.pos-tab` (Sentence Studio), `.sort-bar` / `.sort-pill` (SavedShelf), `.search-mode-tabs` / `.search-mode-tab` (SearchBar). All three are the same pattern: a horizontal row of pill-shaped toggles with `.is-active` state.
**Props:** `options: { key: string; label: string; count?: number }[]`, `active: string`, `onChange: (key: string) => void`.
**Effort:** **S**

### 8.6 `<SectionHeader name>` — Section header ✅ *(shipped v91)*

**Absorbs:** `.sheet-section-head`, `.sheet-section-name` — the `ETYMOLOGY` / `IN YOUR SAVED WORDS` pattern in EntitySheet.
**Props:** `name: string`.
**Effort:** **S** — trivial extraction.

### 8.7 `<Eyebrow>` — Mono uppercase micro-label ✅ *(shipped v91)*

**Absorbs:** `.sheet-eyebrow`, `.component-table-title`, `.review-kind-tag`, `.launch-section-title`, `.disambig-banner`, `.combined-grade-label`, `.phonetic-tap-prompt`, `.cluster-prompt`, `.composer-label`, `.saved-sentences-head`. All share: mono or body font, uppercase, letter-spaced, `--muted` color.
**Props:** `children`, `variant?: "mono" | "body"`.
**Effort:** **S**

### 8.8 `<EntityRow>` — Hanzi + pinyin + gloss row

**Absorbs:** `.sheet-saved-row` + `.sheet-saved-hanzi` + `.sheet-saved-pinyin` + `.sheet-saved-gloss` (EntitySheet "in your saved words"), the saved-sentence row (`.saved-sentence-load` + `-hanzi` + `-pinyin`), and `ResultsList` rows (`.result-row` + `.r-hanzi` + `.r-mid` + `.r-pinyin` + `.r-gloss`).
**Props:** `hanzi: string`, `pinyin?: string`, `gloss?: string`, `onClick?`, `trailing?: ReactNode`.
**Effort:** **M** — the three current incarnations have slightly different grid layouts.

### 8.9 `<EmptyState title hint>` — Empty state message ✅ *(shipped v91)*

**Absorbs:** `.review-empty` + `.review-empty-title` + `.review-empty-hint` (Review, Sentence, Search), `.saved-empty` + `.saved-empty-hint` (SavedShelf), `.empty-state` (ComponentTable, PhoneticsPage, ResultsList).
**Props:** `title?: string`, `hint?: string`.
**Effort:** **S**

### 8.10 `<SpeakButton text>` — TTS button ✅ *(shipped v91)*

**Absorbs:** `.sheet-speak` (EntitySheet), `.composer-speak` (SentenceStudio), the 🔊 button in drill cards. All wrap `src/lib/speech.ts`.
**Props:** `text: string`, `size?: "sm" | "md"`.
**Effort:** **S**

### 8.11 `<HanziGlyph char animate?>` — Stroke-animated glyph

**Absorbs:** The HanziWriter mount + outline + on-error fallback div from EntitySheet and ProductionCard. Both read `var(--text)` / `var(--border)` via `getComputedStyle` and fall back to `#222` / `#ddd`.
**Props:** `char: string`, `animate?: boolean`, `size?: number`, `onComplete?`.
**Effort:** **M** — HanziWriter lifecycle management is fiddly.

### 8.12 `<MnemonicEditor itemKey>` — "Make it stick" block

**Absorbs:** `.mnemonic-display`, `.mnemonic-textarea`, `.mnemonic-saved-tag`, `.mnemonic-reset` in EntitySheet. Cohesive block with display/edit toggle and "your version" tag.
**Props:** `itemKey: string`, `getMnemonic`, `saveMnemonic`, `clearMnemonic`.
**Effort:** **S**

### 8.13 `<GradeButtons onGrade>` — Again / Good / Easy trio

**Absorbs:** `.review-btn-again`, `.review-btn-good`, `.review-btn-easy` button row used by CombinedRecognitionCard and ClusterRecallCard (`.combined-grade-row`).
**Props:** `onGrade: (rating: RatingName) => void`, `disabled?: boolean`.
**Effort:** **S**

### 8.14 `<RoleGlyph char role>` — Role-tinted hanzi

**Absorbs:** The inline `style={{ color: \`var(--role-${role})\` }}` pattern in NodeCard + the `roleColor()` function in EntitySheet. Centralizes role→color mapping into one component.
**Props:** `char: string`, `role: Role`, `size?: number`.
**Effort:** **S**

---

## 9. Known Inconsistencies & Cleanup Recommendations

### 9.1 `--surface` undefined — ✅ RESOLVED

`--surface` is now defined in both `:root` blocks (`#fefdfb` light, `#1d1a13` dark) as a distinct elevated tier. The `var(--surface, var(--bg))` fallbacks are now redundant but harmless.

### 9.2 Role / POS hues duplicated — ✅ MOSTLY RESOLVED

`roleColor()` in `EntitySheet.tsx` now returns `var(--role-*)` references (no hardcoded hex). POS colors are single-sourced: `--pos-*` live in `:root` and `pos.ts` `POS_COLOR` references them. Remaining debt: the `*-etym` duplicate-hue block documented in `design-tokens.css` is dead and should be deleted.

### 9.3 Breakpoint inconsistency

`min-width: 700px` is used for the desktop EntitySheet; `max-width: 699px` does not appear anywhere (it's in the brief but not in CSS). `max-width: 480px` and `max-width: 380px` are used. **Recommendation:** Standardize on `≤ 380` (compact), `≤ 480` (narrow), `≥ 700` (desktop). Consider adding `max-width: 699px` as the explicit mobile guard.

### 9.4 HanziWriter hardcoded fallback colors

`EntitySheet.tsx` and `ProductionCard.tsx` both read `var(--text)` and `var(--border)` via `getComputedStyle` but also hardcode `#222` / `#ddd` as defaults. **Recommendation:** The `getComputedStyle` approach is correct; the `#222` / `#ddd` fallbacks can be removed since the CSS custom properties are always defined.

### 9.5 Dark-mode palette hand-maintained

Every dark-mode override is a hand-written `@media (prefers-color-scheme: dark)` block scattered through styles.css plus inline dark overrides for status/grade/feedback colors. **Recommendation:** Consolidate all dark overrides into a single block at the end of styles.css (or in `design-tokens.css`) for maintainability.

### 9.6 Event propagation inconsistency

Some drill buttons stop event propagation (`e.stopPropagation()`) unconditionally; others do so conditionally based on grading state. [ADR-0007](../decisions/0007-tap-anywhere-to-advance.md) established the pattern: stop propagation only when `!allGraded`. **Recommendation:** Audit all `stopPropagation` calls across drill components for consistency.

### 9.7 Font stack declared twice on search input

`.search-bar input` declares `font-size: 16px` twice (lines overlap). Minor cleanup.

### 9.8 Transient hint text

The "Tap anywhere to continue" hint (`.drill-tap-hint`) currently pulses infinitely. Per the owner's preference: **design hints as transient** — fade out after ~1.5–2 s or show only on first-occurrence. Not yet implemented; a CSS-only fix would be changing the animation to `forwards` with a delay that ends at `opacity: 0`.

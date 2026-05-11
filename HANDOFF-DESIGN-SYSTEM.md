# Design-system extraction — hand-off prompt

This file is a self-contained prompt for another AI to read this codebase
and produce a **design-system document importable into Claude Design**
(claude.ai/design), plus a tokens file and a living style-guide page.

**Best run in Claude Code with this repo checked out** (it needs to read
`src/styles.css` and the component files). If you run it in a plain Claude
chat instead, it will ask you to paste the files it needs.

Paste **everything below the line** into the tool.

---

You are a design-systems engineer. Read an existing web app's code and produce a **design system document** that someone can import into Claude Design (claude.ai/design) to design new screens consistently with the app — plus a machine-usable tokens file and a small living style-guide page.

## The app

A mobile-first **Chinese-character learning** web app — React + TypeScript + Vite, deployed to GitHub Pages. Repo: `decobots/Ai-`. Live at `https://decobots.github.io/Ai-/`. Visual character: a warm "paper / ink" palette — an off-white background, near-black ink, a single muted-red ("vermillion") accent; full dark-mode support; lots of **role-colored decomposition UI** (a character breaks into components, each tinted by its semantic role — iconic ≈ blue, meaning ≈ green, sound ≈ red). There are two satellite static pages (`/network/`, `/components/` — Cytoscape graphs) and an unrelated watercolor app at `/palette/` — **ignore `/palette/` entirely** for this exercise.

## What to read (in this repo)

- `src/styles.css` — **the source of truth for every token and class.** The `:root` block has the color CSS custom properties; there's a `@media (prefers-color-scheme: dark)` override block; `--role-*` variables; and ~all component CSS. Read it in full.
- `src/lib/pos.ts` — `POS_COLOR` / `POS_LABEL` (the part-of-speech color set used in the Sentence Studio; injected inline as `--pos-c`).
- `src/lib/tree.ts` and `src/lib/types.ts` — `ROLE_LABEL`, the `Role` type, and how role colors map (also hard-coded in `src/components/EntitySheet.tsx` `roleColor()` — note the duplication).
- `src/components/*.tsx` — the component inventory. Notable ones: `Card`, `NodeCard`, `StatusButton`, `EntitySheet`, `TreeModal`, `DecompositionTree`, `HamburgerMenu`, `SearchBar`, `ResultsList`, `SavedShelf`, `ComponentTable`, `ReviewPage` (+ `CombinedRecognitionCard`, `PhoneticTapCard`, `ComponentSoundCard`, `FamilyTransferCard`, `ProductionCard`, `DisambiguationCard`, `ReviewLaunch`, `ClusterRecall`, and the in-file `DrillFrame` helper), `PhoneticsPage`, `SentenceStudio`, `AuthButton`, `SignInModal`. For each, note which CSS classes it uses and its props/variants/states.
- `CLAUDE.md` and `DESIGN.md` — design rationale, the status model, the SRS facet system, the "iOS Safari foreignObject" caveat, etc. Useful context, not tokens.
- (Optional) the live site, to screenshot real component states for the style-guide page.

*(If you don't have repo access, ask the user to paste `src/styles.css`, `src/lib/pos.ts`, `src/lib/tree.ts`, `src/lib/types.ts`, and the list of files under `src/components/` with each file's contents — or at least `styles.css` + the component file names.)*

## Deliverables (write these files)

1. **`DESIGN-SYSTEM.md`** — the main document. Markdown, organized so it's easy to paste/import into Claude Design. Sections:
   - **Brand & voice** — 2–3 sentences on the visual character (paper/ink/vermillion, restrained, functional color = role color, mobile-first, dark-mode-first-class).
   - **Color** — for *every* token: the CSS variable name, the light value (hex), the dark value (hex), and where/why it's used. Cover at minimum: `--bg`, `--surface-2` (and `--surface` — see note below), `--text`, `--muted`, `--accent`, `--border`, the `--role-*` set, plus the POS color set from `pos.ts`, the status treatment (★ Saved / ❗ Need to learn / 🎓 Learned / ✒ Wrote — emoji + any color), the error-banner color, and any one-off colors in component CSS. Present it as a table *and* as a fenced ` ```css ` `:root { … }` block (light) plus a `@media (prefers-color-scheme: dark)` block — copy the real values, don't invent.
   - **Typography** — font families (the **hanzi stack** `"PingFang SC","Hiragino Sans GB","Source Han Sans SC",system-ui,sans-serif`; the **UI/body** stack; the **mono** stack `ui-monospace,SFMono-Regular,Menlo,monospace` used for eyebrow labels / section numbers / POS tags). Then a **type scale**: every distinct font-size in use, grouped by role (display hanzi ~84–120px in the review card / entity sheet; large hanzi 26–30px in bank chips / etymology rows / saved rows; body 14–16px; meta/labels 11–13px; mono micro-labels 8–11px) — for each, the px size, line-height, weight, letter-spacing, and where it's used. Note that hanzi and Latin text often want different sizes/line-heights.
   - **Spacing & layout** — the spacing values actually used (gaps/paddings — 2/4/6/8/10/12/14/16/18/20/22/24px); the **border-radius scale** (small chips ~8–10px, cards ~12–14px, sheets/modals ~18–22px, pills/circles 999px); **shadows** (the bottom-sheet shadow `0 -10px 40px rgba(0,0,0,.22)`, the desktop modal shadow, the floating-CTA shadow `0 4px 12px rgba(0,0,0,.18)`, etc. — extract the real ones); **breakpoints** (`max-width: 480px`, `max-width: 380px`, `min-width: 700px`, `max-width: 699px` — note these are *inconsistent* and recommend a canonical set); **safe-area** usage (`env(safe-area-inset-*)`); and the **z-index layers** in use (topbar 5, modal-root 10, popups/sheets ~50–55, review/sentence pages ~60, hamburger menu ~80 — list them).
   - **Motion** — the transitions/animations used (`sheet-rise` / `sheet-pop` keyframes and durations, the `0.12s ease` hover transitions, etc.) and the principles (note the "no auto-advance timers in drills" and "tap-anywhere-to-advance" conventions from DESIGN.md).
   - **Layout patterns** — describe the recurring surface archetypes: (a) **bottom sheet on mobile / centered modal on desktop** (the `EntitySheet` shell: backdrop + rounded-top panel + drag handle + ↓ dismiss + sticky grip zone + `@media (min-width: 700px)` switch to centered); (b) **full-screen page** with a `.review-header`-style top bar (back button · tag · progress) — Review / Phonetics / Sentence; (c) **fixed bottom CTA bar** with a fade gradient (Sentence Studio's Copy/Save); (d) the **modal/hash routing stack** (entries `{ kind: "word"|"char", key, view: "sheet"|"tree" }`; top-level pages on `#/foo` hashes).
   - **Component inventory** — a table or section per reused component: name, what it is, where it's used, its variants/props/states (e.g. StatusButton: `variant: "icon" | "iconLg"`, status ∈ four tiers | null, open/closed menu), the CSS classes it owns, and (if you screenshotted the site) an image of each meaningful state. Include the drill cards and the in-file helpers.
   - **Componentization proposals** — see the next section.
   - **Known inconsistencies / cleanup recommendations** — at minimum: `--surface` is referenced as `var(--surface, var(--bg))` in several rules but isn't defined in `:root` (define it, or stop using it); the role/POS hues are hard-coded in three places (`styles.css` `--role-*`, `pos.ts` `POS_COLOR`, `EntitySheet.tsx` `roleColor()`) and should be one token set; the breakpoints disagree; the dark-mode palette is hand-maintained; some buttons stop event propagation inconsistently. Frame these as recommendations — **do not change any code.**

2. **`design-tokens.css`** — a clean, standalone file: a `:root { … }` block with every color/spacing/radius/shadow/font token as a CSS custom property, plus the `@media (prefers-color-scheme: dark)` overrides, plus the `--role-*` and `--pos-*` sets. This is the "import this" artifact for tooling that takes CSS. Add brief comments grouping the tokens. Use the *real* values from the codebase; where the codebase doesn't yet have a token (e.g. it inlines `--pos-c` per element, or hard-codes a radius), promote it to a named token here and note that in `DESIGN-SYSTEM.md`.

3. **`style-guide.html`** — a single self-contained HTML page (inline `<style>`, optionally pulling `design-tokens.css`) that *renders* the system: color swatches (light + a dark-mode toggle or a side-by-side), the type scale (with sample hanzi and Latin text at each size), the radius/shadow scale, and live examples of the key components/states (a card, a status button + open menu, a section header, an eyebrow label, a chip row, a grade-button trio, the bottom-sheet shell, an empty state, a pill/tab strip, a role-tinted glyph). This is the visual reference. Keep it dependency-free so it opens in any browser.

## Componentization proposals — what to look for

Audit the JSX for **repeated markup that isn't yet a component** and recommend extracting it. Strong candidates (verify each against the code; add/remove as you find more):

- **`<Popover>` / `<Menu>`** — the outside-click + Escape + anchored-panel pattern is duplicated in `StatusButton` (`.status-menu`) and `HamburgerMenu` (`.hamburger-menu`). One primitive.
- **`<Sheet>`** — the mobile-bottom-sheet / desktop-modal shell (backdrop, rounded panel, drag-to-dismiss handle, ↓ button, the `@media (min-width:700px)` switch) currently lives inline inside `EntitySheet`. `SignInModal` uses an older `.popup-root` shell. Unify into one `<Sheet>`.
- **`<SectionHeader num name>`** — the `Nº 01 · ETYMOLOGY` / `Nº 02 · …` header (`.sheet-section-head` + `-num` + `-name`).
- **`<Eyebrow>`** — the mono, uppercase, letter-spaced micro-label (`.sheet-eyebrow`, `.component-table-title`, the review `kind-tag`, etc.).
- **`<EntityRow>`** — the hanzi + pinyin + gloss row used for "in your saved words" / "characters" lists (`.sheet-saved-row`, the old `.chip-row`, the saved-sentence row).
- **`<EmptyState title hint>`** — `.review-empty` + `-title` + `-hint`, reused across Review, Sentence, search.
- **`<PillTabs>`** — the horizontal pill strip: `.pos-tabs`/`.pos-tab` in the Sentence Studio, the sort pills in `SavedShelf`, the Dictionary/By-component toggle in `SearchBar`.
- **`<SpeakButton text>`** — the 🔊 button appears in `EntitySheet` (`.sheet-speak`), the Sentence composer (`.composer-speak`), and review cards. Wraps `src/lib/speech.ts`.
- **`<HanziGlyph char animate?>`** — the hanzi-writer mount + outline + on-error fallback div, currently re-implemented in `EntitySheet` (and previously in the deleted `CharPopup`) and used by `ProductionCard`. Wraps `useStrokeData` / `HanziWriter`.
- **`<MnemonicEditor itemKey>`** — the "💡 Make it stick" block (`.mnemonic-display`/`.mnemonic-textarea` + "your version" tag + reset link). Cohesive but its markup is duplicated; make it a component over `useMnemonics`.
- **`<GradeButtons onGrade>`** — the Again / Good / Easy trio (`.review-btn-again/good/easy`) used by the recognition card and elsewhere.
- **`<DrillShell tag progress onClose onSkip>`** — generalize the in-file `DrillFrame` so every drill (recognition, phoneticTap, componentSound, familyTransfer, production, disambiguation) shares one chrome — header + body slot + a *transient* "tap to continue" hint (see the UX note below) + a small bottom Skip button.
- **`<PageHeader back tag progress actions?>`** — the top bar shared (with variations) by `ReviewPage`/`TreeModal`/`PhoneticsPage`/`SentenceStudio` (`.review-header`, `.modal-header`).
- **`<RoleGlyph char role>`** — a hanzi tinted by its decomposition role; centralizes the role→color mapping.

For each proposal: name, the markup/classes it would absorb, where it's currently duplicated, the props it'd take, and an effort estimate (S/M/L). Order them by leverage (most-duplicated / most-impactful first).

## A note for the design (not the code)

When you describe components and propose new ones, carry forward two preferences of the app's owner: **prefer larger hanzi and comfortably-sized UI text** (flag anywhere the type scale feels cramped on mobile), and **avoid instructional hint text that lives on screen permanently** (e.g. a persistent "Tap anywhere to continue") — design such hints as transient (fade after ~1.5–2 s, or first-occurrence-only). Note these in the typography section and in the `<DrillShell>` proposal. Don't touch the code — this is a documentation/design exercise.

## How to work

1. Read `src/styles.css` end to end; extract every token (color, font, size, radius, shadow, breakpoint, z-index, transition). Cross-check `pos.ts` / `tree.ts` / `types.ts` for the color/role constants. Skim `CLAUDE.md` / `DESIGN.md` for rationale and conventions.
2. Walk `src/components/*.tsx`; for each component note its CSS classes, props/variants/states; build the inventory.
3. (Optional but recommended) open the live site and screenshot real component states for `style-guide.html` and the inventory.
4. Write `DESIGN-SYSTEM.md`, `design-tokens.css`, and `style-guide.html`. Use the **real values** from the codebase verbatim — don't approximate or "improve" them in the extraction (improvements go in the "recommendations" section only).
5. At the end, tell the user: where the three files are, a one-paragraph summary of the system (palette, type, the role-color idea), the top componentization proposals, and the top inconsistencies you found.

# Project QA + UX/UI audit — hand-off prompt

This file is a self-contained prompt for another AI assistant to **manually
test the whole project and write an illustrated report**. Recommended tool:
**Claude Code** (desktop app if you want to watch it; terminal otherwise) —
it can drive a headless browser for repeatable screenshots and assemble a
PDF/`.docx` report with a script. (Plain Claude.ai chat can't navigate a
live app; Claude-in-the-cloud works but you can't watch it; a computer-use /
browser-agent surface is fine for an extra exploratory pass but flakier for
a long structured run.)

Paste **everything below the line** into the tool.

---

You are a QA engineer doing a thorough, exhaustive manual test pass of a web project, then writing an illustrated report. Take your time — this is a long task and that's expected. Be skeptical: actively try to break things, not just confirm the happy path.

You're doing two things: (1) a numbered, screenshot-backed **functional QA pass**, and (2) a numbered **UX/UI audit** with proposed improvements. Both go in one report.

## The project

Web apps deployed together on GitHub Pages. **Test the live deployed site:**

- Chinese learning app (the main one — this is ~all of the work): `https://decobots.github.io/Ai-/`
- Network graph (satellite): `https://decobots.github.io/Ai-/network/`
- Components graph (satellite): `https://decobots.github.io/Ai-/components/`
- **`https://decobots.github.io/Ai-/palette/` — a watercolor painting app. COMPLETELY OUT OF SCOPE. Do not open it, test it, audit it, or screenshot it. Don't mention it beyond noting it exists and was excluded.**

Confirm you're testing the current build: open the Chinese app's **hamburger menu** (top-left) — the version label at the bottom should read `chinese v84` (or higher). Also fetch `https://decobots.github.io/Ai-/build-info.txt` and note the build timestamp. If the version looks stale, say so in the report and test what's live anyway.

The Chinese app is **mobile-first** (designed for iPhone Safari). Test at **two viewports**: a mobile viewport (≈ **390×844**, iPhone-ish, with touch emulation) and a desktop viewport (≈ **1280×900**). Also test **dark mode** (the app respects `prefers-color-scheme: dark`) — at minimum capture the main screens in both light and dark.

## Tooling setup (Claude Code)

Set up a headless browser (Playwright is easiest: `npm i -D playwright && npx playwright install chromium`, or use Puppeteer). Create a `qa/` working directory with `qa/screenshots/`. Write small reusable helpers: navigate to a URL, set viewport + colorScheme + touch, wait for the app to settle, screenshot to `qa/screenshots/<test-id>.png`, and capture the browser **console** for errors/warnings on every page. After the run, assemble the report with a script (`reportlab` → PDF, or `python-docx` → `.docx`; if neither is available, produce a single self-contained `report.html` with base64-embedded images and convert to PDF if you can).

*(If you're running in a browser-agent / computer-use surface instead of Claude Code: skip the Playwright setup — drive the real browser yourself, take screenshots the same way, and still produce the report file at the end.)*

## Numbering & report format

- Number **every** functional test `T-001`, `T-002`, … sequentially. Number **every** UX/UI recommendation `UX-001`, `UX-002`, …. Once assigned, a number never changes.
- The report is **one document** (PDF preferred, `.docx` acceptable). Structure:
  1. **Cover**: project, URLs, build version + timestamp, date of the run, tool used, viewports tested, a one-line summary (X tests — Y passed / Z failed / W partial-blocked; N UX recommendations).
  2. **Executive summary**: (a) bugs ranked by severity (Critical / High / Medium / Low / Cosmetic), each referencing its `T-NNN`(s); (b) the top UX/UI recommendations, each referencing its `UX-NNN`.
  3. **Functional test sections** (one per app/screen — see the checklist). For each test: `**T-NNN — <short name>**`, then **Steps**, **Expected**, **Actual**, **Result** (PASS / FAIL / PARTIAL / BLOCKED), **Severity** (if not PASS), **Notes**. For any test of a *visual* screen or element, embed the relevant **screenshot(s)** directly under the test, captioned with the `T-NNN` and viewport/theme (e.g. "T-014 — Saved shelf, mobile, dark"). If a screenshot shows a defect, annotate it — draw a callout box/arrow on the image if convenient, otherwise describe the location precisely in Notes ("the POS tab strip, top ~40% clipped").
  4. **UX/UI audit & recommendations** (see the audit section). Each: `**UX-NNN — <short name>**`, **Where** (which screen/element), **Observation**, **Recommendation**, **Why it helps** (tie to the owner's stated preferences where relevant), **Effort** (S/M/L), **Priority** (High/Med/Low). For visual ones, embed a screenshot of the current state and, if you can, a sketch/markup of the proposed change.
  5. **Coverage matrix**: a table of areas × what was covered × what was skipped/blocked and why (palette is "excluded by owner").
  6. **Appendix**: full list of console errors/warnings seen, per page; environment details (browser version, viewport sizes, etc.).
- Capture a screenshot of **every distinct screen and major UI state** even when the test passes — the owner wants visual evidence throughout, not just for failures.

## What to test (checklist — expand each into numbered tests)

**A. Chinese app — first load & shell**
- Cold load (clear site data first): does it render without errors? No diagnostic/error overlay? Console clean?
- Top bar: title, hamburger (left), auth button (right). Hamburger opens/closes; Escape closes; outside-click closes. Links: Review (with an "N due" badge when applicable), Phonetics, Sentence, Network, Components, version label. Each link routes correctly.
- Responsive: layout at mobile vs desktop; safe-area padding looks right; nothing clipped or overlapping.
- Dark mode rendering of the shell.

**B. Search**
- Two modes: "Dictionary" and "My words by component" (a toggle). Dictionary: type Chinese (`好`, `你好`), pinyin (`hao`, `ni hao`, `laoshi`), and English (`good`, `teacher`) — results appear, debounced, ranked sensibly. Empty/whitespace query → no results, no errors. Enter key opens the first result.
- "By component" mode with an empty query → shows the ComponentTable (a grid of components from your saved set, ranked by occurrence). Type a Han char (`青`, `女`) → filters your saved words whose decomposition contains it (nested levels too). Multi-char query = AND.

**C. Saved shelf (home, when no search)**
- With words saved: a grid of cards. When sorted by **Recent**, the grid splits into sections by status (★ Saved / ❗ Need to learn / 🎓 Learned / ✒ Wrote). Switch sort to pinyin / strokes / HSK / frequency → sections collapse into one flat grid; ordering is correct.
- Empty state (after `?clear=1` — confirm the prompt, then it should be empty): friendly empty message.
- Tapping a word card opens the **EntitySheet**; tapping a single-char saved item also opens it.

**D. Status control (`StatusButton`)**
- Appears on cards, in the EntitySheet header, and in the TreeModal header. Tapping an *unset* button saves the word (no menu — just commits ★). Tapping a button that *has* a status opens a small dropdown to pick a different tier or "remove". The four tiers are mutually exclusive (picking one clears the others). "Remove" deletes the word entirely. Verify the dropdown closes on outside-click / Escape. Verify changes persist across a page reload.

**E. EntitySheet (the unified word/char/component popup)**
- Mobile: a **bottom sheet** — slides up, has a drag handle, swipe-down dismisses, the ↓ button dismisses, backdrop tap dismisses, Escape dismisses. Desktop: a **centered modal**. Open it for a multi-char word, a single character, and a component (tap a piece inside another sheet's etymology).
- Sections, in order: eyebrow (`PINYIN · TONE n · TOP n`), the hanzi (single chars: tap to replay the **stroke animation** — verify it animates; words: a 🔊 speaker button — verify it speaks), POS + glosses, `Nº 01 · ETYMOLOGY` / `MADE OF` (a one-level role-colored decomposition; each piece is tappable → opens its own sheet; a `⤢` button opens the full decomposition tree), `Nº 02 · IN YOUR SAVED WORDS` / `CHARACTERS` (tappable rows), `💡 MAKE IT STICK` (an editable mnemonic — tap to edit, tap away to save, a "reset" link appears once edited; verify the edit persists across reload), and a "Show in network →" link (verify it opens the network page focused on this entity).
- Drilling: open a word sheet → tap a character in `MADE OF` → its sheet opens *on top* → browser **back** returns to the previous sheet. Verify the back-button stack works for several levels.
- Deep links: visit `https://decobots.github.io/Ai-/#/c/好` and `https://decobots.github.io/Ai-/#/w/你好` directly — the corresponding sheet should open on load.

**F. Decomposition tree (`TreeModal`)**
- Reached via the `⤢` in an EntitySheet. A full recursive role-colored tree (pan + zoom on the SVG). Node cards show the char + role-tinted strokes + etymology notes. Tapping a node opens that node's EntitySheet (on top of the tree). The header has a back button and a StatusButton. Verify pan/zoom work; verify the role colors (iconic ≈ blue, meaning ≈ green, sound ≈ red); look for the known iOS-Safari `foreignObject` bug (cards rendering blank with only connector lines) — flag it if seen.

**G. Review page (`#/review`)**
- From the hamburger → Review. First a **launch screen**: due count, per-facet counts, toggles (enabled facets, random order, include sub-chars), a "start cluster recall" option (if ≥3 saved), a big start button. Then the **review surface**, one card at a time, header showing `n / total`.
- Drill types — exercise each you can reach:
  - **Combined recognition card** (default): hanzi shown; tap to reveal meaning + pinyin; then two rows (Meaning / Sound), each with **Again / Good / Easy**; after grading, **tap anywhere to advance** to the next card. A small **Skip** button at the bottom skips pre-grade. For a multi-char word, grading Meaning = Again shows a "what threw you?" affordance (pick a constituent char, or skip).
  - **Phonetic-tap** ("tap the sound part"): a char with its components; tap the one that carries the sound; auto-grades; tap-anywhere advances. Skip button present.
  - **Component-sound** ("what sound does this give?"): multiple-choice pinyin; auto-grades.
  - **Family-transfer** ("you know 青, what's 情?"): a guess prompt; auto-grades.
  - **Production** (✒ Wrote tier): a Hanzi Writer trace quiz.
  - **Disambiguation card** (leech clusters, e.g. 易/昜, 未/末): a side-by-side compare that appears before grading a leeched card; "continue" then surfaces the cluster members in the session.
- **Critical regression to verify (this was a real bug):** save a fresh word, mark it "Need to learn", open Review, grade it **Good** — it should leave the queue and **not** reappear after a page reload (the schedule should jump multi-day, not 10 minutes). Grade another **Again** — it may legitimately come back same-day/next-day.
- "All caught up" empty state when nothing is due.

**H. Phonetics page (`#/phonetics`)**
- A list of the top-~250 productive sound components, each with pinyin + family + a StatusButton. Marking one (e.g. "learned") persists. Scroll performance OK.

**I. Sentence Studio (`#/sentence`)**
- The composer: token chips for words you've added (POS-colored stripe), an inline text input after them, a "clear" button, a pinyin line, a 🔊 speaker.
- **Type pinyin into the composer input** (e.g. `nihao`, or `ni hao`, or a Han char) → the **word bank below filters** to your saved words that match. **Tap a match** → it's appended as a token and the input clears. **Enter** appends the first match. **Backspace** on an empty input pops the last token. The POS tabs hide while you're typing a query.
- **POS tabs** (All / Pronoun / Verb / Noun / Adjective / Adverb / Particle) with counts — when not searching, they filter the bank. Tapping a bank chip appends it.
- **Save sentence**: a "Save sentence" button next to "Copy to clipboard" — saves the current sentence; it appears in a "Saved sentences" list under the composer (newest first; tap a row to reload it into the composer; × deletes it; re-saving the same sentence de-dupes/bumps it). "Copy to clipboard" copies the hanzi (shows "✓ Copied").
- **The crushed-tabs regression to verify (was a real bug):** on a phone-sized viewport, with many saved words, the POS tab strip must render at **full height** — not clipped to a sliver. Also the fixed "Copy/Save" bar at the bottom should clear the last row of bank chips, not sit on top of them.
- Empty state when 0 words saved: "Save 5 words to start composing."

**J. Network graph (`/network/`)**
- A force-directed Cytoscape graph of saved words ↔ their constituent chars. Tap a node → highlights its neighborhood. **Long-press** a word node → shows its full translation. **Double-tap** a word → opens it in the main app (single tap/pan must NOT navigate). `?focus=<key>` (e.g. `https://decobots.github.io/Ai-/network/?focus=%E5%A5%BD`) centers + highlights that node on load. Note: this page reads `localStorage` directly, so it reflects whatever's saved in this browser.

**K. Components graph (`/components/`)**
- A Cytoscape graph: saved words → chars → the components those chars are built from. Strictly bounded by the saved set (no "suggested next" nodes, no corpus expansion). Tap to highlight; verify it renders and is interactive.

**L. Persistence & edge cases (Chinese app)**
- Reload the page mid-session — saved words, statuses, current sentence draft, saved sentences, mnemonics all survive (they're cached in `localStorage`).
- `?clear=1` — prompts, then wipes the saved set. `?import=<same-origin-json-url>` — prompts, then imports (you can skip this if you have no suitable URL; just note it exists).
- Browser back/forward through the modal stack and the `#/review` / `#/phonetics` / `#/sentence` hash pages — no broken states, no stuck overlays.
- Console: zero uncaught errors across all pages; note any warnings.

**M. Out of scope (note in the report, don't attempt)**
- **The watercolor app at `/palette/`** — explicitly excluded by the project owner. Do not open, test, audit, or screenshot it.
- **Magic-link sign-in** (`AuthButton` → email modal): test that the modal opens and shows "Check your email" after submitting a (fake) address — but you cannot complete sign-in without email access. Don't try.
- **Cross-device Supabase sync** (saved words / FSRS / mnemonics / sentences syncing across devices): requires a signed-in session on two clients — out of scope. Also: the sentence-sync tables (`user_sentences`, `user_sentence_draft`) may not exist yet if a recent Supabase migration hasn't been applied — if sentence features behave purely locally, that's expected; note it.

## The UX/UI audit (do this in addition to the functional tests A–M)

After the functional pass, go back through the Chinese app, the network graph, and the components graph as a *designer*, and write numbered `UX-NNN` recommendations. Be opinionated and concrete — propose specific changes, not vague "consider improving X". Use the screenshots you already took. Cover at least: visual hierarchy & spacing; typography & sizing; affordance clarity (does it look tappable?); consistency across the EntitySheet / TreeModal / Review / Phonetics / Sentence surfaces; empty states; loading states; mobile ergonomics (44px tap targets, thumb reach, safe areas); dark mode; motion/transitions; and information density.

**The owner's stated preferences — weight these heavily and call out anything that violates them:**
- **Bigger characters and fonts.** They want the hanzi to feel large and the UI text comfortably readable on a phone. Flag any place where Chinese characters or labels feel small/cramped (e.g. the bank chips' hanzi, the review-card hanzi, the etymology-row glyphs, search-result hanzi, saved-shelf cards) and propose concrete size bumps.
- **No permanent on-screen hint text.** They dislike instructional text that lives on screen forever. Specifically audit: the Review page's "Tap anywhere to continue" hint, the Sentence composer's placeholder/hint text, the "Save 5 words to start composing" empty hint, the "what threw you?" affordance copy, and any other always-present coaching text. Recommend making such hints **transient** (fade out after ~1.5–2 s, or show only on the first occurrence per session, or replace with a subtle icon). Persistent helper text that's genuinely structural (section labels like "ETYMOLOGY") is fine — it's the *instructional* "do this now" copy they want gone.

Also propose a small number of *higher-leverage* ideas if you see them (e.g. a stats view, a better status-section layout, a quicker path from a word to its tree) — but keep those clearly separated as "bigger ideas" so they don't crowd out the quick wins.

## How to work

1. Set up tooling; smoke-load the three in-scope URLs (`/`, `/network/`, `/components/`); confirm the `chinese vNN` version label.
2. **Functional pass:** go area by area (A → M). Write the numbered `T-NNN` tests, run them, screenshot every screen/state, record results. Keep a running bug list with severities.
3. Re-run the two flagged regressions carefully (the FSRS "Good doesn't stick" one in G; the crushed-tabs one in I) — they were recently fixed and the owner wants confirmation.
4. **UX/UI audit pass:** produce the numbered `UX-NNN` recommendations per the section above, screenshots + (where useful) markups.
5. Assemble the report (PDF preferred). Every `T-NNN` and `UX-NNN` referenceable; every visual screen has a screenshot; executive summary lists bugs by severity (with test IDs) and the top UX recommendations (with UX IDs).
6. At the end, tell the owner: total tests + pass/fail/partial counts, number of UX recommendations, the top issues and top recommendations, where the report file is, and anything you couldn't test and why.

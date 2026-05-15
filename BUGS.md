# Bugs

Open defects. One line per bug at the top; details below the table.
Move to "Fixed" when resolved (with the vNN it shipped in), then to
`CHANGELOG.md` under the release.

ID format: `BUG-NNN`. Numbers are **immutable** — once assigned, never
reused, even for fixed/withdrawn bugs.

Severity: **Critical** (data loss / app unusable) · **High** (core
feature broken) · **Medium** (annoying but workarounds exist) ·
**Low** (edge case) · **Cosmetic** (visual only)

---

## Open

| ID | Severity | Title | Source |
|---|---|---|---|
| BUG-1 | Medium | Deep links `#/c/<char>` and `#/w/<word>` don't open EntitySheet | v84 QA |
| BUG-3 | Low | Search "中国" ranks "发展中国家" above "中国" | v84 QA |
| BUG-4 | Cosmetic | Hamburger menu dismiss: Escape causes layout shift; outside-click occasionally misses on first tap | v84 QA |
| BUG-5 | Medium | Review: grading "Easy" flashes red border (should be blue/green) | v84 QA |

## Fixed

| ID | Severity | Title | Fixed in |
|---|---|---|---|
| BUG-2 | Medium | All user data persisted to localStorage instead of Supabase | (cloud-first hooks rework) — see [ADR-0001](docs/decisions/0001-supabase-source-of-truth.md). Cross-device deletion propagation remains [open work](docs/architecture/ARCHITECTURE.md#open-work--explicitly-deferred). |

## Withdrawn / not-a-bug

*(none yet)*

---

## Details

### BUG-1 · Medium · Deep links broken

Navigating to `#/c/好` or `#/w/你好` (both cold-load and in-page hash
change) does not open an EntitySheet. The hash changes in the URL bar
but the app ignores the `/c/` and `/w/` route patterns — it shows the
home screen. No console errors.

**Where:** `App.tsx` hash router. Cold-load parsing of `location.hash`
**and** the `hashchange` listener both need a handler for these
patterns.

**Reproduce:** Open `https://decobots.github.io/Ai-/#/c/好` in a fresh
tab.

---

### BUG-3 · Low · Search exact-match ranking

Searching "中国" and saving the first result saves "发展中国家"
(developing country) instead of "中国" (China). Substring matches are
preferred over exact ones in the current ranking.

**Where:** `search_words` RPC in
`supabase/migrations/0004_search_words_rich.sql`.

**Fix direction:** Add an `is_exact` tier above the existing prefix /
substring / pinyin / gloss tiers. Exact hanzi match → rank first.

---

### BUG-4 · Cosmetic · Hamburger dismiss quirks

Escape closes the menu but causes a slight layout shift. Outside-click
sometimes does not register on the first tap (mobile).

**Where:** `HamburgerMenu` close handler.

**Fix direction:** Verify the close handler toggles `transform` /
`visibility` rather than `display` (avoids reflow). Add `touchstart`
to the outside-click listener in addition to `click`.

---

### BUG-5 · Medium · "Easy" grade flashes red

When grading a card **Easy**, the card border flashes red — the same
color used for **Again**. Should flash blue (per design tokens
`--grade-easy: #1d4ed8`) or bright green.

**Where:** Likely in `CombinedRecognitionCard` or the shared review
card surface — wherever the border-color transition is bound to the
grade event.

**Fix direction:** Map the flash color to the grade button that was
pressed:
- Again → `var(--grade-again)` (red)
- Hard  → orange (no token yet)
- Good  → `var(--grade-good)` (green)
- Easy  → `var(--grade-easy)` (blue)

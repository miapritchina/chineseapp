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
| BUG-4 | Cosmetic | Hamburger menu dismiss: Escape causes layout shift; outside-click occasionally misses on first tap | v84 QA |

> **BUG-1 note:** the routing now appears wired — `App.tsx` parses
> `location.hash` on cold load (`parseHash` + `openFromHash`) and on
> `hashchange`. Kept Open pending a live browser confirmation (cold-load
> `#/c/好` and in-page hashchange both opening the sheet).

## Fixed

| ID | Severity | Title | Fixed in |
|---|---|---|---|
| BUG-2 | Medium | All user data persisted to localStorage instead of Supabase | (cloud-first hooks rework) — see [ADR-0001](docs/decisions/0001-supabase-source-of-truth.md). Cross-device deletion propagation remains [open work](docs/architecture/ARCHITECTURE.md#open-work--explicitly-deferred). |
| BUG-6 | High | Retired phoneticTap/componentSound cards clog the review queue and starve word reviews | v95 — seeding removed in `useReview`; legacy rows ignored on load/sync + scrubbed locally; daily-new cap now counts word cards only. |
| BUG-7 | Medium | Sound-facet grade of the combined card never syncs to Supabase | v95 — ref-mirrored cards map ([ADR-0010](docs/decisions/0010-ref-mirrored-cards-map-in-usereview.md)); both same-tick grades upsert. |
| BUG-8 | High | Sign-in code input capped at 6 digits; Supabase issues 8-digit codes | v97 — `maxLength` 10, submit enabled from 6; copy no longer says "6-digit". Reported live by owner. |
| BUG-9 | High | Reverse + Fill-the-gap drills always empty | v102 — the daily cap + v98 facet tiers starved them to zero once >25 new meaning/sound cards existed; cap removed (ADR-0012). |
| BUG-10 | Medium | "New words" drill showed the same 5 words forever | v102 — per-session random rotation + the whole discovered pool surfaces (was a fixed day-keyed slice of 5). |
| BUG-11 | Medium | TTS audio clipped at the start in all drills | v102 — `speechSynthesis.cancel()` and `speak()` fired in the same tick; new utterance now deferred 120 ms after a cancel, and a zh voice is picked explicitly. |
| BUG-3 | Low | Search "中国" ranks "发展中国家" above "中国" | v90 — client-side exact-match partition in `useDictionary.ts` (`search()`) surfaces an exact hanzi hit ahead of substring/compound matches. |
| BUG-5 | Medium | Review: grading "Easy" flashes red border (should be blue/green) | v90 — the picked grade button now takes an `outline` in its own `--grade-color` (`.combined-grade-row .review-btn.is-picked`, `styles.css`); Easy → `--grade-easy` blue. No card-surface red flash. |

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

**✅ Fixed (v90):** Resolved client-side instead — `useDictionary.ts`
`search()` partitions an exact-hanzi match to the front of the
hydrated results (stable), so it surfaces first regardless of the
RPC's tiering.

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

**✅ Fixed (v90):** Each grade button now sets `--grade-color` to its
own tier color (`.review-btn-again/-good/-easy` in `styles.css`), and
the picked button takes `outline: 2px solid var(--grade-color)`. There
is no card-surface red flash bound to grading — Easy reads blue
(`--grade-easy`). The `--grade-hard` orange token now exists too.

---

### BUG-6 · High · Retired drill cards starved the review queue

The phoneticTap + componentSound drills were dropped from the launch
screen in v85 (they can never be enabled; stale settings are
scrubbed), but `useReview` kept seeding FSRS cards for them. The rows
were due-immediately, could never be graded, sorted ahead of word
cards (char/component kinds first), and counted as "new" — so they
permanently consumed the 25/day new-card cap. With 25+ such rows, no
new word ever surfaced in review, and the hamburger badge / "N due"
counts were inflated by cards the user could never see.

**✅ Fixed (v95):** seeding removed; `RETIRED_FACETS` filtered on
localStorage load and Supabase reconcile; legacy local rows deleted by
the expected-cards cleanup; the daily-new cap now applies to word
cards only.

---

### BUG-7 · Medium · Combined card's second grade never reached Supabase

`grade()` read its changed-rows list from a variable assigned inside
the `setCards` updater, synchronously after dispatch. React only runs
an updater eagerly for the first dispatch in a tick, so the combined
card's second call (sound facet) always saw an empty list — the grade
persisted to localStorage but the Supabase upsert no-oped, and the
`introducedToday` bookkeeping was skipped. Cross-device, sound-facet
progress silently lagged (localStorage-only state, contra ADR-0001).

**✅ Fixed (v95):** all card-map writes go through a ref-mirrored
`applyCards` helper; see [ADR-0010](docs/decisions/0010-ref-mirrored-cards-map-in-usereview.md).
Cascade credit also now fires once per combined review (meaning facet
only) instead of twice.

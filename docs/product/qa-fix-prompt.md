# QA Fix Prompt — Chinese Learning App

Paste this into Claude Code with your repo open.

---

## Context

QA was run on chinese v84 (build Mon May 11 16:47:15 UTC 2026) deployed at `https://decobots.github.io/Ai-/`. 48 tests — 42 PASS, 4 FAIL, 2 BLOCKED. Below are the bugs and UX fixes to implement, ordered by priority.

---

## Bugs to fix

### BUG-1 · Medium — Deep links `#/c/` and `#/w/` are broken

Navigating to `#/c/好` or `#/w/你好` (both cold-load and in-page hash change) does NOT open an EntitySheet. The hash changes in the URL bar but the app ignores the `/c/` and `/w/` route patterns — it just shows the home screen. No console errors.

**Fix:** In the hash router, add route handlers for `#/c/:char` and `#/w/:word` that open the EntitySheet for the given character or word. Make sure these work on cold load (initial parse of `location.hash`) AND on in-page `hashchange` events.

### BUG-2 · Medium — localStorage usage (should be Supabase)

The app stores all user data in 4 localStorage keys: `chinese.saved`, `chinese.fsrs.v1`, `chinese.savedSort`, `chinese.reviewSettings`. For unauthenticated users this might be acceptable as a temporary cache, but the intent is for data to live in Supabase.

**Fix:** When the user is signed in, read/write these four data sets to Supabase instead of localStorage. Keep localStorage as a write-through cache for offline/fast reads, but Supabase should be the source of truth for authenticated users. On sign-in, merge localStorage data into the Supabase record (localStorage wins for conflicts on first merge, then Supabase wins going forward).

### BUG-3 · Low — Searching "中国" saves "发展中国家"

When searching for "中国" and saving the first result, the saved word is "发展中国家" (developing country) instead of "中国" (China). The search ranking appears to prefer longer compound words that contain the query.

**Fix:** Boost exact matches in the search ranking. A query that exactly matches a word's hanzi should always rank above partial/substring matches. If the dictionary entry for 中国 exists, it must appear before 发展中国家.

### BUG-4 · Cosmetic — Hamburger menu dismiss quirks

Escape closes the menu but causes a slight layout shift. Outside-click sometimes doesn't register on first tap (mobile).

**Fix:** Check that the menu close handler doesn't cause a reflow (e.g., toggling `display` vs. `visibility`/`transform`). For outside-click, make sure the overlay/backdrop captures `touchstart` as well as `click`.

---

## UX improvements (implement these)

### UX-1 · High — Bigger hanzi on saved-shelf cards

Card hanzi are ~32px. Bump to **48px**. The card grid has room — the English gloss can stay at 11px. Owner preference: "bigger characters."

### UX-2 · High — Remove persistent hint text

These always-visible hints clutter the UI for returning users:
- "Tap anywhere to continue" (Review)
- "Type pinyin, or tap a word below…" (Sentence — this is OK as an input placeholder, just don't show it as a separate label)
- "Search above to find a word, then tap ☆ to save it here" (Home empty state)

**Fix:** Show each hint only on the user's **first visit** to that screen (per session or via a `seen` flag). Fade out after 2 seconds. The empty-state text on the home page ("Save 5 words to start composing") can stay — that's an actual empty state, not a hint.

### UX-3 · High — Bigger hanzi in Sentence Studio word bank chips

Bank chip hanzi are ~24px. Increase to **34px**. The POS badge should be a thin colored left-edge stripe, not an overlaid pill.

### UX-4 · Med — Search result hanzi size

Search result row hanzi are ~28px. Bump to **36px**. Row height stays the same.

### UX-5 · Med — Review card hanzi size

Drill card hanzi (e.g. 家 in Sound·Tap) is ~80px. Increase to **110px**. The card has plenty of whitespace.

### UX-6 · Med — Adaptive layout for long words on shelf

The card for 发展中国家 overflows. For words > 3 characters: reduce font size adaptively or allow the card to span 2 columns. At minimum, truncate gracefully with ellipsis and show the full word on tap.

### UX-7 · Med — Graph gesture discoverability

The network and components graphs support long-press (show translation) and double-tap (navigate). These are invisible. Add a floating hint on first visit: "Long-press for translation · Double-tap to open" — auto-dismiss after 5 seconds or first interaction.

### UX-8 · Med — Sentence "Save sentence" button contrast

The "Save sentence" button looks disabled (ghost button). Give it a visible border or light fill. It should look tappable.

### UX-9 · Med — Consistent status tier icons across the app

The dropdown shows 🟢 for Learned but the shelf only shows ★ for all tiers. Use distinct colors/icons per tier everywhere: ★ orange (Saved), 🟢 green (Learned), ✒ purple (Wrote), ❗ red (Need to learn).

### UX-10 · Low — Lighten role colors in dark mode

The green (meaning) and blue (iconic) etymology colors are muted against the dark background. Lighten by ~20% in dark mode using a `prefers-color-scheme: dark` media query or CSS variables.

### UX-11 · Low — Review progress bar

The review header shows "1 / 12" but there's no visual progress bar. Add a thin bar under the header that fills as cards are completed.

### UX-12 · Low — Phonetics family preview font size

Family preview characters (啡 排 罪 …) are ~14px. Increase to **18px**.

---

## NOT bugs (confirmed working)

- Crushed POS tabs in Sentence Studio → FIXED in v84
- 0 console errors across all pages
- Dark mode renders correctly everywhere
- Back/forward hash navigation works
- EntitySheet renders as bottom sheet (mobile) / centered modal (desktop)
- Review launch screen, drill cards, phonetics page all functional
- Auth modal (magic link) works correctly
- Network and components graphs render and respond to layout toggles

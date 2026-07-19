# Explore page — spec (July 2026)

One browsing surface that replaces **Network**, **Components**, and
**Phonetics**. Owner decisions locked in chat (July 19 2026):

- **Navigation: focus stack + breadcrumb trail.** Tapping a related
  card makes it the new full-screen focus; a compact tappable
  breadcrumb row (青 › 情 › 情人) records the path and jumps back to
  any hop. Browser/hardware back pops one hop.
- **Connection badges count the owner's saved words only.** `→N` on a
  card = how many of MY saved words/characters connect onward from
  it; `end` chip when none. (Dictionary-wide counts rejected — the
  badge answers "is this direction worth walking for *my* set?")

## Why

Owner: the network *concept* ("what words is this character used
in") is the draw; the phonetics *page structure* (readable rows →
cards) is the preferred form; the graphs themselves are unusable on
mobile and "going through a graph in the blind". The graph's one
virtue — seeing which directions dead-end and which lead to rich
networks — is preserved by the badges.

## Shape

Entry `#/explore`, a React surface (the static Cytoscape pages retire
once this reaches parity).

**Index (entry screen), two tabs:**

```
 ← Done            EXPLORE
 [ Components ]  [ My words ]
 ─────────────────────────────
 青  qīng   green    12 of mine · family 24
 尔  ěr     you       3 of mine · family 9
 …  (top-250 productive components, phonetics-style rows)
```

Tapping a row opens the focus view — satisfying the owner's wish
that "clicking a phonetic row opens a page with all characters on
character cards so I can actually read them".

**Focus view (same layout for word / char / component):**

```
 ← Back            EXPLORE
 青 › 情 › 情人            ← breadcrumb, tappable
 ┌────────┐
 │  情人  │ qíngrén · lover   ★status
 └────────┘
 CHARACTERS IN THIS WORD
 ┌───────┐ ┌───────┐
 │ 情 →4 │ │ 人 →9 │
 └───────┘ └───────┘
 MY WORDS SHARING A CHARACTER (3)
 ┌───────┐ ┌────────┐ ┌───────┐
 │ 事情 →2│ │ 人们 →5 │ │ 大人 end│
 └───────┘ └────────┘ └───────┘
```

Sections by focus kind:

| Focus | Sections |
|---|---|
| word | characters in it · my words sharing a character |
| char | my words using it (the owner's primary interest — first) · characters built with it · its components · sound family (if it's a phonetic component) |
| component | characters built with it, as full-size cards · my words containing any of those |

- Cards are the existing `<Entity>` (sm/md) — same DNA everywhere.
- Focus card tap → EntitySheet (status, mnemonic, tree) — Explore
  navigates, the sheet details.
- Sections render lazily ("long dynamically-loaded page" feel);
  long sections cap at ~12 with a "show all" expander.
- Badge math: reverse index component→chars built once from
  data-chars (~10k rows, client-side, memoized); char→my-words from
  the saved set. Saved-only per the decision, so it's all local and
  fast.

## Staged build

1. **Stage 1 (v109):** `#/explore` route + index (Components tab from
   phonetic-components.json, My-words tab) + component focus view
   with family cards + breadcrumb. Hamburger gets "Explore";
   old entries stay.
2. **Stage 2 (v110):** char + word focus views, saved-set badges +
   `end` chips, reverse component index, "Explore from here" link in
   EntitySheet.
3. **Stage 3 (v111):** retire Network / Components / Phonetics pages,
   hamburger + docs cleanup, PWA manifest/SW simplification (drops
   the vendored Cytoscape and the static-page cache rules).

Each stage is one PR-sized change; the owner reviews between stages.

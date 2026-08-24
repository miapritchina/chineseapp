# Character images — mnemonics + ink illustrations

**Status:** Active · direction approved, tooling built, first entry in progress ·
Aug 24 2026

The goal: give characters a **picture + a memory story**, the way vocabulary
posters and mnemonic books do — but grounded in the decomposition data the app
already has, in one consistent house style, with the owner curating every one.

---

## The decisions we landed on

**1. We generate our own — no off-the-shelf clip-art.**
Free sets (ARASAAC ~11.5k pictograms, OpenMoji ~4k) only cover concrete nouns,
in the wrong style, with gaps. Mixing them with our own art looks worse than
either alone. So: generate, don't borrow.

**2. Every word maps to one of a few visual "devices," not just "a photo of the
thing."**
Concrete nouns → the object. Verbs → a figure doing it. Adjectives → an iconic
stand-in or comparison. Pronouns → a pointing gesture. Question words → a "?"
composited on a cue. Particles → a tiny scene. Function words → usually no
image. The device is what makes abstract words illustratable.

**3. The "character-becomes-the-picture" book style can't come from AI.**
Those illustrations bend the real glyph strokes into a scene by hand — image
models garble that. Instead the app fakes the effect by **compositing**: the
real glyph (HanziWriter) + the illustration + the app's existing
component-colour highlighting + the mnemonic text.

**4. House style: 水墨 ink-wash + red seal, monochrome.**
Loose black brush strokes, grey washes, rice-paper background, one small
vermilion seal as the only colour. Chosen from a 6-option style board (flat,
sticker, mono-line, gradient, ink, riso). It's the one style that belongs *with*
the characters rather than just decorating them.
Style board: <https://claude.ai/code/artifact/209ab2fd-b865-41d1-9f68-9a2c50d95fe9>

**5. No text baked into the image.**
AI mangles in-image Chinese text. The picture stays textless; the app overlays
the real glyph, pinyin, and gloss (the seal is the only "writing," and it's
abstract).

**6. Two layers, generated separately.**
- **Mnemonic text** — free, LLM-written from real component data, owner-curated.
- **Illustration** — generated in Recraft, one at a time, in the locked style.

---

## Recraft: how it's paid for

Your **Pro web subscription and the API are separate wallets** — web credits
can't pay for the API, and Recraft won't issue an API key until you've bought
API units separately.

| Path | Cost |
|---|---|
| **Recraft web** (paste prompts by hand) | covered by your Pro sub — **no extra cost** |
| API, raster, ~3 tries each, all 562 known chars | ~$70 (separate spend) |
| API, per image | ~$0.04 raster · ~$0.08 vector |

**Decision:** stay on the **web** path (as-you-go, no new spend). API batch stays
an option if you ever want to bulk-fill.

---

## What we built

### The `/mnemonic` skill

A Claude Code skill (`.claude/skills/mnemonic/SKILL.md`) you talk to, one
character at a time. Say `/mnemonic 瘦` (or "let's do 忘") and it runs:

1. **Loads the truth** — real components, and which are *meaning* vs *sound*.
2. **Pitches two mnemonic angles** grounded in those parts.
3. **You shape it** — cut, twist, veto, or hand it your own wording.
4. **Locks the story** (1–2 sentences).
5. **Derives the picture** — a paste-ready Recraft prompt in the ink style.
6. **Saves** the entry and hands you the prompt.

Grounding rule it always follows: **never invent etymology.** Build on the real
components; label a memory aid as a memory aid, not history.

### The data file

`public/char-mnemonics.json` — authored content (like etymology), shipped
static, keyed by character:

```json
{
  "忘": {
    "char": "忘", "pinyin": "wàng", "gloss": "to forget",
    "mnemonic": "…the locked story…",
    "components": ["心 heart — meaning", "亡 flee/die (wáng) — sound"],
    "illustrationPrompt": "<style block> + <scene>",
    "imageFile": "char-images/5fd8.png",
    "style": "ink-seal", "status": "draft"
  }
}
```

Images live in `public/char-images/<hex>.png`, named by the character's Unicode
code point (忘 → `5fd8`, 球 → `7403`, 瘦 → `7626`) so filenames stay ASCII-safe.

---

## How to add a character (the loop)

1. `/mnemonic <char>` → co-author the story and the prompt with Claude.
2. Copy the `illustrationPrompt`, generate it in **Recraft web** (V4.1, ink
   style), download the PNG.
3. Save it as `public/char-images/<hex>.png`.
4. Tell Claude — it flips the entry's `status` from `draft` to `done`.

---

## Progress

| Char | Meaning | Mnemonic | Image | Status |
|---|---|---|---|---|
| 忘 | forget | ✅ locked ("a thought flees the heart") | ⏳ awaiting generation | draft |
| 球 | ball | — | — | not started |
| 瘦 | thin | — | — | not started |

Known characters to eventually cover: **~562**.

---

## Open / later

- **Character ↔ picture relationship** still to pick: *caption* (label under),
  *watermark* (big faint glyph behind), or *woven* (glyph whole, its
  meaning/sound parts colour-coded to the mnemonic). See the style board.
- **App wiring** — render image + mnemonic on `Card` / `EntitySheet`. Not built
  yet; the data path is ready for it.
- **Review gallery** — an optional artifact showing the whole growing set, once
  there are enough entries to be worth browsing.

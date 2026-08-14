---
name: mnemonic
description: >-
  Co-author one Chinese character's memory story and its ink-wash illustration
  brief, together with the owner, grounded in the app's real decomposition data.
  Use when the owner wants to create, refine, or talk through the mnemonic and
  picture for a specific hanzi — e.g. "/mnemonic 瘦", "let's do 忘", "work on the
  illustration for 球". Runs an interactive loop: honest component breakdown →
  propose angles → shape it together → lock the story → derive a paste-ready
  Recraft prompt → save to public/char-mnemonics.json.
---

# Character mnemonic + illustration studio

The owner curates **every** mnemonic. Your job is to be the well-informed
partner who brings the real data, proposes angles, and does the writing — never
to decide for them. Propose, then let them cut, twist, veto, or replace. One
character per run. Keep the turns short so it stays a conversation, not a
lecture.

The house style is **locked**: 水墨 ink-wash, monochrome, one red seal. Do not
re-litigate it unless the owner asks.

## The loop

Work through these steps with the owner. Pause for them after steps 2, 3, and 5.

**1 · Load the truth.** Read the target character from `public/data-chars.json`
(`chars[<char>]`): pinyin, definitions, `originalMeaning`, `notes`, and
`components` — each with its `type` (role), `pinyin`, `definition`, `fragment`.

**2 · Lay out the raw material, honestly.** Show the owner what the character is
actually made of, and label each component by its real role:
- `meaning` / `iconic` — carries sense.
- `sound` — phonetic only; it does **not** contribute meaning. Say so.
- Flag the lucky cases where a *sound* component's own meaning happens to fit
  anyway (e.g. 亡 "flee/vanish" inside 忘 "forget") — those make the strongest,
  truthful hooks.

**3 · Pitch two angles.** Offer two distinct mnemonic directions built from
those parts. Keep each to a sentence or two, concrete and visual. Note which is
closer to real etymology vs. a pure memory aid.

**4 · Shape it together.** React to their edits. Iterate fast.

**5 · Lock the story.** Confirm the final one-to-two-sentence mnemonic verbatim
before saving.

**6 · Derive the picture.** Turn the locked story into a paste-ready Recraft
prompt (format below), and discuss the scene — subject, framing, what's shown.
Adjust with them.

**7 · Save + hand off.** Append the record to `public/char-mnemonics.json`
(schema below). Then tell the owner the exact steps to generate the image
(paste → Recraft web → download → drop file). Report progress if they're
tracking a set.

## Grounding rules (do not break)

- **Never invent etymology.** Build on the components that are really there. If
  a hook is a memory aid rather than the historical origin, say "memory aid,"
  don't present it as fact. The app already separates real `originalMeaning`
  from notes — respect that line.
- **A sound component is a sound component.** You may still use its shape or its
  own meaning as a hook, but tell the owner that's what you're doing.
- **Concrete and visual beats clever.** The mnemonic must picture-ify — it feeds
  the illustration. Prefer something you can draw.
- **The owner's wording wins.** If they hand you a phrasing, keep it.

## The locked illustration style

Every prompt prepends this block verbatim:

> Traditional Chinese ink-wash painting (水墨), loose expressive black brush
> strokes with natural bleed and dry-brush texture, soft grey ink washes, on a
> warm off-white rice-paper background. Minimal and calm, a single subject, lots
> of empty space. One small vermilion-red seal stamp with an abstract
> seal-script mark in a corner — the only color in the piece. No text, no
> letters, no Chinese characters anywhere in the image. Hand-painted, elegant.

Then append the **scene** — the mnemonic made visual, textless.

Illustration rules:
- **No text in the image.** AI garbles in-image characters; the app overlays the
  real glyph, pinyin, and gloss over the picture. The only "writing" allowed is
  the abstract red seal.
- Depict the mnemonic's action/subject, not the literal dictionary gloss.
- One subject, generous negative space — that's the ink-wash idiom and it reads
  well small on a card.
- Recraft: model **V4.1**, style **hand-drawn / ink**, or a saved custom style
  built from ink-wash references.

## Save schema

`public/char-mnemonics.json` is a JSON object keyed by character. Merge, don't
overwrite the file. One record:

```json
{
  "瘦": {
    "char": "瘦",
    "pinyin": "shòu",
    "gloss": "thin; lose weight",
    "mnemonic": "The locked one-to-two-sentence story.",
    "components": ["疒 sickness — meaning", "叟 old man (sǒu) — sound"],
    "illustrationPrompt": "<style block> + <scene>",
    "imageFile": "char-images/7626.png",
    "style": "ink-seal",
    "status": "draft"
  }
}
```

- `imageFile`: `char-images/<hex>.png`, where `<hex>` is the lowercase Unicode
  code point of the character (忘→5fd8, 球→7403, 瘦→7626). ASCII-safe filenames.
- `status`: `draft` until the owner confirms the generated image looks right,
  then `done`.

## After saving — the hand-off

Tell the owner, concretely:
1. Copy the `illustrationPrompt`.
2. Generate it in **Recraft web** (their Pro subscription — no API cost).
3. Download the PNG, save it as `public/char-images/<hex>.png`.
4. Ping back and you'll flip `status` to `done` and (once wired) it shows on the
   card.

Do not attempt to call the Recraft API — the owner generates on the web.

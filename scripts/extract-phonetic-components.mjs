// Build script: walks data-chars.json, ranks every Han character by how
// often it shows up as a *sound* component in other characters, and emits
// the top ~250 to public/phonetic-components.json.
//
// Output shape:
//   { generated: ISO timestamp,
//     components: [
//       { char, pinyin (tone-free), pinyinTones, count, family: [chars…] }
//     ] }
//
// The componentSound drill (v59+) and the Phonetic-components browse
// surface (in App.tsx) read this file directly. Re-run after a
// data-chars.json regeneration:
//
//   node scripts/extract-phonetic-components.mjs

import { readFileSync, writeFileSync } from "node:fs";

const TOP_N = 250;
const FAMILY_CAP = 60; // truncate family list per component to keep the file small

const { chars } = JSON.parse(readFileSync("public/data-chars.json", "utf8"));

function stripTones(s) {
  // Dedupe multi-readings ("lǐng;lìng;līng" → "ling"), keep the first
  // distinct tone-free reading; the drill only cares about syllable
  // (initial+final), per the brief's "defer tone, train syllable" plan.
  if (!s) return "";
  const flat = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const readings = flat.split(/[;,/]/).filter(Boolean);
  return readings.length === 0 ? flat : readings[0];
}

// soundChar → { count, pinyin (with tones, taken from data), family: [parents] }
const usage = new Map();

for (const [parent, cd] of Object.entries(chars)) {
  if (!cd?.components) continue;
  for (const comp of cd.components) {
    if (!comp || comp.type !== "sound" || !comp.char) continue;
    const c = comp.char;
    if (c === "◎") continue;
    const slot = usage.get(c) || {
      count: 0,
      pinyin:
        comp.pinyin ||
        (chars[c] && chars[c].pinyin) ||
        "",
      family: [],
    };
    slot.count++;
    slot.family.push(parent);
    if (!slot.pinyin) {
      slot.pinyin = comp.pinyin || (chars[c] && chars[c].pinyin) || "";
    }
    usage.set(c, slot);
  }
}

const items = [...usage.entries()]
  .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
  .slice(0, TOP_N)
  .map(([char, { count, pinyin, family }]) => ({
    char,
    pinyin: stripTones(pinyin),
    pinyinTones: pinyin || "",
    count,
    family: family.slice(0, FAMILY_CAP),
  }));

const payload = {
  generated: new Date().toISOString(),
  source: "data-chars.json",
  total: items.length,
  components: items,
};

writeFileSync(
  "public/phonetic-components.json",
  JSON.stringify(payload, null, 2) + "\n",
);

console.log(
  `Wrote public/phonetic-components.json with ${items.length} components.`,
);
console.log(
  `Top 5: ${items.slice(0, 5).map((i) => `${i.char}(${i.pinyin}, ${i.count})`).join(", ")}`,
);

// Bulk-load chinese-lexicon into the Supabase `words` table.
//
// Run once after applying supabase/migrations/0001_dictionary.sql:
//
//   SUPABASE_SERVICE_ROLE_KEY=sb_secret_... node scripts/seed-supabase.mjs
//
// Idempotent: PK is `word`, so re-running upserts in place. Service role key
// is required (anon role can only SELECT). Get it from
// https://app.supabase.com/project/oigbbgtzzqiceetasayy/settings/api-keys
// (the secret/service_role key) and pass it via env — never commit it.
//
// Filters mirror what the React app expects: CJK only, ≤8 chars, no proper
// nouns, no entries that are only cross-references.

import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const lex = require("chinese-lexicon");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://oigbbgtzzqiceetasayy.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY env var.");
  console.error("Get it from Supabase Dashboard → Project Settings → API Keys → service_role.");
  process.exit(1);
}

const HANZI_RE = /^[㐀-鿿豈-﫿]+$/;
const MAX_WORD_LEN = 8;
const BATCH_SIZE = 500;

function isProperNoun(entry) {
  return /^[A-Z]/.test(entry.pinyin || "");
}

function isOnlyCrossRef(entry) {
  const defs = entry.definitions || [];
  if (defs.length === 0) return true;
  return defs.every((d) => /^see /i.test(d) || /^variant of /i.test(d));
}

function cleanDefinitions(defs) {
  if (!Array.isArray(defs)) return [];
  return defs.filter((d) => !/^CL:/.test(d));
}

function buildAllEntries() {
  const filtered = [];
  for (const e of lex.allEntries) {
    if (!HANZI_RE.test(e.simp)) continue;
    if (e.simp.length > MAX_WORD_LEN) continue;
    if (isProperNoun(e)) continue;
    if (isOnlyCrossRef(e)) continue;
    filtered.push(e);
  }
  filtered.sort((a, b) => {
    const ar = a.statistics?.movieWordRank ?? Infinity;
    const br = b.statistics?.movieWordRank ?? Infinity;
    if (ar !== br) return ar - br;
    return a.simp.localeCompare(b.simp);
  });
  const seen = new Set();
  const out = [];
  for (const e of filtered) {
    if (seen.has(e.simp)) continue;
    seen.add(e.simp);
    out.push(e);
  }
  return out;
}

function toRow(entry) {
  const trad = entry.trad !== entry.simp ? entry.trad : null;
  const defs = cleanDefinitions(entry.definitions);
  return {
    word: entry.simp,
    pinyin: (entry.pinyin || "").replace(/​/g, ""),
    searchable_pinyin: (entry.searchablePinyin || "").replace(/\s+/g, ""),
    definitions: defs,
    // Pre-join definitions for the trigram English-gloss index. Schema can't
    // express this as a GENERATED column (subqueries forbidden), so we
    // populate it client-side here.
    definitions_text: defs.join(" "),
    hsk: entry.statistics?.hskLevel ?? null,
    rank: entry.statistics?.movieWordRank ?? null,
    trad,
  };
}

async function main() {
  const supa = createClient(SUPABASE_URL, KEY, {
    auth: { persistSession: false },
  });

  console.log(`Building seed from chinese-lexicon…`);
  const entries = buildAllEntries();
  console.log(`  ${entries.length} entries after filtering.`);

  const rows = entries.map(toRow);

  console.log(`Upserting in batches of ${BATCH_SIZE}…`);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supa.from("words").upsert(batch, { onConflict: "word" });
    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed:`, error);
      process.exit(1);
    }
    inserted += batch.length;
    process.stdout.write(`  ${inserted} / ${rows.length}\r`);
  }
  console.log(`\nDone. ${inserted} rows upserted.`);

  // Sanity-check: count and a sample row.
  const { count } = await supa.from("words").select("*", { count: "exact", head: true });
  console.log(`Words table now has ${count} rows.`);
  const { data: sample } = await supa.from("words").select("*").eq("word", "你好").limit(1);
  if (sample && sample.length) console.log(`Sample (你好):`, sample[0]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

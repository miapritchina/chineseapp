import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  applyCascadeCredit,
  gradeCard,
  isDue,
  seedCard,
  type RatingName,
  type SerializedCard,
} from "../lib/fsrs";
import type { Char, ItemKind, Facet } from "../lib/types";
export type { ItemKind, Facet } from "../lib/types";
import { componentClosure } from "../lib/componentSearch";
import { useReconcileTriggers } from "./useReconcileTriggers";

const FSRS_KEY = "chinese.fsrs.v1";
// Drills dropped from the launch screen (phoneticTap/componentSound
// v85, familyTransfer v107) — they can never be enabled, so their rows
// must not load, seed, or sync back in. Legacy rows may still exist in
// localStorage / Supabase from before the drop.
const RETIRED_FACETS = new Set<string>(["phoneticTap", "componentSound", "familyTransfer"]);
const CASCADE_CAP_DAYS = 7;
// Passive-view credit (v108): opening a saved item's sheet counts a
// LITTLE — half a Good's stability gain (the cascade damping), due
// pushed at most this many days, reps untouched. Throttled to one
// credit per item per day (persisted) so idle browsing can't
// snowball a card's schedule.
const PASSIVE_CAP_DAYS = 2;
const PASSIVE_KEY = "chinese.passiveCredit";

function loadPassiveLog(): Map<string, number> {
  try {
    const raw = localStorage.getItem(PASSIVE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as { items?: [string, number][] };
    const cutoff = Date.now() - 2 * 86400000;
    return new Map((parsed.items ?? []).filter(([k, ts]) => k && ts > cutoff));
  } catch {
    return new Map();
  }
}

function persistPassiveLog(log: Map<string, number>) {
  try {
    localStorage.setItem(PASSIVE_KEY, JSON.stringify({ items: [...log.entries()] }));
  } catch {
    /* ignore */
  }
}

export interface ReviewCard {
  itemKey: string;
  itemKind: ItemKind;
  facet: Facet;
  card: SerializedCard;
  dueAt: number; // ms epoch — denormalized from card.due for fast filtering
  lastReviewAt: number | null;
  // PR 3 metadata for cascade math. Stored locally only (not in user_fsrs_state
  // schema yet — derivable from the Card on remote-load if needed).
  directReviews?: number;
  cascadeReviews?: number;
}

// Local key for the (item_key, item_kind, facet) tuple.
function rowId(itemKey: string, itemKind: ItemKind, facet: Facet): string {
  return `${itemKind}|${facet}|${itemKey}`;
}

interface UseReviewOpts {
  userId: string | null;
  // The set of items the user has saved. Every saved word gets a
  // recognition card (saving == queue for learning, per the user's
  // "review should include all my words" goal). Items dropped from this
  // set have their cards removed.
  scheduledKeys: Set<string>;
  // data-chars.json content; needed for the cascade walk down to
  // constituent chars and components.
  chars: Record<string, Char>;
  // Full phonetic-components map keyed by char. Used by the
  // familyTransfer seeding rule (need to walk family[]).
  phoneticComponentsByChar?: Map<string, { char: string; pinyin: string; family: string[] }>;
}

function loadLocalCards(): Map<string, ReviewCard> {
  try {
    const raw = localStorage.getItem(FSRS_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) return new Map();
    const map = new Map<string, ReviewCard>();
    for (const it of parsed.items as ReviewCard[]) {
      if (it && it.itemKey && it.card && typeof it.dueAt === "number") {
        if (RETIRED_FACETS.has(it.facet)) continue;
        map.set(rowId(it.itemKey, it.itemKind, it.facet), it);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function persistLocalCards(cards: Map<string, ReviewCard>) {
  try {
    localStorage.setItem(FSRS_KEY, JSON.stringify({ version: 1, items: [...cards.values()] }));
  } catch {
    /* private mode / quota — silent */
  }
}

// Facet split (v66): recognition → meaningRecognition + soundRecognition.
// Each saved word seeds both. Legacy "recognition" rows (from before the
// split) are renamed in-memory at load time so their FSRS state isn't
// lost; they continue training the meaning facet.
const FIRST_KIND: ItemKind = "word";
const MEANING_FACET: Facet = "meaningRecognition" as Facet;

export function useReview({
  userId,
  scheduledKeys,
  chars,
  phoneticComponentsByChar,
}: UseReviewOpts) {
  const [cards, setCards] = useState<Map<string, ReviewCard>>(() => loadLocalCards());
  const [syncing, setSyncing] = useState(false);

  // Synchronous mirror of `cards`. Every write goes through applyCards so
  // two grade() calls in the same tick (the combined recognition card
  // fires meaning + sound back-to-back) each see the other's result —
  // the old functional-setState approach computed inside the updater,
  // which React defers for the second dispatch, so the second grade's
  // remote upsert read an empty change-list and the sound facet never
  // reached Supabase.
  const cardsRef = useRef<Map<string, ReviewCard>>(cards);
  const applyCards = useCallback((next: Map<string, ReviewCard>) => {
    cardsRef.current = next;
    persistLocalCards(next);
    setCards(next);
  }, []);

  // Build payload for one Supabase upsert row.
  const toRemoteRow = (row: ReviewCard) => ({
    user_id: userId,
    item_key: row.itemKey,
    item_kind: row.itemKind,
    facet: row.facet,
    card: row.card,
    due_at: new Date(row.dueAt).toISOString(),
    last_review_at: row.lastReviewAt ? new Date(row.lastReviewAt).toISOString() : null,
  });

  // What facets to seed for a given saved set. Word recognition is
  // unconditional. The retired phoneticTap / componentSound drills are
  // no longer seeded — they were dropped from the launch screen but kept
  // seeding cards, which inflated the due badge and ate the daily new-
  // card cap with rows that could never surface.
  const expectedCards = useMemo(() => {
    const out = new Map<string, { itemKey: string; itemKind: ItemKind; facet: Facet }>();
    for (const key of scheduledKeys) {
      out.set(rowId(key, "word", "meaningRecognition"), {
        itemKey: key,
        itemKind: "word",
        facet: "meaningRecognition",
      });
      out.set(rowId(key, "word", "soundRecognition"), {
        itemKey: key,
        itemKind: "word",
        facet: "soundRecognition",
      });
      // v98 drills. Reverse (gloss → hanzi) for every saved word; cloze
      // (masked char) only makes sense with ≥2 characters.
      out.set(rowId(key, "word", "reverseRecognition"), {
        itemKey: key,
        itemKind: "word",
        facet: "reverseRecognition",
      });
      if ([...key].length >= 2) {
        out.set(rowId(key, "word", "clozeChar"), {
          itemKey: key,
          itemKind: "word",
          facet: "clozeChar",
        });
      }
    }
    // familySweep: one card per saved phonetic component with ≥3
    // family members that exist in data-chars.
    if (phoneticComponentsByChar && phoneticComponentsByChar.size > 0) {
      for (const key of scheduledKeys) {
        if ([...key].length !== 1) continue;
        const comp = phoneticComponentsByChar.get(key);
        if (!comp?.family) continue;
        const usable = comp.family.filter((f) => f && f !== comp.char && chars[f]);
        if (usable.length < 3) continue;
        out.set(rowId(key, "component", "familySweep"), {
          itemKey: key,
          itemKind: "component",
          facet: "familySweep",
        });
      }
    }
    // production: any saved single-character item gets a Hanzi Writer
    // trace drill (opt-in on the launch screen). Was gated on the ✒
    // Wrote tier until v99 removed that status (ADR-0011). Multi-char
    // words don't seed production yet (chained-quiz UX is a follow-up).
    for (const key of scheduledKeys) {
      if ([...key].length !== 1) continue;
      out.set(rowId(key, "char", "production"), {
        itemKey: key,
        itemKind: "char",
        facet: "production",
      });
    }
    return out;
  }, [scheduledKeys, chars, phoneticComponentsByChar]);

  // Reconcile: ensure every expected card exists; drop any auto-seeded
  // facet card whose key is no longer expected. Cascaded char recognition
  // cards (kind=char, facet=recognition) are independent and survive —
  // they may still belong to other saved words via the cascade.
  useEffect(() => {
    let changed = false;
    const next = new Map(cardsRef.current);
    // Legacy migration: pre-v66 rows used facet "recognition" for the
    // single combined card. Rename them to "meaningRecognition" so the
    // user's existing FSRS state isn't lost.
    for (const [id, row] of next) {
      if (row.facet === "recognition") {
        const newRow: ReviewCard = { ...row, facet: "meaningRecognition" };
        const newId = rowId(newRow.itemKey, newRow.itemKind, newRow.facet);
        next.delete(id);
        if (!next.has(newId)) {
          next.set(newId, newRow);
          changed = true;
        }
      }
    }

    const newSeeds: ReviewCard[] = [];
    for (const [id, target] of expectedCards) {
      if (!next.has(id)) {
        const seeded = seedCard();
        const row: ReviewCard = {
          itemKey: target.itemKey,
          itemKind: target.itemKind,
          facet: target.facet,
          card: seeded,
          dueAt: new Date(seeded.due).getTime(),
          lastReviewAt: null,
          directReviews: 0,
          cascadeReviews: 0,
        };
        next.set(id, row);
        newSeeds.push(row);
        changed = true;
      }
    }
    // Drop auto-seeded facet rows that aren't expected anymore (incl.
    // legacy rows for the retired phoneticTap / componentSound drills).
    // Cascade-seeded char/recognition cards are independent and survive.
    for (const [id, row] of next) {
      const isAutoFacet =
        (row.itemKind === "word" &&
          (row.facet === "meaningRecognition" ||
            row.facet === "soundRecognition" ||
            row.facet === "reverseRecognition" ||
            row.facet === "clozeChar")) ||
        (row.itemKind === "char" && (row.facet === "phoneticTap" || row.facet === "production")) ||
        (row.itemKind === "component" &&
          (row.facet === "componentSound" || row.facet === "familySweep"));
      if (isAutoFacet && !expectedCards.has(id)) {
        next.delete(id);
        changed = true;
      }
    }
    if (!changed) return;
    applyCards(next);
    if (userId && newSeeds.length > 0) {
      void supabase
        .from("user_fsrs_state")
        .upsert(newSeeds.map(toRemoteRow), { onConflict: "user_id,item_key,item_kind,facet" })
        .then(({ error }) => {
          if (error && !/relation .*user_fsrs_state.*does not exist/i.test(error.message || "")) {
            console.warn("fsrs upsert (seed) failed:", error);
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expectedCards, userId]);

  // Initial sync when a user signs in, plus a re-sync whenever the tab
  // regains focus (throttled) — Supabase is the source of truth, the
  // local cards map is just an offline cache. On conflict the row with
  // more reps wins, so a re-sync can't clobber a card graded on this
  // device whose write to Supabase hasn't landed yet.
  const reconcile = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    const { data, error } = await supabase
      .from("user_fsrs_state")
      .select("item_key, item_kind, facet, card, due_at, last_review_at")
      .eq("user_id", userId);
    if (error) {
      // Migration probably not yet applied; degrade silently.
      if (!/relation .*user_fsrs_state.*does not exist/i.test(error.message || "")) {
        console.warn("fsrs load failed:", error);
      }
      setSyncing(false);
      return;
    }
    const remote = new Map<string, ReviewCard>();
    for (const r of data || []) {
      if (RETIRED_FACETS.has(r.facet)) continue;
      // Migrate legacy "recognition" rows from the DB into the new
      // "meaningRecognition" facet on the way in (one-time, in-memory).
      const facet =
        r.facet === "recognition" ? ("meaningRecognition" as Facet) : (r.facet as Facet);
      const row: ReviewCard = {
        itemKey: r.item_key,
        itemKind: r.item_kind as ItemKind,
        facet,
        card: r.card as SerializedCard,
        dueAt: new Date(r.due_at).getTime(),
        lastReviewAt: r.last_review_at ? new Date(r.last_review_at).getTime() : null,
      };
      remote.set(rowId(row.itemKey, row.itemKind, row.facet), row);
    }
    const localBefore = cardsRef.current;
    const merged = new Map(localBefore);
    for (const [id, r] of remote) {
      const p = merged.get(id);
      if (!p) {
        merged.set(id, r);
        continue;
      }
      const pReps = p.card.reps ?? 0;
      const rReps = r.card.reps ?? 0;
      if (rReps > pReps) {
        // Remote saw a grade we don't have — take it, but keep our
        // local-only bookkeeping fields (not stored in the schema).
        merged.set(id, {
          ...r,
          directReviews: p.directReviews,
          cascadeReviews: p.cascadeReviews,
        });
      } else if (rReps === pReps) {
        const pT = p.lastReviewAt ?? 0;
        const rT = r.lastReviewAt ?? 0;
        if (rT >= pT) {
          merged.set(id, {
            ...r,
            directReviews: p.directReviews,
            cascadeReviews: p.cascadeReviews,
          });
        }
        // else: local was reviewed more recently than the remote row
        // records — keep local; the pending write will catch the DB up.
      }
      // rReps < pReps → keep local (it has a grade the DB hasn't stored).
    }
    applyCards(merged);
    // Upload any local rows the remote didn't have.
    const toUpload: ReviewCard[] = [];
    for (const [id, row] of localBefore) {
      if (!remote.has(id)) toUpload.push(row);
    }
    if (toUpload.length > 0) {
      const { error: upErr } = await supabase.from("user_fsrs_state").upsert(
        toUpload.map((row) => ({
          user_id: userId,
          item_key: row.itemKey,
          item_kind: row.itemKind,
          facet: row.facet,
          card: row.card,
          due_at: new Date(row.dueAt).toISOString(),
          last_review_at: row.lastReviewAt ? new Date(row.lastReviewAt).toISOString() : null,
        })),
        { onConflict: "user_id,item_key,item_kind,facet" },
      );
      if (upErr && !/relation .*user_fsrs_state.*does not exist/i.test(upErr.message || "")) {
        console.error("fsrs upload failed:", upErr);
      }
    }
    setSyncing(false);
  }, [userId, applyCards]);

  useReconcileTriggers(userId, reconcile);

  // Due cards — EVERYTHING due, no daily cap (ADR-0012: the owner wants
  // the whole backlog available; the v95 cap starved the v98 facets to
  // zero once >25 new meaning/sound cards existed). Char + component
  // cards before word cards; within word kind, meaning/sound before
  // reverse/cloze; then oldest-due first.
  const dueCards = useMemo<ReviewCard[]>(() => {
    const now = new Date();
    const facetTier = (row: ReviewCard) =>
      row.facet === "reverseRecognition" || row.facet === "clozeChar" ? 1 : 0;
    return [...cards.values()]
      .filter((row) => isDue(row.card, now))
      .sort((a, b) => {
        const ka = a.itemKind === "word" ? 1 : 0;
        const kb = b.itemKind === "word" ? 1 : 0;
        if (ka !== kb) return ka - kb;
        const ta = facetTier(a);
        const tb = facetTier(b);
        if (ta !== tb) return ta - tb;
        return a.dueAt - b.dueAt;
      });
  }, [cards]);

  // Helper to upsert a batch of changed rows to Supabase.
  const remoteUpsert = (rows: ReviewCard[]) => {
    if (!userId || rows.length === 0) return;
    void supabase
      .from("user_fsrs_state")
      .upsert(rows.map(toRemoteRow), { onConflict: "user_id,item_key,item_kind,facet" })
      .then(({ error }) => {
        if (error && !/relation .*user_fsrs_state.*does not exist/i.test(error.message || "")) {
          console.error("fsrs upsert failed:", error);
        }
      });
  };

  // Append one row to the review log — the raw material for future
  // FSRS parameter optimization (user_fsrs_state only keeps CURRENT
  // card state). Fire-and-forget; a missing table degrades silently.
  const logReview = (row: ReviewCard, rating: RatingName) => {
    if (!userId) return;
    void supabase
      .from("user_review_log")
      .insert({
        user_id: userId,
        item_key: row.itemKey,
        item_kind: row.itemKind,
        facet: row.facet,
        rating,
        prev_card: row.card,
      })
      .then(({ error }) => {
        if (error && !/relation .*user_review_log.*does not exist/i.test(error.message || "")) {
          console.warn("review log insert failed:", error);
        }
      });
  };

  // Damped Good credit for every char/component reachable from
  // itemKey. Mutates `next` in place; returns the changed rows. Shared
  // by grade() (word Good/Easy) and recordInference() (correct guess
  // on an unsaved inference word).
  const cascadeToClosure = (itemKey: string, next: Map<string, ReviewCard>, now: Date) => {
    const changed: ReviewCard[] = [];
    const closure = componentClosure(itemKey, chars);
    closure.delete(itemKey);
    for (const childKey of closure) {
      const childKind: ItemKind = "char";
      const childId = rowId(childKey, childKind, MEANING_FACET);
      let childRow = next.get(childId);
      if (!childRow) {
        const seeded = seedCard(now);
        childRow = {
          itemKey: childKey,
          itemKind: childKind,
          facet: MEANING_FACET,
          card: seeded,
          dueAt: new Date(seeded.due).getTime(),
          lastReviewAt: null,
          directReviews: 0,
          cascadeReviews: 0,
        };
      }
      const isDirect = (childRow.directReviews ?? 0) > 0;
      const newChildCard = applyCascadeCredit(
        childRow.card,
        isDirect ? null : CASCADE_CAP_DAYS,
        now,
      );
      const newChild: ReviewCard = {
        ...childRow,
        card: newChildCard,
        dueAt: new Date(newChildCard.due).getTime(),
        cascadeReviews: (childRow.cascadeReviews ?? 0) + 1,
      };
      next.set(childId, newChild);
      changed.push(newChild);
    }
    return changed;
  };

  // Outcome of a new-word inference card. The word has no FSRS row of
  // its own: a correct guess credits the constituent chars exactly like
  // a word Good; either way the outcome is logged under the
  // wordInference facet (prev_card null) — useWordInference reads those
  // rows back so answered words stay out of the pool across devices.
  const recordInference = useCallback(
    (itemKey: string, gotIt: boolean) => {
      if (userId) {
        void supabase
          .from("user_review_log")
          .insert({
            user_id: userId,
            item_key: itemKey,
            item_kind: "word",
            facet: "wordInference",
            rating: gotIt ? "Good" : "Again",
            prev_card: null,
          })
          .then(({ error }) => {
            if (error && !/relation .*user_review_log.*does not exist/i.test(error.message || "")) {
              console.warn("inference log insert failed:", error);
            }
          });
      }
      if (!gotIt) return;
      const now = new Date();
      const next = new Map(cardsRef.current);
      const changed = cascadeToClosure(itemKey, next, now);
      if (changed.length === 0) return;
      applyCards(next);
      remoteUpsert(changed);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, chars, applyCards],
  );

  // Reading through a saved item on the main page counts as a partial
  // repetition (owner request, v108) — NOT a full grade: no rep is
  // recorded and the schedule moves at most PASSIVE_CAP_DAYS out, so
  // the card still comes back soon to be answered properly.
  const passiveLogRef = useRef<Map<string, number> | null>(null);
  const creditPassiveView = useCallback(
    (itemKey: string) => {
      if (passiveLogRef.current === null) passiveLogRef.current = loadPassiveLog();
      const log = passiveLogRef.current;
      const now = new Date();
      if (now.getTime() - (log.get(itemKey) ?? 0) < 86400000) return;
      const next = new Map(cardsRef.current);
      const changed: ReviewCard[] = [];
      for (const kind of ["word", "char"] as ItemKind[]) {
        for (const facet of ["meaningRecognition", "soundRecognition"] as Facet[]) {
          const id = rowId(itemKey, kind, facet);
          const row = next.get(id);
          if (!row) continue;
          const newCard = applyCascadeCredit(row.card, PASSIVE_CAP_DAYS, now);
          const newRow: ReviewCard = {
            ...row,
            card: newCard,
            dueAt: new Date(newCard.due).getTime(),
            cascadeReviews: (row.cascadeReviews ?? 0) + 1,
          };
          next.set(id, newRow);
          changed.push(newRow);
        }
      }
      if (changed.length === 0) return;
      log.set(itemKey, now.getTime());
      persistPassiveLog(log);
      applyCards(next);
      remoteUpsert(changed);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, applyCards],
  );

  // Apply a grade to one card. On Good/Easy on the MEANING facet, also
  // walk the parent's component closure and apply a damped Good cascade
  // to every char and component reachable from it (per the cascade rule
  // in the rollout plan). The combined card grades meaning + sound in
  // the same tick — cascading on both would double the credit, so only
  // the meaning grade cascades. On Again, no cascade — the user can
  // attribute the failure to a specific child via attributeFailure().
  const grade = useCallback(
    (
      itemKey: string,
      rating: RatingName,
      kind: ItemKind = FIRST_KIND,
      facet: Facet = MEANING_FACET,
    ) => {
      const now = new Date();
      const parentId = rowId(itemKey, kind, facet);
      const prev = cardsRef.current;
      let parentRow = prev.get(parentId);
      if (!parentRow) {
        // The recognition card grades meaning AND sound (v105) — items
        // that historically only had a meaning row (cascade-seeded
        // chars) get the missing recognition sibling seeded on demand
        // instead of dropping the grade.
        if (facet !== "meaningRecognition" && facet !== "soundRecognition") return;
        const seeded = seedCard(now);
        parentRow = {
          itemKey,
          itemKind: kind,
          facet,
          card: seeded,
          dueAt: new Date(seeded.due).getTime(),
          lastReviewAt: null,
          directReviews: 0,
          cascadeReviews: 0,
        };
      }
      const next = new Map(prev);
      const changed: ReviewCard[] = [];

      // 1. Parent.
      const newParentCard = gradeCard(parentRow.card, rating, now);
      const newParent: ReviewCard = {
        ...parentRow,
        card: newParentCard,
        dueAt: new Date(newParentCard.due).getTime(),
        lastReviewAt: now.getTime(),
        directReviews: (parentRow.directReviews ?? 0) + 1,
      };
      next.set(parentId, newParent);
      changed.push(newParent);
      logReview(parentRow, rating);

      // 2. Cascade to component closure.
      const cascade =
        kind === FIRST_KIND && facet === MEANING_FACET && (rating === "Good" || rating === "Easy");
      if (cascade) {
        changed.push(...cascadeToClosure(itemKey, next, now));
      }

      applyCards(next);
      remoteUpsert(changed);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, chars, applyCards],
  );

  // Apply a real Again to a specific child of a parent that just failed.
  // Used by the "what threw you?" affordance after a parent Again grade.
  const attributeFailure = useCallback(
    (childKey: string) => {
      const now = new Date();
      const childKind: ItemKind = "char";
      const childId = rowId(childKey, childKind, MEANING_FACET);
      const prev = cardsRef.current;
      let childRow = prev.get(childId);
      if (!childRow) {
        const seeded = seedCard(now);
        childRow = {
          itemKey: childKey,
          itemKind: childKind,
          facet: MEANING_FACET,
          card: seeded,
          dueAt: new Date(seeded.due).getTime(),
          lastReviewAt: null,
          directReviews: 0,
          cascadeReviews: 0,
        };
      }
      const newCard = gradeCard(childRow.card, "Again", now);
      const newRow: ReviewCard = {
        ...childRow,
        card: newCard,
        dueAt: new Date(newCard.due).getTime(),
        lastReviewAt: now.getTime(),
        directReviews: (childRow.directReviews ?? 0) + 1,
      };
      const next = new Map(prev);
      next.set(childId, newRow);
      applyCards(next);
      logReview(childRow, "Again");
      remoteUpsert([newRow]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, applyCards],
  );

  return {
    cards,
    dueCards,
    grade,
    attributeFailure,
    recordInference,
    creditPassiveView,
    syncing,
  };
}

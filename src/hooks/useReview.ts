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
import type { Char } from "../lib/types";
import { componentClosure } from "../lib/componentSearch";

const FSRS_KEY = "chinese.fsrs.v1";
const CASCADE_CAP_DAYS = 7;

export type ItemKind = "word" | "char" | "component";
export type Facet =
  | "recognition"          // legacy (pre-v66); migrated to meaningRecognition on load
  | "meaningRecognition"
  | "soundRecognition"
  | "phoneticTap"
  | "componentSound"
  | "familyTransfer"
  | "production";

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
  // Subset of single-character saved items that are known phonetic
  // components (from public/phonetic-components.json). Members get an
  // extra componentSound card on top of the standard recognition one.
  phoneticComponentKeys?: Set<string>;
  // Full phonetic-components map keyed by char. Used by the
  // familyTransfer seeding rule (need to walk family[]).
  phoneticComponentsByChar?: Map<
    string,
    { char: string; pinyin: string; family: string[] }
  >;
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
    localStorage.setItem(
      FSRS_KEY,
      JSON.stringify({ version: 1, items: [...cards.values()] }),
    );
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
const SOUND_FACET: Facet = "soundRecognition" as Facet;

export function useReview({
  userId,
  scheduledKeys,
  chars,
  phoneticComponentKeys,
  phoneticComponentsByChar,
}: UseReviewOpts) {
  const [cards, setCards] = useState<Map<string, ReviewCard>>(() => loadLocalCards());
  const [syncing, setSyncing] = useState(false);
  const lastSyncedUserRef = useRef<string | null>(null);

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
  // unconditional. PhoneticTap is seeded for any character (saved as a word
  // OR appearing inside a saved word) that has at least one direct
  // component with role "sound" — that's the drill's correct answer.
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
    }
    for (const key of scheduledKeys) {
      for (const c of key) {
        const cd = chars[c];
        if (!cd?.components) continue;
        if (cd.components.some((x) => x?.type === "sound" && x.char)) {
          out.set(rowId(c, "char", "phoneticTap"), {
            itemKey: c,
            itemKind: "char",
            facet: "phoneticTap",
          });
        }
      }
    }
    // componentSound: any saved single-char item that's listed in the
    // productive phonetic-components data file. Only seeds if data has
    // loaded; if not, this just doesn't seed (no harm).
    if (phoneticComponentKeys && phoneticComponentKeys.size > 0) {
      for (const key of scheduledKeys) {
        if ([...key].length !== 1) continue;
        if (!phoneticComponentKeys.has(key)) continue;
        out.set(rowId(key, "component", "componentSound"), {
          itemKey: key,
          itemKind: "component",
          facet: "componentSound",
        });
      }
    }
    // familyTransfer: for each saved phonetic component, take up to two
    // family members the user hasn't saved yet and seed transfer cards
    // on them. Surfaces "you know 青, what's 情?" prompts. Cap is to
    // avoid drowning the queue when the user has saved many components.
    if (
      phoneticComponentsByChar &&
      phoneticComponentKeys &&
      phoneticComponentKeys.size > 0
    ) {
      const FAMILY_PER_COMPONENT = 2;
      for (const key of scheduledKeys) {
        if ([...key].length !== 1) continue;
        const comp = phoneticComponentsByChar.get(key);
        if (!comp || !comp.family || comp.family.length === 0) continue;
        let added = 0;
        for (const fam of comp.family) {
          if (added >= FAMILY_PER_COMPONENT) break;
          if (!fam || fam === comp.char) continue;
          if (scheduledKeys.has(fam)) continue; // user already has it
          out.set(rowId(fam, "char", "familyTransfer"), {
            itemKey: fam,
            itemKind: "char",
            facet: "familyTransfer",
          });
          added++;
        }
      }
    }
    return out;
  }, [scheduledKeys, chars, phoneticComponentKeys, phoneticComponentsByChar]);

  // Reconcile: ensure every expected card exists; drop any auto-seeded
  // facet card whose key is no longer expected. Cascaded char recognition
  // cards (kind=char, facet=recognition) are independent and survive —
  // they may still belong to other saved words via the cascade.
  useEffect(() => {
    setCards((prev) => {
      let changed = false;
      const next = new Map(prev);
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
      // Drop auto-seeded facet rows that aren't expected anymore.
      // Cascade-seeded char/recognition cards are independent and survive.
      for (const [id, row] of next) {
        const isAutoFacet =
          (row.itemKind === "word" &&
            (row.facet === "meaningRecognition" ||
              row.facet === "soundRecognition")) ||
          (row.itemKind === "char" &&
            (row.facet === "phoneticTap" || row.facet === "familyTransfer")) ||
          (row.itemKind === "component" && row.facet === "componentSound");
        if (isAutoFacet && !expectedCards.has(id)) {
          next.delete(id);
          changed = true;
        }
      }
      if (!changed) return prev;
      persistLocalCards(next);
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
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expectedCards, userId]);

  // Initial sync when a user signs in.
  useEffect(() => {
    if (!userId) {
      lastSyncedUserRef.current = null;
      return;
    }
    if (lastSyncedUserRef.current === userId) return;
    lastSyncedUserRef.current = userId;

    let cancelled = false;
    setSyncing(true);
    (async () => {
      const { data, error } = await supabase
        .from("user_fsrs_state")
        .select("item_key, item_kind, facet, card, due_at, last_review_at")
        .eq("user_id", userId);
      if (cancelled) return;
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
        // Migrate legacy "recognition" rows from the DB into the new
        // "meaningRecognition" facet on the way in (one-time, in-memory).
        const facet =
          r.facet === "recognition"
            ? ("meaningRecognition" as Facet)
            : (r.facet as Facet);
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
      setCards((prev) => {
        // Remote wins on conflict (multi-device honesty); local-only rows
        // get uploaded below.
        const merged = new Map(prev);
        for (const [id, row] of remote) merged.set(id, row);
        persistLocalCards(merged);
        return merged;
      });
      // Upload any local rows the remote didn't have.
      const toUpload: ReviewCard[] = [];
      for (const [id, row] of cards) {
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
        if (upErr) console.error("fsrs upload failed:", upErr);
      }
      if (!cancelled) setSyncing(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Due cards. Char + component cards before word cards (the brief: review
  // sub-items in isolation occasionally), then oldest-due first.
  const dueCards = useMemo<ReviewCard[]>(() => {
    const now = new Date();
    return [...cards.values()]
      .filter((row) => isDue(row.card, now))
      .sort((a, b) => {
        const ka = a.itemKind === "word" ? 1 : 0;
        const kb = b.itemKind === "word" ? 1 : 0;
        if (ka !== kb) return ka - kb;
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

  // Apply a grade to one card. On Good/Easy, also walk the parent's
  // component closure and apply a damped Good cascade to every char and
  // component reachable from it (per the cascade rule in the rollout
  // plan). On Again, no cascade — the user can attribute the failure to
  // a specific child via attributeFailure().
  const grade = useCallback(
    (itemKey: string, rating: RatingName, kind: ItemKind = FIRST_KIND, facet: Facet = MEANING_FACET) => {
      const now = new Date();
      const parentId = rowId(itemKey, kind, facet);
      const parentRow = cards.get(parentId);
      if (!parentRow) return;

      const next = new Map(cards);
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

      // 2. Cascade to component closure (only for word kinds + Good/Easy).
      const cascade =
        kind === FIRST_KIND && (rating === "Good" || rating === "Easy");
      if (cascade) {
        const closure = componentClosure(itemKey, chars);
        closure.delete(itemKey); // don't double-credit the parent itself
        for (const childKey of closure) {
          // PR 3 simplification: every cascaded sub-item is kind="char".
          // The graph data already distinguishes char vs component; in the
          // schedule we treat them uniformly until PR 4 introduces the
          // facet split.
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
      }

      persistLocalCards(next);
      setCards(next);
      remoteUpsert(changed);
    },
    [userId, cards, chars],
  );

  // Apply a real Again to a specific child of a parent that just failed.
  // Used by the "what threw you?" affordance after a parent Again grade.
  const attributeFailure = useCallback(
    (childKey: string) => {
      const now = new Date();
      const childKind: ItemKind = "char";
      const childId = rowId(childKey, childKind, MEANING_FACET);
      let childRow = cards.get(childId);
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
      const updated: ReviewCard = {
        ...childRow,
        card: newCard,
        dueAt: new Date(newCard.due).getTime(),
        lastReviewAt: now.getTime(),
        directReviews: (childRow.directReviews ?? 0) + 1,
      };
      const next = new Map(cards);
      next.set(childId, updated);
      persistLocalCards(next);
      setCards(next);
      remoteUpsert([updated]);
    },
    [userId, cards],
  );

  return {
    cards,
    dueCards,
    grade,
    attributeFailure,
    syncing,
  };
}

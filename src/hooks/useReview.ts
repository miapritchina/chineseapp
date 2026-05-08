import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { gradeCard, isDue, seedCard, type RatingName, type SerializedCard } from "../lib/fsrs";

const FSRS_KEY = "chinese.fsrs.v1";

export type ItemKind = "word" | "char" | "component";
export type Facet =
  | "recognition"
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
}

// Local key for the (item_key, item_kind, facet) tuple.
function rowId(itemKey: string, itemKind: ItemKind, facet: Facet): string {
  return `${itemKind}|${facet}|${itemKey}`;
}

interface UseReviewOpts {
  userId: string | null;
  // The set of words the user has marked needToLearn or learned —
  // these get cards. Anything that drops out of this set has its card
  // removed.
  scheduledKeys: Set<string>;
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

// First PR scope: only ('word', 'recognition'). Other kinds + facets
// are introduced in later PRs.
const FIRST_FACET: Facet = "recognition";
const FIRST_KIND: ItemKind = "word";

export function useReview({ userId, scheduledKeys }: UseReviewOpts) {
  const [cards, setCards] = useState<Map<string, ReviewCard>>(() => loadLocalCards());
  const [syncing, setSyncing] = useState(false);
  const lastSyncedUserRef = useRef<string | null>(null);

  // Reconcile: every word in scheduledKeys should have a recognition card;
  // anything we have a card for that isn't in scheduledKeys gets dropped.
  // Runs locally on every change; remote sync only on user switch.
  useEffect(() => {
    setCards((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const key of scheduledKeys) {
        const id = rowId(key, FIRST_KIND, FIRST_FACET);
        if (!next.has(id)) {
          const seeded = seedCard();
          next.set(id, {
            itemKey: key,
            itemKind: FIRST_KIND,
            facet: FIRST_FACET,
            card: seeded,
            dueAt: new Date(seeded.due).getTime(),
            lastReviewAt: null,
          });
          changed = true;
        }
      }
      // Drop cards for items no longer in scheduledKeys (only the first-PR
      // facet — others are managed elsewhere when those PRs land).
      for (const [id, row] of next) {
        if (
          row.itemKind === FIRST_KIND &&
          row.facet === FIRST_FACET &&
          !scheduledKeys.has(row.itemKey)
        ) {
          next.delete(id);
          changed = true;
        }
      }
      if (!changed) return prev;
      persistLocalCards(next);
      // Best-effort remote mirroring of just-changed rows.
      if (userId) {
        const upserts = [];
        for (const key of scheduledKeys) {
          const id = rowId(key, FIRST_KIND, FIRST_FACET);
          const row = next.get(id);
          if (row) {
            upserts.push({
              user_id: userId,
              item_key: row.itemKey,
              item_kind: row.itemKind,
              facet: row.facet,
              card: row.card,
              due_at: new Date(row.dueAt).toISOString(),
              last_review_at: row.lastReviewAt ? new Date(row.lastReviewAt).toISOString() : null,
            });
          }
        }
        if (upserts.length > 0) {
          void supabase
            .from("user_fsrs_state")
            .upsert(upserts, { onConflict: "user_id,item_key,item_kind,facet" })
            .then(({ error }) => {
              if (error && !/relation .*user_fsrs_state.*does not exist/i.test(error.message || "")) {
                console.warn("fsrs upsert (seed) failed:", error);
              }
            });
        }
      }
      return next;
    });
  }, [scheduledKeys, userId]);

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
        const row: ReviewCard = {
          itemKey: r.item_key,
          itemKind: r.item_kind as ItemKind,
          facet: r.facet as Facet,
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

  // Due cards, oldest-due first. Re-evaluated when cards change.
  const dueCards = useMemo<ReviewCard[]>(() => {
    const now = new Date();
    return [...cards.values()]
      .filter((row) => isDue(row.card, now))
      .sort((a, b) => a.dueAt - b.dueAt);
  }, [cards]);

  // Apply a grade to one card and persist.
  const grade = useCallback(
    (itemKey: string, rating: RatingName, kind: ItemKind = FIRST_KIND, facet: Facet = FIRST_FACET) => {
      const id = rowId(itemKey, kind, facet);
      const now = new Date();
      let updated: ReviewCard | null = null;
      setCards((prev) => {
        const row = prev.get(id);
        if (!row) return prev;
        const nextCard = gradeCard(row.card, rating, now);
        updated = {
          ...row,
          card: nextCard,
          dueAt: new Date(nextCard.due).getTime(),
          lastReviewAt: now.getTime(),
        };
        const next = new Map(prev);
        next.set(id, updated);
        persistLocalCards(next);
        return next;
      });
      if (userId && updated) {
        const u: ReviewCard = updated;
        void supabase
          .from("user_fsrs_state")
          .upsert(
            {
              user_id: userId,
              item_key: u.itemKey,
              item_kind: u.itemKind,
              facet: u.facet,
              card: u.card,
              due_at: new Date(u.dueAt).toISOString(),
              last_review_at: u.lastReviewAt ? new Date(u.lastReviewAt).toISOString() : null,
            },
            { onConflict: "user_id,item_key,item_kind,facet" },
          )
          .then(({ error }) => {
            if (error && !/relation .*user_fsrs_state.*does not exist/i.test(error.message || "")) {
              console.error("fsrs grade upsert failed:", error);
            }
          });
      }
    },
    [userId],
  );

  return {
    cards,
    dueCards,
    grade,
    syncing,
  };
}

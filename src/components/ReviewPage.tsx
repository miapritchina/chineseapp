import { useCallback, useEffect, useRef, useState } from "react";
import type { ReviewCard } from "../hooks/useReview";
import { useCharsCtx, useDictCtx, useSavedCtx } from "../state/contexts";
import { PageHeader } from "./ui/PageHeader";
import { EmptyState } from "./ui/EmptyState";
import { DrillShell } from "./ui/DrillShell";
import type { Facet, ItemKind } from "../hooks/useReview";
import type { RatingName } from "../lib/fsrs";
import { CombinedRecognitionCard } from "./CombinedRecognitionCard";
import { ClusterRecallCard } from "./ClusterRecallCard";
import { ProductionCard } from "./ProductionCard";
import { DisambiguationCard } from "./DisambiguationCard";
import { WordInferenceCard } from "./WordInferenceCard";
import { ReverseRecognitionCard } from "./ReverseRecognitionCard";
import { ClozeCharCard } from "./ClozeCharCard";
import { FamilySweepCard } from "./FamilySweepCard";
import { clusterFor, LEECH_LAPSES } from "../lib/confusionClusters";
import { interleaveByActivity } from "../lib/drillGen";
import type { PhoneticComponent } from "../hooks/usePhoneticComponents";
import type { Word } from "../lib/types";

// Placeholder FSRS state for the synthetic (non-FSRS) inference and
// cluster rows.
const INFERENCE_CARD = {
  due: new Date(0).toISOString(),
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 0,
  lapses: 0,
  state: 0,
};

interface Props {
  dueCards: ReviewCard[];
  // Full card map. Used to force-surface cluster members on leech via
  // the active-interleaving rule.
  cards?: Map<string, ReviewCard>;
  onGrade: (itemKey: string, rating: RatingName, kind?: ItemKind, facet?: Facet) => void;
  onAttributeFailure?: (childKey: string) => void;
  onClose: () => void;
  // Open the EntitySheet for a tapped character/word (v110 — every
  // glyph in a drill is explorable once the card is answered).
  onOpenEntity?: (key: string) => void;
  // Drill 1: pool of unsaved words made of known chars. Both outcomes
  // report up — correct cascades credit, and either way the word is
  // marked done so it stays out of the pool across sessions.
  inferenceWords?: Word[];
  onInferenceResult?: (word: string, gotIt: boolean) => void;
  // Cluster recall (v107): pre-built clusters of related saved words;
  // each becomes one synthetic card in the queue.
  clusters?: string[][];
  phoneticComponents?: PhoneticComponent[];
  phoneticComponentsByChar?: Map<string, PhoneticComponent>;
  // From the launch screen. If absent, all facets are enabled.
  enabledFacets?: Set<Facet>;
  randomOrder?: boolean;
  includeSubchars?: boolean;
  // Cards per session, owner-chosen on the launch screen (v110;
  // null/undefined = everything due). UI-side only: grading is
  // per-card, so scheduling is untouched.
  sessionSize?: number | null;
}

// Stable id for a card across the (kind, facet, key) tuple. Used to mark
// cards as "skip me for the rest of this session" without mutating the
// underlying SRS state.
function rid(c: ReviewCard) {
  return `${c.itemKind}|${c.facet}|${c.itemKey}`;
}

// Recognition / drill / production surface. Drains the queue
// in dueCards[0] order; the just-graded card drops out naturally via
// useReview's dueCards memo (its due_at moves into the future). Per-
// session state — disambig-shown set, manual-skip set — is local.
export function ReviewPage({
  dueCards,
  cards,
  onGrade,
  onAttributeFailure,
  onClose,
  onOpenEntity,
  inferenceWords,
  onInferenceResult,
  clusters,
  phoneticComponents,
  phoneticComponentsByChar,
  enabledFacets,
  randomOrder,
  includeSubchars,
  sessionSize,
}: Props) {
  const { chars } = useCharsCtx();
  const { findWord, ensureCached } = useDictCtx();
  const { saved: savedKeys, savedList } = useSavedCtx();
  const [revealed, setRevealed] = useState(false);
  const [attribTarget, setAttribTarget] = useState<string | null>(null);
  // Cards the user has explicitly skipped this session; filtered out of
  // the visible queue so they don't keep surfacing.
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  // Disambig already shown this session (one-shot per key).
  const [disambigSeen, setDisambigSeen] = useState<Set<string>>(() => new Set());
  // Cluster members forced into the queue this session by an active
  // leech interleave. The brief calls for cluster members to surface
  // back-to-back when one of them lapses past LEECH_LAPSES.
  const [promotedCluster, setPromotedCluster] = useState<Set<string>>(() => new Set());

  // Visible queue = dueCards minus this-session skips, filtered by the
  // launch settings.
  const filtered = dueCards.filter((c) => {
    if (skipped.has(rid(c))) return false;
    if (enabledFacets && !enabledFacets.has(c.facet)) {
      // Legacy "recognition" rows count as meaningRecognition for
      // filtering purposes too.
      if (!(c.facet === "recognition" && enabledFacets.has("meaningRecognition"))) {
        return false;
      }
    }
    // Cascade-seeded sub-character cards (kind=char with a recognition
    // facet, NOT in the user's saved set) are off by default — the user
    // can opt in via the launch screen.
    if (!includeSubchars) {
      const isCascadeRecognition =
        c.itemKind === "char" &&
        (c.facet === "meaningRecognition" ||
          c.facet === "soundRecognition" ||
          c.facet === "recognition");
      if (isCascadeRecognition && !(savedKeys && savedKeys.has(c.itemKey))) {
        return false;
      }
    }
    return true;
  });

  // Recognition-pair dedup: meaningRecognition and soundRecognition for
  // the same item are graded together in the combined card, so the
  // queue should only surface ONE entry per (itemKind, itemKey) for
  // these facets. Prefer meaningRecognition when both are due.
  // Linear: pre-compute which (kind, key) pairs have a meaning row, then
  // walk the queue once with O(1) skip lookups.
  const isRecogFacet = (f: Facet) =>
    f === "meaningRecognition" || f === "soundRecognition" || f === "recognition";
  const meaningKeys = new Set<string>();
  for (const c of filtered) {
    if (c.facet === "meaningRecognition" || c.facet === "recognition") {
      meaningKeys.add(`${c.itemKind}|${c.itemKey}`);
    }
  }
  const seenRecogKey = new Set<string>();
  const dedupedFiltered: ReviewCard[] = [];
  for (const c of filtered) {
    if (isRecogFacet(c.facet)) {
      const k = `${c.itemKind}|${c.itemKey}`;
      if (seenRecogKey.has(k)) continue;
      // Sound entries are dropped only when their meaning sibling is
      // also in the queue — otherwise sound IS the canonical row.
      if (c.facet === "soundRecognition" && meaningKeys.has(k)) continue;
      seenRecogKey.add(k);
      dedupedFiltered.push(c);
      continue;
    }
    dedupedFiltered.push(c);
  }

  // Active interleave: pull cluster members into the visible queue even
  // if they're not currently due. They surface alongside (right after)
  // the leech card so the user contrasts them in one session.
  const promotedRows: ReviewCard[] = [];
  if (cards && promotedCluster.size > 0) {
    const seen = new Set(dedupedFiltered.map(rid));
    for (const row of cards.values()) {
      if (!promotedCluster.has(row.itemKey)) continue;
      if (seen.has(rid(row))) continue;
      // Only word-level recognition cards make sense for cluster
      // contrast — drill facets are about a single-char skill, not
      // the disambig point.
      if (
        row.facet !== "meaningRecognition" &&
        row.facet !== "soundRecognition" &&
        row.facet !== "recognition"
      ) {
        continue;
      }
      promotedRows.push(row);
      seen.add(rid(row));
    }
  }
  // Drill-1 inference words: synthetic rows appended at the end of the
  // queue (they have no FSRS state; grading routes to onInferenceResult
  // instead of onGrade).
  const inferenceRows: ReviewCard[] = [];
  if ((!enabledFacets || enabledFacets.has("wordInference")) && inferenceWords) {
    for (const w of inferenceWords) {
      const row: ReviewCard = {
        itemKey: w.word,
        itemKind: "word",
        facet: "wordInference",
        card: INFERENCE_CARD,
        dueAt: 0,
        lastReviewAt: null,
      };
      if (!skipped.has(rid(row))) inferenceRows.push(row);
    }
  }
  // Cluster recall (v107): one synthetic row per cluster of related
  // saved words. Grading applies to every member's recognition rows.
  const clusterRows: ReviewCard[] = [];
  if ((!enabledFacets || enabledFacets.has("clusterRecall")) && clusters) {
    for (const cluster of clusters) {
      const row: ReviewCard = {
        itemKey: cluster.join("+"),
        itemKind: "word",
        facet: "clusterRecall",
        card: INFERENCE_CARD,
        dueAt: 0,
        lastReviewAt: null,
      };
      if (!skipped.has(rid(row))) clusterRows.push(row);
    }
  }

  // Promoted cards prepend the queue (right after the current leech card).
  // Mix activity types by default (v106): round-robin across drill
  // groups, most-overdue first within each — NOT a shuffle. The
  // Shuffle toggle still randomizes fully via the position map below.
  const mixed = randomOrder
    ? [...dedupedFiltered, ...inferenceRows, ...clusterRows]
    : interleaveByActivity([...dedupedFiltered, ...inferenceRows, ...clusterRows]);

  // Freeze the session to the first `sessionSize` cards seen (v107;
  // owner-chosen since v110, null = no cap). Cards that leave the set
  // (graded/skipped) are done; nothing refills behind them, so the
  // session actually ends. Retries stay eligible.
  const sessionRidsRef = useRef<Set<string> | null>(null);
  if (sessionSize != null && sessionRidsRef.current === null && mixed.length > 0) {
    sessionRidsRef.current = new Set(mixed.slice(0, sessionSize).map(rid));
  }
  const sessionRows = sessionRidsRef.current
    ? mixed.filter((r) => sessionRidsRef.current!.has(rid(r)))
    : mixed;
  const combined = [...promotedRows, ...sessionRows];

  // Per-card session position. Assigned once on first sighting so the
  // queue head doesn't jump on every re-render. New cards (cascade
  // surfacing mid-session) slot in at the end.
  const positionRef = useRef<Map<string, number>>(new Map());
  for (const c of combined) {
    const id = rid(c);
    if (!positionRef.current.has(id)) {
      positionRef.current.set(id, randomOrder ? Math.random() : positionRef.current.size);
    }
  }
  const queue = combined
    .slice()
    .sort(
      (a, b) => (positionRef.current.get(rid(a)) ?? 0) - (positionRef.current.get(rid(b)) ?? 0),
    );
  const current = queue[0];

  // Session progress display: capture the queue size on first render.
  const initialTotalRef = useRef(queue.length);
  // Keep the displayed total honest if cascade pushes new cards in
  // mid-session.
  const [doneCount, setDoneCount] = useState(0);
  if (queue.length + doneCount > initialTotalRef.current) {
    initialTotalRef.current = queue.length + doneCount;
  }
  const total = initialTotalRef.current;

  // Reset per-card UI state whenever the head of the queue changes.
  const headKey = current ? rid(current) : null;
  const lastHeadRef = useRef<string | null>(null);
  if (lastHeadRef.current !== headKey) {
    lastHeadRef.current = headKey;
    // setState during render is OK here — these are state resets aligned
    // with the rendered identity, not loops.
    if (revealed) setRevealed(false);
    if (attribTarget) setAttribTarget(null);
  }

  // Hydrate the next few words in the background so reveal is instant.
  useEffect(() => {
    if (!current) return;
    const window = queue.slice(0, 5).map((c) => c.itemKey);
    void ensureCached(window);
  }, [current?.itemKey, ensureCached, queue]);

  // Warm stroke data for upcoming Writing cards — HanziWriter fetches
  // per-char JSON from the CDN when the card mounts, a visible
  // multi-second wait on a phone (BUG-15). Prefetching lands it in the
  // service-worker/HTTP cache so the quiz paints instantly.
  const strokeWarmedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!current) return;
    for (const c of queue.slice(0, 8)) {
      if (c.facet !== "production" || strokeWarmedRef.current.has(c.itemKey)) continue;
      strokeWarmedRef.current.add(c.itemKey);
      try {
        void Promise.resolve(window.HanziWriter?.loadCharacterData?.(c.itemKey)).catch(() => {});
      } catch {
        /* no HanziWriter global — the card falls back on its own */
      }
    }
  }, [current?.itemKey, queue]);

  const advanceWithoutGrading = useCallback((c: ReviewCard) => {
    setSkipped((prev) => {
      const k = rid(c);
      if (prev.has(k)) return prev;
      const n = new Set(prev);
      n.add(k);
      // The combined card fronts BOTH recognition rows — skip the
      // sibling facet too, or it surfaces as its own card once the
      // meaning row leaves the queue.
      if (c.facet === "meaningRecognition" || c.facet === "recognition") {
        n.add(rid({ ...c, facet: "soundRecognition" as Facet }));
      } else if (c.facet === "soundRecognition") {
        n.add(rid({ ...c, facet: "meaningRecognition" as Facet }));
      }
      return n;
    });
    setDoneCount((n) => n + 1);
  }, []);

  // Used after a real grade. Don't add to skipped — useReview's dueCards
  // re-derive will drop the graded card naturally; the queue head moves
  // to the next item.
  const onGradedAdvance = useCallback(() => {
    setDoneCount((n) => n + 1);
    setRevealed(false);
    setAttribTarget(null);
  }, []);

  // Stable per-render handler for the recognition reveal-card grade
  // buttons. Captures the current card's identity at click time, so a
  // (handleRecognitionGrade lived here pre-v71; replaced by the inline
  // CombinedRecognitionCard's dual-row grading in the default branch.)

  const handleAttribute = useCallback(
    (childKey: string) => {
      onAttributeFailure?.(childKey);
      onGradedAdvance();
    },
    [onAttributeFailure, onGradedAdvance],
  );

  // Again → the card re-enters the session queue at the end (fresh
  // position); any other grade clears its pending retry.
  // No same-day retry (v112, ADR-0014): a wrong answer reschedules
  // via FSRS — with enable_short_term disabled, Again lands exactly
  // 24h out, so the card returns tomorrow, not later this session.
  const cardKey = (c: ReviewCard) => rid(c);

  // Guard against fast double-taps re-grading the same attempt (the
  // drill stays mounted until the next render).
  const lastGradedRef = useRef<string | null>(null);
  const handleDrillGrade = useCallback(
    (rating: RatingName) => {
      if (!current) return;
      const k = cardKey(current);
      if (lastGradedRef.current === k) return;
      lastGradedRef.current = k;
      const cur = current;
      onGrade(cur.itemKey, rating, cur.itemKind, cur.facet);
      onGradedAdvance();
    },
    [current, onGrade, onGradedAdvance],
  );

  const handleSkipCurrent = useCallback(() => {
    if (current) advanceWithoutGrading(current);
  }, [current, advanceWithoutGrading]);

  if (!current) {
    return (
      <div className="review-root">
        <PageHeader onBack={onClose} progress="" />
        <EmptyState
          variant="review"
          title="All caught up."
          hint="Save a new word to add it to the review queue."
        />
      </div>
    );
  }

  const word = current.itemKind === "word" ? findWord(current.itemKey) : null;
  const charData = chars?.[current.itemKey];
  const progressIndex = total - queue.length + 1;

  // Leech-cluster disambiguation. One-shot per key per session.
  const isSingleChar = [...current.itemKey].length === 1;
  const cluster = isSingleChar ? clusterFor(current.itemKey) : null;
  if (cluster && (current.card.lapses ?? 0) >= LEECH_LAPSES && !disambigSeen.has(current.itemKey)) {
    return (
      <div className="review-root">
        <PageHeader
          onBack={onClose}
          tag="Confusable"
          progress={`${progressIndex} / ${total}`}
          onSkip={handleSkipCurrent}
        />
        <ReviewProgressBar index={progressIndex} total={total} />
        <div className="review-body">
          <DisambiguationCard
            focus={current.itemKey}
            neighbors={cluster.filter((c) => c !== current.itemKey)}
            onContinue={() => {
              const k = current.itemKey;
              setDisambigSeen((prev) => {
                if (prev.has(k)) return prev;
                const n = new Set(prev);
                n.add(k);
                return n;
              });
              // Active interleave: promote every other cluster member
              // into the visible queue so the user sees them
              // back-to-back this session.
              setPromotedCluster((prev) => {
                const n = new Set(prev);
                for (const m of cluster) if (m !== k) n.add(m);
                return n;
              });
            }}
            onOpenEntity={onOpenEntity}
          />
        </div>
      </div>
    );
  }

  const glossOf = (key: string) => {
    const w = findWord(key);
    const cd = chars?.[key];
    return w
      ? (w.definitions || []).slice(0, 3).join("; ")
      : (cd?.definitions || []).slice(0, 3).join("; ");
  };
  const savedWords = savedList.map((s) => s.word);

  // Drill 1 — new-word inference (session-only synthetic row).
  if (current.facet === "wordInference") {
    return (
      <DrillShell
        tag="New word"
        onClose={onClose}
        progressIndex={progressIndex}
        total={total}
        onSkip={handleSkipCurrent}
      >
        {!word ? (
          <div className="review-empty-hint">Loading word…</div>
        ) : (
          <WordInferenceCard
            key={cardKey(current)}
            word={word}
            glossPool={[
              ...(inferenceWords ?? [])
                .filter((w) => w.word !== current.itemKey)
                .map((w) => (w.definitions || []).slice(0, 2).join("; ")),
              ...savedWords.map((w) => findWord(w)?.definitions?.[0] ?? ""),
            ].filter(Boolean)}
            onGotIt={() => {
              onInferenceResult?.(current.itemKey, true);
              advanceWithoutGrading(current);
            }}
            onMissed={() => {
              onInferenceResult?.(current.itemKey, false);
              advanceWithoutGrading(current);
            }}
            onOpenEntity={onOpenEntity}
          />
        )}
      </DrillShell>
    );
  }

  // Drill 2 — reverse recognition: gloss → pick the hanzi.
  if (current.facet === "reverseRecognition") {
    return (
      <DrillShell
        tag="Reverse"
        onClose={onClose}
        progressIndex={progressIndex}
        total={total}
        onSkip={handleSkipCurrent}
      >
        <ReverseRecognitionCard
          key={cardKey(current)}
          answer={current.itemKey}
          gloss={glossOf(current.itemKey)}
          savedWords={savedWords}
          onGrade={handleDrillGrade}
          onOpenEntity={onOpenEntity}
        />
      </DrillShell>
    );
  }

  // Drill 3 — masked-char cloze.
  if (current.facet === "clozeChar") {
    return (
      <DrillShell
        tag="Cloze"
        onClose={onClose}
        progressIndex={progressIndex}
        total={total}
        onSkip={handleSkipCurrent}
      >
        <ClozeCharCard
          key={cardKey(current)}
          word={current.itemKey}
          gloss={glossOf(current.itemKey)}
          savedWords={savedWords}
          onGrade={handleDrillGrade}
          onOpenEntity={onOpenEntity}
        />
      </DrillShell>
    );
  }

  // Drill 4 — family sweep: tap all family members of the component.
  if (current.facet === "familySweep") {
    const comp = phoneticComponentsByChar?.get(current.itemKey);
    return (
      <DrillShell
        tag="Family sweep"
        onClose={onClose}
        progressIndex={progressIndex}
        total={total}
        onSkip={handleSkipCurrent}
      >
        {!comp || !phoneticComponents ? (
          <div className="review-empty-hint">Loading family data…</div>
        ) : (
          <FamilySweepCard
            key={cardKey(current)}
            component={comp}
            pool={phoneticComponents}
            charExists={(c) => !!chars?.[c]}
            onGrade={handleDrillGrade}
            onOpenEntity={onOpenEntity}
          />
        )}
      </DrillShell>
    );
  }

  // Production drill (✒ Wrote tier): trace the char via Hanzi Writer.
  if (current.facet === "production") {
    const cd = chars?.[current.itemKey];
    if (!cd) {
      return (
        <DrillShell
          tag="Write"
          onClose={onClose}
          progressIndex={progressIndex}
          total={total}
          onSkip={handleSkipCurrent}
        >
          <div className="review-empty-hint">Loading character data…</div>
        </DrillShell>
      );
    }
    return (
      <div className="review-root">
        <PageHeader
          onBack={onClose}
          tag="Write"
          progress={`${progressIndex} / ${total}`}
          onSkip={handleSkipCurrent}
        />
        <ReviewProgressBar index={progressIndex} total={total} />
        <div className="review-body">
          <ProductionCard
            key={cardKey(current)}
            char={current.itemKey}
            charData={cd}
            onGrade={handleDrillGrade}
            onOpenEntity={onOpenEntity}
          />
        </div>
      </div>
    );
  }

  // Cluster recall (v107): one synthetic card per group of related
  // saved words; one grade applies to every member's recognition rows.
  if (current.facet === "clusterRecall") {
    const clusterWords = current.itemKey.split("+");
    return (
      <DrillShell
        tag="Cluster"
        onClose={onClose}
        progressIndex={progressIndex}
        total={total}
        onSkip={handleSkipCurrent}
      >
        <ClusterRecallCard
          key={cardKey(current)}
          cluster={clusterWords}
          onGraded={(rating) => {
            for (const w of clusterWords) {
              onGrade(w, rating, "word", "meaningRecognition");
              onGrade(w, rating, "word", "soundRecognition");
            }
            advanceWithoutGrading(current);
          }}
          onOpenEntity={onOpenEntity}
        />
      </DrillShell>
    );
  }

  // Default = recognition card. ONE card, TWO answers (v105): meaning
  // and sound are graded separately on the same reveal, each applied
  // to its own FSRS row. Again on either dimension reschedules to
  // tomorrow (no same-day retry, ADR-0014).
  const handleCombinedGraded = (meaning: RatingName, sound: RatingName) => {
    onGrade(current.itemKey, meaning, current.itemKind, "meaningRecognition");
    onGrade(current.itemKey, sound, current.itemKind, "soundRecognition");
    const worst: RatingName = meaning === "Again" || sound === "Again" ? "Again" : meaning;
    if (
      worst === "Again" &&
      current.itemKind === "word" &&
      [...current.itemKey].length > 1 &&
      onAttributeFailure
    ) {
      // v57's "what threw you?" affordance for word Again grades.
      setAttribTarget(current.itemKey);
      return;
    }
    onGradedAdvance();
  };

  return (
    <div className="review-root">
      <PageHeader
        onBack={onClose}
        tag={current.itemKind === "word" ? "Word" : "Character"}
        progress={`${progressIndex} / ${total}`}
        onSkip={handleSkipCurrent}
      />
      <ReviewProgressBar index={progressIndex} total={total} />
      <div className="review-body">
        {attribTarget ? (
          <div className="review-attrib">
            <div className="review-attrib-title">What threw you?</div>
            <div className="review-attrib-row">
              {[...attribTarget].map((c) => (
                <button
                  key={c}
                  type="button"
                  className="review-attrib-pick"
                  onClick={() => handleAttribute(c)}
                >
                  {c}
                </button>
              ))}
              <button type="button" className="review-attrib-skip" onClick={onGradedAdvance}>
                Skip
              </button>
            </div>
          </div>
        ) : (
          <CombinedRecognitionCard
            key={cardKey(current)}
            itemKey={current.itemKey}
            itemKind={current.itemKind}
            word={word}
            charData={charData}
            onGraded={handleCombinedGraded}
            onOpenEntity={onOpenEntity}
          />
        )}
      </div>
    </div>
  );
}

// Thin fill under the review header — grows left-to-right as cards are
// completed (4F). `index` is the 1-based position of the current card.
function ReviewProgressBar({ index, total }: { index: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, ((index - 1) / total) * 100)) : 0;
  return (
    <div
      className="review-progress-bar"
      role="progressbar"
      aria-valuenow={Math.max(0, index - 1)}
      aria-valuemin={0}
      aria-valuemax={total}
    >
      <div className="review-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

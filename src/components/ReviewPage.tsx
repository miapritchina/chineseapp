import { useCallback, useEffect, useRef, useState } from "react";
import type { Word, Char } from "../lib/types";
import type { ReviewCard } from "../hooks/useReview";
import type { Facet, ItemKind } from "../hooks/useReview";
import type { RatingName } from "../lib/fsrs";
import { CombinedRecognitionCard } from "./CombinedRecognitionCard";
import { PhoneticTapCard } from "./PhoneticTapCard";
import { ComponentSoundCard } from "./ComponentSoundCard";
import { FamilyTransferCard } from "./FamilyTransferCard";
import { ProductionCard } from "./ProductionCard";
import { DisambiguationCard } from "./DisambiguationCard";
import { clusterFor, LEECH_LAPSES } from "../lib/confusionClusters";
import type { PhoneticComponent } from "../hooks/usePhoneticComponents";

interface Props {
  dueCards: ReviewCard[];
  // Full card map. Used to force-surface cluster members on leech via
  // the active-interleaving rule: a card whose itemKey is in
  // promotedCluster gets pulled into the queue even if its dueAt is
  // still in the future.
  cards?: Map<string, ReviewCard>;
  findWord: (key: string) => Word | null;
  ensureCached: (keys: string[]) => Promise<void>;
  onGrade: (
    itemKey: string,
    rating: RatingName,
    kind?: ItemKind,
    facet?: Facet,
  ) => void;
  onAttributeFailure?: (childKey: string) => void;
  onClose: () => void;
  chars?: Record<string, Char>;
  phoneticComponents?: PhoneticComponent[];
  phoneticComponentsByChar?: Map<string, PhoneticComponent>;
  // From the launch screen. If absent, all facets are enabled and
  // ordering is the default (sub-items before words, oldest-due first).
  enabledFacets?: Set<Facet>;
  randomOrder?: boolean;
  includeSubchars?: boolean;
  savedKeys?: Set<string>;
}

// Stable id for a card across the (kind, facet, key) tuple. Used to mark
// cards as "skip me for the rest of this session" without mutating the
// underlying SRS state.
function rid(c: ReviewCard) {
  return `${c.itemKind}|${c.facet}|${c.itemKey}`;
}

// Recognition / Phonetic-tap / Component-sound surface. Drains the queue
// in dueCards[0] order; the just-graded card drops out naturally via
// useReview's dueCards memo (its due_at moves into the future). Per-
// session state — disambig-shown set, manual-skip set — is local.
export function ReviewPage({
  dueCards,
  cards,
  findWord,
  ensureCached,
  onGrade,
  onAttributeFailure,
  onClose,
  chars,
  phoneticComponents,
  phoneticComponentsByChar,
  enabledFacets,
  randomOrder,
  includeSubchars,
  savedKeys,
}: Props) {
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
  const [promotedCluster, setPromotedCluster] = useState<Set<string>>(
    () => new Set(),
  );

  // Visible queue = dueCards minus this-session skips, filtered by the
  // launch settings.
  const filtered = dueCards.filter((c) => {
    if (skipped.has(rid(c))) return false;
    if (enabledFacets && !enabledFacets.has(c.facet)) {
      // Legacy "recognition" rows count as meaningRecognition for
      // filtering purposes too.
      if (
        !(c.facet === "recognition" && enabledFacets.has("meaningRecognition"))
      ) {
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
  const isRecogFacet = (f: Facet) =>
    f === "meaningRecognition" || f === "soundRecognition" || f === "recognition";
  const seenRecogKey = new Set<string>();
  const dedupedFiltered: ReviewCard[] = [];
  // Two-pass: first keep meaningRecognition if present, then keep sound
  // for keys not yet covered, then everything else.
  for (const c of filtered) {
    if (isRecogFacet(c.facet)) {
      const k = `${c.itemKind}|${c.itemKey}`;
      if (seenRecogKey.has(k)) continue;
      // Skip soundRecognition if the meaningRecognition for the same
      // key is still ahead of us in the queue (since we want meaning to
      // be the canonical surface).
      if (c.facet === "soundRecognition") {
        const meaningExists = filtered.some(
          (other) =>
            other !== c &&
            other.itemKind === c.itemKind &&
            other.itemKey === c.itemKey &&
            (other.facet === "meaningRecognition" || other.facet === "recognition"),
        );
        if (meaningExists) continue;
      }
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
      // contrast — phoneticTap etc. are about a single-char skill, not
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
  // Promoted cards prepend the queue (right after the current leech card).
  const combined = [...promotedRows, ...dedupedFiltered];

  // Per-card session position. Assigned once on first sighting so the
  // queue head doesn't jump on every re-render. New cards (cascade
  // surfacing mid-session) slot in at the end.
  const positionRef = useRef<Map<string, number>>(new Map());
  for (const c of combined) {
    const id = rid(c);
    if (!positionRef.current.has(id)) {
      positionRef.current.set(
        id,
        randomOrder ? Math.random() : positionRef.current.size,
      );
    }
  }
  const queue = combined
    .slice()
    .sort(
      (a, b) =>
        (positionRef.current.get(rid(a)) ?? 0) -
        (positionRef.current.get(rid(b)) ?? 0),
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

  const advanceWithoutGrading = useCallback((c: ReviewCard) => {
    setSkipped((prev) => {
      const k = rid(c);
      if (prev.has(k)) return prev;
      const n = new Set(prev);
      n.add(k);
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

  const handlePhoneticTapGrade = useCallback(
    (rating: RatingName) => {
      if (!current) return;
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
        <div className="review-header">
          <button className="back-btn" type="button" onClick={onClose}>
            ← Done
          </button>
          <span className="review-progress" />
        </div>
        <div className="review-empty">
          <div className="review-empty-title">All caught up.</div>
          <div className="review-empty-hint">
            Save a new word to add it to the review queue.
          </div>
        </div>
      </div>
    );
  }

  const word = current.itemKind === "word" ? findWord(current.itemKey) : null;
  const charData = chars?.[current.itemKey];
  const pinyin = word?.pinyin ?? charData?.pinyin ?? "";
  const gloss = word
    ? (word.definitions || []).slice(0, 3).join("; ")
    : (charData?.definitions || []).slice(0, 3).join("; ");
  const progressIndex = total - queue.length + 1;

  // Leech-cluster disambiguation. One-shot per key per session.
  const isSingleChar = [...current.itemKey].length === 1;
  const cluster = isSingleChar ? clusterFor(current.itemKey) : null;
  if (
    cluster &&
    (current.card.lapses ?? 0) >= LEECH_LAPSES &&
    !disambigSeen.has(current.itemKey)
  ) {
    return (
      <div className="review-root">
        <div className="review-header">
          <button className="back-btn" type="button" onClick={onClose}>
            ← Done
          </button>
          <span className="review-kind-tag">Confusable</span>
          <span className="review-progress">
            {progressIndex} / {total}
          </span>
        </div>
        <div className="review-body">
          <DisambiguationCard
            focus={current.itemKey}
            neighbors={cluster.filter((c) => c !== current.itemKey)}
            chars={chars ?? {}}
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
            onSkip={handleSkipCurrent}
          />
        </div>
      </div>
    );
  }

  // Production drill (✒ Wrote tier): trace the char via Hanzi Writer.
  if (current.facet === "production") {
    const cd = chars?.[current.itemKey];
    if (!cd) {
      return (
        <DrillFrame
          tag="Write"
          onClose={onClose}
          progressIndex={progressIndex}
          total={total}
          onSkip={handleSkipCurrent}
        >
          <div className="review-empty-hint">Loading character data…</div>
        </DrillFrame>
      );
    }
    return (
      <div className="review-root">
        <div className="review-header">
          <button className="back-btn" type="button" onClick={onClose}>
            ← Done
          </button>
          <span className="review-kind-tag">Write</span>
          <span className="review-progress">
            {progressIndex} / {total}
          </span>
        </div>
        <div className="review-body">
          <ProductionCard
            key={rid(current)}
            char={current.itemKey}
            charData={cd}
            onGrade={handlePhoneticTapGrade}
            onSkip={handleSkipCurrent}
          />
        </div>
      </div>
    );
  }

  // Family-transfer drill: "you know 青, what about 情?" Picks the
  // component for the prompt by walking phoneticComponentsByChar to find
  // any saved component whose family includes this card's itemKey.
  if (current.facet === "familyTransfer") {
    const cd = chars?.[current.itemKey];
    if (!phoneticComponents || !phoneticComponentsByChar || !cd) {
      return (
        <DrillFrame
          tag="Family"
          onClose={onClose}
          progressIndex={progressIndex}
          total={total}
          onSkip={handleSkipCurrent}
        >
          <div className="review-empty-hint">Loading family data…</div>
        </DrillFrame>
      );
    }
    const componentEntry =
      phoneticComponents.find((p) => p.family.includes(current.itemKey)) ??
      null;
    if (!componentEntry) {
      return (
        <DrillFrame
          tag="Family"
          onClose={onClose}
          progressIndex={progressIndex}
          total={total}
          onSkip={handleSkipCurrent}
        >
          <div className="review-empty-hint">
            No phonetic component found for {current.itemKey}. Tap Skip.
          </div>
        </DrillFrame>
      );
    }
    return (
      <DrillFrame
        tag="Family"
        onClose={onClose}
        progressIndex={progressIndex}
        total={total}
        onSkip={handleSkipCurrent}
      >
        <FamilyTransferCard
          key={rid(current)}
          familyMember={current.itemKey}
          charData={cd}
          componentEntry={componentEntry}
          pool={phoneticComponents}
          onGrade={handlePhoneticTapGrade}
        />
      </DrillFrame>
    );
  }

  // Component-sound drill. If supporting data isn't loaded yet, render a
  // loading placeholder rather than auto-skipping (auto-skip in render
  // was the source of the queue-flipping bug).
  if (current.facet === "componentSound") {
    const entry = phoneticComponentsByChar?.get(current.itemKey);
    if (!entry || !phoneticComponents) {
      return (
        <DrillFrame
          tag="Sound · pick"
          onClose={onClose}
          progressIndex={progressIndex}
          total={total}
          onSkip={handleSkipCurrent}
        >
          <div className="review-empty-hint">
            Loading phonetic-components data…
          </div>
        </DrillFrame>
      );
    }
    return (
      <DrillFrame
        tag="Sound · pick"
        onClose={onClose}
        progressIndex={progressIndex}
        total={total}
        onSkip={handleSkipCurrent}
      >
        <ComponentSoundCard
          key={rid(current)}
          entry={entry}
          pool={phoneticComponents}
          onGrade={handlePhoneticTapGrade}
        />
      </DrillFrame>
    );
  }

  // Phonetic-tap drill. Same loading-vs-skip treatment.
  if (current.facet === "phoneticTap") {
    const cd = chars?.[current.itemKey];
    const hasSoundComponent = !!cd?.components?.some(
      (c) => c.type === "sound" && c.char,
    );
    return (
      <DrillFrame
        tag="Sound · tap"
        onClose={onClose}
        progressIndex={progressIndex}
        total={total}
        onSkip={handleSkipCurrent}
      >
        {!cd ? (
          <div className="review-empty-hint">Loading character data…</div>
        ) : !hasSoundComponent ? (
          <div className="review-empty-hint">
            No sound component data for {current.itemKey}. Tap Skip to move on.
          </div>
        ) : (
          <PhoneticTapCard
            key={rid(current)}
            char={current.itemKey}
            charData={cd}
            onGrade={handlePhoneticTapGrade}
          />
        )}
      </DrillFrame>
    );
  }

  // Default = combined recognition card (v71). Both meaning + sound
  // facets surface together; user grades each separately, then taps
  // anywhere to advance. The other facet's card (if also in dueCards)
  // is dropped from the queue when this one is graded — useReview's
  // dueCards memo re-derives both rows out of due in one go.
  const meaningId = `${current.itemKind}|meaningRecognition|${current.itemKey}`;
  const soundId = `${current.itemKind}|soundRecognition|${current.itemKey}`;
  const hasMeaningCard =
    !!cards?.has(meaningId) ||
    current.facet === "meaningRecognition" ||
    current.facet === "recognition";
  const hasSoundCard =
    !!cards?.has(soundId) || current.facet === "soundRecognition";

  const handleCombinedGrade = (
    rating: RatingName,
    facet: "meaningRecognition" | "soundRecognition",
  ) => {
    onGrade(current.itemKey, rating, current.itemKind, facet);
    if (
      rating === "Again" &&
      current.itemKind === "word" &&
      [...current.itemKey].length > 1 &&
      onAttributeFailure
    ) {
      // Mirror v57's "what threw you?" affordance for word Again grades.
      setAttribTarget(current.itemKey);
      return;
    }
  };

  return (
    <div className="review-root">
      <div className="review-header">
        <button className="back-btn" type="button" onClick={onClose}>
          ← Done
        </button>
        <span className="review-kind-tag">
          {current.itemKind === "word" ? "Word" : "Character"}
        </span>
        <span className="review-progress">
          {progressIndex} / {total}
        </span>
      </div>
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
              <button
                type="button"
                className="review-attrib-skip"
                onClick={onGradedAdvance}
              >
                Skip
              </button>
            </div>
          </div>
        ) : (
          <CombinedRecognitionCard
            key={current.itemKey}
            itemKey={current.itemKey}
            itemKind={current.itemKind}
            word={word}
            charData={charData}
            hasMeaningCard={hasMeaningCard}
            hasSoundCard={hasSoundCard}
            onGradeMeaning={(r) => handleCombinedGrade(r, "meaningRecognition")}
            onGradeSound={(r) => handleCombinedGrade(r, "soundRecognition")}
            onSkip={handleSkipCurrent}
          />
        )}
      </div>
    </div>
  );
}

// Shared chrome for the auto-graded drill facets (phoneticTap +
// componentSound). One Skip button so the user is never stuck if the
// drill can't surface a meaningful question.
interface DrillFrameProps {
  tag: string;
  onClose: () => void;
  progressIndex: number;
  total: number;
  onSkip: () => void;
  children: React.ReactNode;
}
function DrillFrame({ tag, onClose, progressIndex, total, onSkip, children }: DrillFrameProps) {
  return (
    <div className="review-root">
      <div className="review-header">
        <button className="back-btn" type="button" onClick={onClose}>
          ← Done
        </button>
        <span className="review-kind-tag">{tag}</span>
        <span className="review-progress">
          {progressIndex} / {total}
        </span>
      </div>
      <div className="review-body">{children}</div>
      <div className="drill-skip-row">
        <button type="button" className="drill-skip" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { Word, Char } from "../lib/types";
import type { ReviewCard } from "../hooks/useReview";
import type { Facet, ItemKind } from "../hooks/useReview";
import type { RatingName } from "../lib/fsrs";
import { PhoneticTapCard } from "./PhoneticTapCard";
import { ComponentSoundCard } from "./ComponentSoundCard";
import { DisambiguationCard } from "./DisambiguationCard";
import { clusterFor, LEECH_LAPSES } from "../lib/confusionClusters";
import { speak } from "../lib/speech";
import type { PhoneticComponent } from "../hooks/usePhoneticComponents";

interface Props {
  dueCards: ReviewCard[];
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
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [attribTarget, setAttribTarget] = useState<string | null>(null);
  // Cards the user has explicitly skipped this session; filtered out of
  // the visible queue so they don't keep surfacing.
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  // Disambig already shown this session (one-shot per key).
  const [disambigSeen, setDisambigSeen] = useState<Set<string>>(() => new Set());

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
    return true;
  });

  // Per-card session position. Assigned once on first sighting so the
  // queue head doesn't jump on every re-render. New cards (cascade
  // surfacing mid-session) slot in at the end.
  const positionRef = useRef<Map<string, number>>(new Map());
  for (const c of filtered) {
    const id = rid(c);
    if (!positionRef.current.has(id)) {
      positionRef.current.set(
        id,
        randomOrder ? Math.random() : positionRef.current.size,
      );
    }
  }
  const queue = filtered
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
  // mid-pick queue shift can't fire onGrade for the wrong key.
  const handleRecognitionGrade = useCallback(
    (rating: RatingName) => {
      if (!current) return;
      const cur = current; // pin
      onGrade(cur.itemKey, rating, cur.itemKind, cur.facet);
      if (
        rating === "Again" &&
        cur.itemKind === "word" &&
        cur.facet === "recognition" &&
        [...cur.itemKey].length > 1 &&
        onAttributeFailure
      ) {
        setAttribTarget(cur.itemKey);
        return;
      }
      onGradedAdvance();
    },
    [current, onGrade, onAttributeFailure, onGradedAdvance],
  );

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
            }}
            onSkip={handleSkipCurrent}
          />
        </div>
      </div>
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

  // Default = recognition reveal-style. Two facets share this surface:
  //   meaningRecognition → "What does it mean?", emphasizes the gloss
  //   soundRecognition   → "How is it pronounced?", emphasizes pinyin + audio
  // Each is its own FSRS row so stability + retention are tracked
  // separately. Legacy "recognition" rows are migrated to
  // meaningRecognition at load time.
  const isSoundCard = current.facet === "soundRecognition";
  const tag =
    current.facet === "soundRecognition"
      ? "Sound"
      : current.facet === "meaningRecognition" || current.facet === "recognition"
        ? "Meaning"
        : current.itemKind === "word"
          ? "Word"
          : "Character";
  const promptText = isSoundCard
    ? "How is it pronounced?"
    : "What does it mean?";
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
      <div className="review-body">
        <div
          className={`review-card${isSoundCard ? " is-sound" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={revealed ? "Card revealed" : "Tap to reveal answer"}
          onClick={() => {
            if (!revealed) {
              setRevealed(true);
              speak(current.itemKey);
            } else {
              speak(current.itemKey);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              if (!revealed) speak(current.itemKey);
              setRevealed(true);
            }
          }}
        >
          {!revealed && (
            <div className="review-prompt-hint">{promptText}</div>
          )}
          <div className="review-hanzi">{current.itemKey}</div>
          {!revealed && <div className="review-tap-hint">Tap to reveal</div>}
          {revealed && (
            <>
              {isSoundCard ? (
                <>
                  <div className="review-pinyin review-pinyin-lg">{pinyin}</div>
                  <div className="review-gloss review-gloss-sm">
                    {gloss || "(no dictionary entry)"}
                  </div>
                </>
              ) : (
                <>
                  <div className="review-gloss">
                    {gloss || "(no dictionary entry)"}
                  </div>
                  <div className="review-pinyin">{pinyin}</div>
                </>
              )}
              <div className="review-tap-replay">🔊 tap to replay</div>
            </>
          )}
        </div>
      </div>
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
      ) : revealed ? (
        <div className="review-actions">
          <button
            type="button"
            className="review-btn review-btn-again"
            onClick={() => handleRecognitionGrade("Again")}
          >
            Again
          </button>
          <button
            type="button"
            className="review-btn review-btn-good"
            onClick={() => handleRecognitionGrade("Good")}
          >
            Good
          </button>
          <button
            type="button"
            className="review-btn review-btn-easy"
            onClick={() => handleRecognitionGrade("Easy")}
          >
            Easy
          </button>
          <button
            type="button"
            className="review-btn review-btn-skip"
            onClick={handleSkipCurrent}
            title="Skip this card for the rest of this session"
          >
            Skip
          </button>
        </div>
      ) : (
        <div className="review-actions">
          <button
            type="button"
            className="review-btn review-btn-reveal"
            onClick={() => setRevealed(true)}
          >
            Reveal
          </button>
          <button
            type="button"
            className="review-btn review-btn-skip"
            onClick={handleSkipCurrent}
            title="Skip this card for the rest of this session"
          >
            Skip
          </button>
        </div>
      )}
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
      <div className="review-actions">
        <button
          type="button"
          className="review-btn"
          onClick={onSkip}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

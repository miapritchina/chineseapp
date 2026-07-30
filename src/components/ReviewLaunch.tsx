import { useEffect, useState } from "react";
import type { Facet } from "../hooks/useReview";

export interface ReviewSettings {
  enabledFacets: Facet[];
  randomOrder: boolean;
  // Off by default: hide cascade-seeded char cards (sub-characters of
  // saved words that the user never explicitly saved) from the queue.
  includeSubchars: boolean;
  // Cards per session (v110, owner-chosen; null = everything due).
  sessionSize: number | null;
}

const SETTINGS_KEY = "chinese.reviewSettings";

// The drill types offered on the launch screen.
const ALL_FACET_OPTIONS: { facet: Facet; label: string; hint: string }[] = [
  {
    facet: "meaningRecognition",
    label: "Recognition",
    hint: "See the hanzi, recall sound AND meaning — grade each separately on one card.",
  },
  {
    facet: "wordInference",
    label: "New words",
    hint: "A real word you have NOT saved, built from characters you know — guess its meaning. Correct guesses credit the characters.",
  },
  {
    facet: "reverseRecognition",
    label: "Reverse",
    hint: "See the meaning, pick the right hanzi among your saved words.",
  },
  {
    facet: "clozeChar",
    label: "Fill the gap",
    hint: "One character of a saved word is masked (你▢) — pick it among confusables.",
  },
  {
    facet: "familySweep",
    label: "Family sweep",
    hint: "Spot the component: tap every character built with a component you saved — decoys included.",
  },
  {
    facet: "clusterRecall",
    label: "Cluster recall",
    hint: "3–4 related saved words on one screen — recall each before revealing, one grade for the group.",
  },
  {
    facet: "production",
    label: "Write",
    hint: "Trace the character that matches a meaning + sound prompt. Auto-graded by stroke mistakes via Hanzi Writer. Surfaces for saved single characters.",
  },
];
// Facets the launch screen knows about — used to scrub stale entries
// (e.g. the retired phoneticTap / componentSound) from saved settings.
const KNOWN_FACETS = new Set<Facet>(ALL_FACET_OPTIONS.map((o) => o.facet));

// Default-on facet: the recognition card. Everything else is opt-in.
const DEFAULT_FACETS: Facet[] = ["meaningRecognition"];

// The Recognition toggle is stored as meaningRecognition; the card
// grades meaning + sound together (v102), so starting a session also
// enables the sound facet's rows.
function expandFacets(enabled: Set<Facet>): Facet[] {
  const out = [...enabled];
  if (enabled.has("meaningRecognition")) out.push("soundRecognition");
  return out;
}

export function loadSettings(): ReviewSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReviewSettings>;
      if (Array.isArray(parsed.enabledFacets)) {
        const cleaned = (parsed.enabledFacets as Facet[]).filter((f) => KNOWN_FACETS.has(f));
        const size =
          parsed.sessionSize === null
            ? null
            : typeof parsed.sessionSize === "number" && parsed.sessionSize > 0
              ? parsed.sessionSize
              : DEFAULT_SESSION_SIZE;
        return {
          enabledFacets: cleaned.length > 0 ? cleaned : DEFAULT_FACETS,
          randomOrder: !!parsed.randomOrder,
          includeSubchars: !!parsed.includeSubchars,
          sessionSize: size,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return {
    enabledFacets: DEFAULT_FACETS,
    randomOrder: false,
    includeSubchars: false,
    sessionSize: DEFAULT_SESSION_SIZE,
  };
}

function saveSettings(s: ReviewSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// Session-size choices (v110). null = everything due.
const SESSION_SIZES: (number | null)[] = [10, 25, 50, null];
const DEFAULT_SESSION_SIZE = 25;

interface Props {
  // Counts of due cards per facet — shown so the user knows what they're
  // about to study before tapping Start.
  facetCounts: Record<string, number>;
  totalDue: number;
  // Learn mode (v110): how many saved words qualify for a lesson, and
  // the launcher — receives the chosen session size so App can cap
  // the lesson the same way review sessions are capped.
  learnCount?: number;
  onStartLearn?: (sessionSize: number | null) => void;
  // Sift mode (v113): due words available for triage. Uncapped — the
  // whole point is bulk-clearing a big backlog.
  siftCount?: number;
  onStartSift?: () => void;
  onStart: (settings: ReviewSettings) => void;
  onClose: () => void;
}

// Launch surface for a review session. Shown when the user navigates to
// #/review; hands a settings object up to the parent on Start. Settings
// persist in localStorage so reopening uses the user's last choice.
export function ReviewLaunch({
  facetCounts,
  totalDue,
  learnCount = 0,
  onStartLearn,
  siftCount = 0,
  onStartSift,
  onStart,
  onClose,
}: Props) {
  const [enabled, setEnabled] = useState<Set<Facet>>(() => new Set(loadSettings().enabledFacets));
  const [randomOrder, setRandomOrder] = useState<boolean>(() => loadSettings().randomOrder);
  const [includeSubchars, setIncludeSubchars] = useState<boolean>(
    () => loadSettings().includeSubchars,
  );
  const [sessionSize, setSessionSize] = useState<number | null>(() => loadSettings().sessionSize);

  // Persist on every toggle so the values survive a navigation away.
  useEffect(() => {
    saveSettings({
      enabledFacets: [...enabled],
      randomOrder,
      includeSubchars,
      sessionSize,
    });
  }, [enabled, randomOrder, includeSubchars, sessionSize]);

  const toggleFacet = (f: Facet) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const visibleDue = ALL_FACET_OPTIONS.filter((o) => enabled.has(o.facet)).reduce(
    (n, o) => n + (facetCounts[o.facet] || 0),
    0,
  );

  const start = () => {
    onStart({ enabledFacets: expandFacets(enabled), randomOrder, includeSubchars, sessionSize });
  };

  return (
    <div className="review-root">
      <div className="review-header">
        <button className="back-btn" type="button" onClick={onClose}>
          ← Done
        </button>
        <span className="review-kind-tag">Review</span>
        <span className="review-progress">{totalDue} due</span>
      </div>
      <div className="review-body launch-body">
        <div className="launch-section">
          <div className="launch-section-title">Drill types</div>
          <div className="launch-options">
            {ALL_FACET_OPTIONS.map((o) => {
              // Recognition surfaces ONE card per word even when both
              // facet rows are due — count words, not rows.
              const count = facetCounts[o.facet] || 0;
              const isOn = enabled.has(o.facet);
              return (
                <button
                  key={o.facet}
                  type="button"
                  className={`launch-option${isOn ? " is-on" : ""}`}
                  onClick={() => toggleFacet(o.facet)}
                  aria-pressed={isOn}
                >
                  <span className="launch-option-row">
                    <span className="launch-option-check">{isOn ? "●" : "○"}</span>
                    <span className="launch-option-label">{o.label}</span>
                    <span className="launch-option-count">{count}</span>
                  </span>
                  <span className="launch-option-hint">{o.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="launch-section">
          <div className="launch-section-title">Session size</div>
          <div className="launch-size-row">
            {SESSION_SIZES.map((n) => (
              <button
                key={n ?? "all"}
                type="button"
                className={`sort-pill${sessionSize === n ? " is-active" : ""}`}
                onClick={() => setSessionSize(n)}
                aria-pressed={sessionSize === n}
              >
                {n === null ? "All" : n}
              </button>
            ))}
          </div>
        </div>
        <div className="launch-section">
          <div className="launch-section-title">Order</div>
          <button
            type="button"
            className={`launch-option${randomOrder ? " is-on" : ""}`}
            onClick={() => setRandomOrder((v) => !v)}
            aria-pressed={randomOrder}
          >
            <span className="launch-option-row">
              <span className="launch-option-check">{randomOrder ? "●" : "○"}</span>
              <span className="launch-option-label">Shuffle within session</span>
            </span>
            <span className="launch-option-hint">
              Off (default): drill types take turns, most-needed cards first. On: fully random
              order.
            </span>
          </button>
        </div>
        <div className="launch-section">
          <div className="launch-section-title">Scope</div>
          <button
            type="button"
            className={`launch-option${includeSubchars ? " is-on" : ""}`}
            onClick={() => setIncludeSubchars((v) => !v)}
            aria-pressed={includeSubchars}
          >
            <span className="launch-option-row">
              <span className="launch-option-check">{includeSubchars ? "●" : "○"}</span>
              <span className="launch-option-label">Include cascaded sub-characters</span>
            </span>
            <span className="launch-option-hint">
              Off (default): only the words you saved + drills on their direct components surface.
              On: cascaded sub-character recognition cards (e.g. 豕 from saving 家) join the queue
              too.
            </span>
          </button>
        </div>
      </div>
      <div className="review-actions">
        <button
          type="button"
          className="review-btn review-btn-reveal"
          onClick={start}
          disabled={visibleDue === 0}
        >
          {sessionSize !== null && visibleDue > sessionSize
            ? `Start review · ${sessionSize} of ${visibleDue} cards`
            : `Start review · ${visibleDue} cards`}
        </button>
        {onStartLearn && (
          <button
            type="button"
            className="review-btn"
            onClick={() => onStartLearn(sessionSize)}
            disabled={learnCount === 0}
            title="A lesson, not a test: each word is introduced with sound, component breakdown, and your related words. No grading."
          >
            Learn · {Math.min(sessionSize ?? learnCount, learnCount)} words
          </button>
        )}
        {onStartSift && (
          <button
            type="button"
            className="review-btn"
            onClick={onStartSift}
            disabled={siftCount === 0}
            title="Triage: swipe right = I know this (counts as done in every drill today); swipe left = keep for practice, hidden from Sift until tomorrow."
          >
            Sift · {siftCount} due words
          </button>
        )}
      </div>
    </div>
  );
}

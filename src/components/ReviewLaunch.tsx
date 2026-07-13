import { useEffect, useState } from "react";
import type { Facet } from "../hooks/useReview";

export interface ReviewSettings {
  enabledFacets: Facet[];
  randomOrder: boolean;
  // Off by default: hide cascade-seeded char cards (sub-characters of
  // saved words that the user never explicitly saved) from the queue.
  includeSubchars: boolean;
}

const SETTINGS_KEY = "chinese.reviewSettings";

// The five drill types offered on the launch screen. The two granular
// component-level drills ("Tap the sound component" / "Sound of a
// component") were dropped — too micro to be worth a card slot.
const ALL_FACET_OPTIONS: { facet: Facet; label: string; hint: string }[] = [
  {
    facet: "meaningRecognition",
    label: "Meaning",
    hint: "What does it mean? Reveal-style.",
  },
  {
    facet: "soundRecognition",
    label: "Sound",
    hint: "How is it pronounced? Audio + tone-marked pinyin.",
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
    hint: "Tap every character that takes its sound from a component you saved — decoys included.",
  },
  {
    facet: "familyTransfer",
    label: "Family transfer",
    hint: '"You know 青 = qīng — what about 情?" Tests the youbian-dubian skill on un-saved family members.',
  },
  {
    facet: "production",
    label: "Write",
    hint: "Trace the character that matches a meaning + sound prompt. Auto-graded by stroke mistakes via Hanzi Writer. Surfaces only for saved chars at ✒ Wrote tier.",
  },
];
// Facets the launch screen knows about — used to scrub stale entries
// (e.g. the retired phoneticTap / componentSound) from saved settings.
const KNOWN_FACETS = new Set<Facet>(ALL_FACET_OPTIONS.map((o) => o.facet));

// Default-on facets: the two reveal-style recognition drills. The combined
// card grades meaning + sound together. familyTransfer + production are
// opt-in (familyTransfer targets un-saved chars; production is a heavier
// trace drill scoped to ✒ Wrote tier items).
const DEFAULT_FACETS: Facet[] = ["meaningRecognition", "soundRecognition"];

export function loadSettings(): ReviewSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReviewSettings>;
      if (Array.isArray(parsed.enabledFacets)) {
        const cleaned = (parsed.enabledFacets as Facet[]).filter((f) => KNOWN_FACETS.has(f));
        return {
          enabledFacets: cleaned.length > 0 ? cleaned : DEFAULT_FACETS,
          randomOrder: !!parsed.randomOrder,
          includeSubchars: !!parsed.includeSubchars,
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
  };
}

function saveSettings(s: ReviewSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

interface Props {
  // Counts of due cards per facet — shown so the user knows what they're
  // about to study before tapping Start.
  facetCounts: Record<string, number>;
  totalDue: number;
  // Whether the user has enough saved words to launch a cluster recall.
  canCluster: boolean;
  onStart: (settings: ReviewSettings) => void;
  onStartCluster: () => void;
  onClose: () => void;
}

// Launch surface for a review session. Shown when the user navigates to
// #/review; hands a settings object up to the parent on Start. Settings
// persist in localStorage so reopening uses the user's last choice.
export function ReviewLaunch({
  facetCounts,
  totalDue,
  canCluster,
  onStart,
  onStartCluster,
  onClose,
}: Props) {
  const [enabled, setEnabled] = useState<Set<Facet>>(() => new Set(loadSettings().enabledFacets));
  const [randomOrder, setRandomOrder] = useState<boolean>(() => loadSettings().randomOrder);
  const [includeSubchars, setIncludeSubchars] = useState<boolean>(
    () => loadSettings().includeSubchars,
  );

  // Persist on every toggle so the values survive a navigation away.
  useEffect(() => {
    saveSettings({
      enabledFacets: [...enabled],
      randomOrder,
      includeSubchars,
    });
  }, [enabled, randomOrder, includeSubchars]);

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
    onStart({ enabledFacets: [...enabled], randomOrder, includeSubchars });
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
              Off: char/component cards before words, oldest-due first. On: random order across all
              enabled drill types.
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
          Start review · {visibleDue} cards
        </button>
        <button
          type="button"
          className="review-btn"
          onClick={onStartCluster}
          disabled={!canCluster}
          title={
            canCluster
              ? "Surface 3–4 related saved words for whole-cluster recall"
              : "Save at least 3 words first"
          }
        >
          Cluster recall
        </button>
      </div>
    </div>
  );
}

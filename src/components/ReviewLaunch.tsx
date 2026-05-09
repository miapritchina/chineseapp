import { useEffect, useState } from "react";
import type { Facet } from "../hooks/useReview";

export interface ReviewSettings {
  enabledFacets: Facet[];
  randomOrder: boolean;
}

const SETTINGS_KEY = "chinese.reviewSettings";

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
    facet: "phoneticTap",
    label: "Tap the sound component",
    hint: "Pick which part of the character carries the sound.",
  },
  {
    facet: "componentSound",
    label: "Sound of a component",
    hint: "Multi-choice pinyin for productive phonetic components.",
  },
  {
    facet: "familyTransfer",
    label: "Family transfer",
    hint: '"You know 青 = qīng — what about 情?" Tests the youbian-dubian skill on un-saved family members.',
  },
];

export function loadSettings(): ReviewSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ReviewSettings;
      if (Array.isArray(parsed.enabledFacets)) {
        return {
          enabledFacets: parsed.enabledFacets,
          randomOrder: !!parsed.randomOrder,
        };
      }
    }
  } catch {
    /* ignore */
  }
  return {
    enabledFacets: ALL_FACET_OPTIONS.map((o) => o.facet),
    randomOrder: false,
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
  onStart: (settings: ReviewSettings) => void;
  onClose: () => void;
}

// Launch surface for a review session. Shown when the user navigates to
// #/review; hands a settings object up to the parent on Start. Settings
// persist in localStorage so reopening uses the user's last choice.
export function ReviewLaunch({ facetCounts, totalDue, onStart, onClose }: Props) {
  const [enabled, setEnabled] = useState<Set<Facet>>(
    () => new Set(loadSettings().enabledFacets),
  );
  const [randomOrder, setRandomOrder] = useState<boolean>(
    () => loadSettings().randomOrder,
  );

  // Persist on every toggle so the values survive a navigation away.
  useEffect(() => {
    saveSettings({ enabledFacets: [...enabled], randomOrder });
  }, [enabled, randomOrder]);

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
    onStart({ enabledFacets: [...enabled], randomOrder });
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
              Off: char/component cards before words, oldest-due first.
              On: random order across all enabled drill types.
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
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import type { Facet } from "../hooks/useReview";
import { setAutoSpeakEnabled } from "../lib/speech";

export interface ReviewSettings {
  enabledFacets: Facet[];
  randomOrder: boolean;
  // "Include word characters" (v135 — key name kept for stored
  // settings compat): each character of a saved multi-char word gets
  // its own recognition card. Off by default.
  includeSubchars: boolean;
  // Cards per session (v110, owner-chosen; null = everything due).
  sessionSize: number | null;
  // Speak answers on reveal (v114, default on).
  autoSpeak: boolean;
}

const SETTINGS_KEY = "chinese.reviewSettings";

// The drill types offered on the launch screen. Exported (v139) so
// the Stats page can render the due-by-drill breakdown — the counts
// left the launch screen (owner: numbers = pressure; stats = numbers
// welcome).
export const ALL_FACET_OPTIONS: { facet: Facet; label: string; hint: string; fun?: boolean }[] = [
  {
    facet: "meaningRecognition",
    label: "Recognition",
    hint: "See the hanzi, recall sound AND meaning — grade each separately on one card.",
  },
  {
    facet: "wordInference",
    label: "New words",
    fun: true,
    hint: "Just for fun — doesn't count as review. Real words you have NOT saved, built from your characters: guess the meaning, or build the hanzi from a tray. Correct answers still credit the characters.",
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
    fun: true,
    hint: "Just for fun — ungraded. Random components each session (all 250, not only saved ones): tap every character built with one, decoys included.",
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
          autoSpeak: parsed.autoSpeak !== false,
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
    autoSpeak: true,
  };
}

// The saved settings, ready to hand to ReviewPage: the Recognition
// toggle expanded to both its facet rows. Used by App's "Just start"
// flow, which skips the launch screen's Start button.
export function loadStartSettings(): ReviewSettings {
  const s = loadSettings();
  return { ...s, enabledFacets: expandFacets(new Set(s.enabledFacets)) };
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
  // Daily goal (v137): cards done today / the modest expectation. The
  // backlog stays available; only the framing changes.
  dailyDone?: number;
  dailyGoal?: number;
  // Learn mode (v110): how many saved words qualify for a lesson, and
  // the launcher — receives the chosen session size so App can cap
  // the lesson the same way review sessions are capped.
  learnCount?: number;
  onStartLearn?: (sessionSize: number | null) => void;
  // Sift mode (v113): due words available for triage. Uncapped — the
  // whole point is bulk-clearing a big backlog.
  siftCount?: number;
  onStartSift?: () => void;
  // Focus mode (v127): problem words — high exposure, still failing.
  focusCount?: number;
  onStartFocus?: () => void;
  // "Just start" (v114): one tap, App builds the whole session
  // (drills → learn) from the saved settings. Sift left the chain in
  // v123 — it's standalone triage, not a workout stage.
  onJustStart?: () => void;
  // Games (v116): pure play, no grading.
  forgeReady?: boolean;
  onStartForge?: () => void;
  pairsReady?: boolean;
  onStartPairs?: () => void;
  chainReady?: boolean;
  onStartChain?: () => void;
  onStart: (settings: ReviewSettings) => void;
  onClose: () => void;
}

// Launch surface for a review session. Shown when the user navigates to
// #/review; hands a settings object up to the parent on Start. Settings
// persist in localStorage so reopening uses the user's last choice.
export function ReviewLaunch({
  facetCounts,
  totalDue,
  dailyDone = 0,
  dailyGoal = 0,
  learnCount = 0,
  onStartLearn,
  siftCount = 0,
  onStartSift,
  focusCount = 0,
  onStartFocus,
  onJustStart,
  forgeReady = false,
  onStartForge,
  pairsReady = false,
  onStartPairs,
  chainReady = false,
  onStartChain,
  onStart,
  onClose,
}: Props) {
  const [enabled, setEnabled] = useState<Set<Facet>>(() => new Set(loadSettings().enabledFacets));
  const [randomOrder, setRandomOrder] = useState<boolean>(() => loadSettings().randomOrder);
  const [includeSubchars, setIncludeSubchars] = useState<boolean>(
    () => loadSettings().includeSubchars,
  );
  const [sessionSize, setSessionSize] = useState<number | null>(() => loadSettings().sessionSize);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => loadSettings().autoSpeak);

  // Persist on every toggle so the values survive a navigation away.
  useEffect(() => {
    saveSettings({
      enabledFacets: [...enabled],
      randomOrder,
      includeSubchars,
      sessionSize,
      autoSpeak,
    });
    setAutoSpeakEnabled(autoSpeak);
  }, [enabled, randomOrder, includeSubchars, sessionSize, autoSpeak]);

  const toggleFacet = (f: Facet) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const visibleDue = ALL_FACET_OPTIONS.filter((o) => enabled.has(o.facet) && !o.fun).reduce(
    (n, o) => n + (facetCounts[o.facet] || 0),
    0,
  );

  const renderFacetOption = (o: (typeof ALL_FACET_OPTIONS)[number]) => {
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
        </span>
        <span className="launch-option-hint">{o.hint}</span>
      </button>
    );
  };

  const start = () => {
    onStart({
      enabledFacets: expandFacets(enabled),
      randomOrder,
      includeSubchars,
      sessionSize,
      autoSpeak,
    });
  };

  return (
    <div className="review-root">
      <div className="review-header">
        <button className="back-btn" type="button" onClick={onClose}>
          ← Done
        </button>
        <span className="review-kind-tag">Review</span>
        <span className="review-progress">
          {dailyGoal > 0
            ? `${Math.min(dailyDone, dailyGoal)} / ${dailyGoal} today`
            : `${totalDue} due`}
        </span>
      </div>
      <div className="review-body launch-body">
        {onJustStart && (
          <button
            type="button"
            className="review-btn review-btn-reveal launch-just-start"
            onClick={onJustStart}
            disabled={totalDue === 0 && learnCount === 0}
          >
            <span className="launch-just-start-label">▶ Just start</span>
            <span className="launch-just-start-hint">
              One tap: your usual drills
              {learnCount > 0 ? ", then a couple of new words" : ""}.
            </span>
          </button>
        )}
        <div className="launch-section">
          <div className="launch-section-title">Drill types</div>
          <div className="launch-options">
            {ALL_FACET_OPTIONS.filter((o) => !o.fun).map(renderFacetOption)}
          </div>
          <div className="launch-section-title">Just for fun · ungraded</div>
          <div className="launch-options">
            {ALL_FACET_OPTIONS.filter((o) => o.fun).map(renderFacetOption)}
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
          <div className="launch-section-title">Sound</div>
          <button
            type="button"
            className={`launch-option${autoSpeak ? " is-on" : ""}`}
            onClick={() => setAutoSpeak((v) => !v)}
            aria-pressed={autoSpeak}
          >
            <span className="launch-option-row">
              <span className="launch-option-check">{autoSpeak ? "●" : "○"}</span>
              <span className="launch-option-label">Speak answers automatically</span>
            </span>
            <span className="launch-option-hint">
              On (default): every reveal plays the word&apos;s audio. Off: only the 🔊 buttons
              speak.
            </span>
          </button>
        </div>
        {(onStartForge || onStartPairs || onStartChain) && (
          <div className="launch-section">
            <div className="launch-section-title">Games</div>
            <div className="launch-games-col">
              {onStartForge && (
                <button
                  type="button"
                  className="review-btn launch-game-btn"
                  onClick={onStartForge}
                  disabled={!forgeReady}
                >
                  <span className="launch-game-name">⚒ Forge</span>
                  <span className="launch-game-hint">Smush characters into words you know</span>
                </button>
              )}
              {onStartPairs && (
                <button
                  type="button"
                  className="review-btn launch-game-btn"
                  onClick={onStartPairs}
                  disabled={!pairsReady}
                >
                  <span className="launch-game-name">🀄 Pairs</span>
                  <span className="launch-game-hint">Memory match — hanzi against meanings</span>
                </button>
              )}
              {onStartChain && (
                <button
                  type="button"
                  className="review-btn launch-game-btn"
                  onClick={onStartChain}
                  disabled={!chainReady}
                >
                  <span className="launch-game-name">⛓ Chain</span>
                  <span className="launch-game-hint">
                    接龙 — link words by their last character
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
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
              <span className="launch-option-label">Include word characters</span>
            </span>
            <span className="launch-option-hint">
              On: each character of your multi-character words gets its own recognition card (你好 →
              你 and 好). Off (default): only the words you saved surface.
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
          {visibleDue === 0
            ? "All caught up for today ✓"
            : `Start review · ${sessionSize !== null ? Math.min(sessionSize, visibleDue) : visibleDue} cards`}
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
        {onStartFocus && (
          <button
            type="button"
            className="review-btn"
            onClick={onStartFocus}
            disabled={focusCount === 0}
            title="Attention for problem words — seen many times, still failing. Each gets its lesson, a practice re-test, and one graded test, spaced within the session."
          >
            Focus · {focusCount} problem words
          </button>
        )}
      </div>
    </div>
  );
}

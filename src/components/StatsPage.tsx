import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { tallyByDay, streakFrom, strengthBuckets } from "../lib/stats";
import { PageHeader } from "./ui/PageHeader";

interface Props {
  userId: string | null;
  totalWords: number;
  learnedCount: number;
  dueCount: number;
  // Per saved word: min recognition stability (0 = never reviewed).
  stabilities: number[];
  onClose: () => void;
}

const HISTORY_DAYS = 14;

// Stats page (v115, owner request): the numbers that motivate — words
// collected, how solid they are, the review habit. Quiet and
// data-dense: no badges, no guilt mechanics, just the graph going the
// right way. History comes from user_review_log (signed-in only).
export function StatsPage({
  userId,
  totalWords,
  learnedCount,
  dueCount,
  stabilities,
  onClose,
}: Props) {
  const [timestamps, setTimestamps] = useState<number[] | null>(null);

  useEffect(() => {
    if (!userId) {
      setTimestamps(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - (HISTORY_DAYS - 1));
        since.setHours(0, 0, 0, 0);
        const { data, error } = await supabase
          .from("user_review_log")
          .select("reviewed_at")
          .gte("reviewed_at", since.toISOString())
          .limit(10000);
        if (cancelled || error || !data) return;
        setTimestamps(data.map((r: { reviewed_at: string }) => Date.parse(r.reviewed_at)));
      } catch {
        /* offline / table missing — history section shows its hint */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const days = useMemo(() => tallyByDay(timestamps ?? [], HISTORY_DAYS), [timestamps]);
  const streak = useMemo(() => streakFrom(days), [days]);
  const today = days[days.length - 1]?.count ?? 0;
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const total14 = days.reduce((n, d) => n + d.count, 0);
  const buckets = useMemo(() => strengthBuckets(stabilities), [stabilities]);
  const bucketRows = [
    { label: "Solid (3+ weeks)", count: buckets.solid, cls: "is-solid" },
    { label: "Growing (1–3 weeks)", count: buckets.growing, cls: "is-growing" },
    { label: "Shaky (under a week)", count: buckets.shaky, cls: "is-shaky" },
    { label: "Not started", count: buckets.fresh, cls: "is-fresh" },
  ];

  return (
    <div className="review-root">
      <PageHeader onBack={onClose} tag="Stats" progress="" />
      <div className="stats-body">
        <div className="stats-hero">
          <div className="stats-hero-number">{totalWords}</div>
          <div className="stats-hero-label">
            words collected · {learnedCount} learned 🎓 · {dueCount} due now
          </div>
        </div>

        <section className="stats-section">
          <div className="launch-section-title">Word strength</div>
          {totalWords > 0 && (
            <div className="stats-strength-bar" aria-hidden="true">
              {bucketRows.map(
                (b) =>
                  b.count > 0 && (
                    <span
                      key={b.cls}
                      className={`stats-strength-seg ${b.cls}`}
                      style={{ flexGrow: b.count }}
                    />
                  ),
              )}
            </div>
          )}
          <div className="stats-legend">
            {bucketRows.map((b) => (
              <div className="stats-legend-row" key={b.cls}>
                <span className={`stats-dot ${b.cls}`} />
                <span className="stats-legend-label">{b.label}</span>
                <span className="stats-legend-count">{b.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="stats-section">
          <div className="launch-section-title">Last {HISTORY_DAYS} days</div>
          {!userId ? (
            <div className="stats-hint">Sign in to track your review history across devices.</div>
          ) : timestamps === null ? (
            <div className="stats-hint">Loading history…</div>
          ) : (
            <>
              <div className="stats-summary-row">
                <span>
                  <b>{today}</b> today
                </span>
                <span>
                  <b>{total14}</b> reviews
                </span>
                {streak > 0 && (
                  <span>
                    <b>{streak}</b>-day streak {streak >= 3 ? "🔥" : ""}
                  </span>
                )}
              </div>
              <div className="stats-bars" role="img" aria-label="Reviews per day">
                {days.map((d) => (
                  <div className="stats-bar-slot" key={d.day} title={`${d.day}: ${d.count}`}>
                    <div
                      className={`stats-bar${d.day === days[days.length - 1].day ? " is-today" : ""}`}
                      style={{ height: `${Math.round((d.count / maxDay) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="stats-bars-caption">
                {days[0].day.slice(5)} → today · best day{" "}
                {maxDay === 1 && total14 === 0 ? 0 : maxDay}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

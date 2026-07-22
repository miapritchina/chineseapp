import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "./ui/PageHeader";
import { useCharsCtx, useSavedCtx } from "../state/contexts";
import type { ClassicData } from "../hooks/useSanzijing";

interface Props {
  data: ClassicData | null;
  error?: string | null;
  // Furthest-read couplet index + advance callback (useClassicProgress).
  bookmarkIndex: number;
  onAdvance: (index: number) => void;
  onOpenChar: (char: string) => void;
  onClose: () => void;
}

// 三字经 reading page. Each 3-char phrase is ONE card containing the
// EntitySheet's pinyin → hanzi → meaning stacks (the sheet-etym-piece
// treatment), numbered per couplet, with a modern interpretation as
// the primary line and Giles' 1900 rendering beneath it. Characters
// from the user's saved words are highlighted; scrolling advances a
// furthest-read bookmark synced via useClassicProgress.
export function ClassicPage({ data, error, bookmarkIndex, onAdvance, onOpenChar, onClose }: Props) {
  const { savedList } = useSavedCtx();
  const { chars } = useCharsCtx();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // The "continue" pill hides once used or once the user is past it.
  const [continueDismissed, setContinueDismissed] = useState(false);

  const knownSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of savedList) for (const c of e.word) s.add(c);
    return s;
  }, [savedList]);

  const coverage = useMemo(() => {
    if (!data) return null;
    const distinct = new Set<string>();
    for (const cpl of data.couplets) for (const c of cpl.a + cpl.b) distinct.add(c);
    let known = 0;
    for (const c of distinct) if (knownSet.has(c)) known++;
    return { known, total: distinct.size };
  }, [data, knownSet]);

  // Furthest couplet scrolled past the middle of the screen advances
  // the bookmark. Observation, not taps — reading position should
  // preserve itself.
  useEffect(() => {
    if (!data || !bodyRef.current) return;
    const observer = new window.IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const idx = Number((e.target as HTMLElement).dataset.idx);
          if (Number.isFinite(idx)) onAdvance(idx);
        }
      },
      { root: bodyRef.current, rootMargin: "0px 0px -55% 0px" },
    );
    for (const el of bodyRef.current.querySelectorAll("[data-idx]")) observer.observe(el);
    return () => observer.disconnect();
  }, [data, onAdvance]);

  const jumpToBookmark = () => {
    const el = bodyRef.current?.querySelector(`[data-idx="${bookmarkIndex}"]`);
    el?.scrollIntoView({ block: "start", behavior: "smooth" });
    setContinueDismissed(true);
  };

  const renderPhrase = (line: string, key: string) => (
    <div className="classic-phrase" key={key}>
      {[...line].map((c, i) => {
        const cd = chars?.[c];
        const known = knownSet.has(c);
        return (
          <span className="sheet-etym-piece" key={`${key}-${i}`}>
            <span className="sheet-etym-piece-pinyin">{cd?.pinyin ?? ""}</span>
            <button
              type="button"
              className={`sheet-etym-glyph sheet-etym-glyph-btn classic-glyph${known ? " is-known" : ""}`}
              onClick={() => onOpenChar(c)}
              title={`Open ${c}`}
            >
              {c}
            </button>
            <span className="sheet-etym-piece-meaning">{cd?.definitions?.[0] ?? ""}</span>
          </span>
        );
      })}
    </div>
  );

  const showContinue = data && bookmarkIndex > 2 && !continueDismissed;

  return (
    <div className="review-root classic-root">
      <PageHeader
        onBack={onClose}
        tag="三字经"
        progress={coverage ? `know ${coverage.known} / ${coverage.total}` : ""}
      />
      {showContinue && (
        <button type="button" className="classic-continue" onClick={jumpToBookmark}>
          Continue reading at № {bookmarkIndex + 1} ↓
        </button>
      )}
      <div className="classic-body" ref={bodyRef}>
        {error && <div className="empty-state">Could not load the text: {error}</div>}
        {!data && !error && <div className="empty-state">Loading the classic…</div>}
        {data && (
          <>
            <div className="classic-intro">
              <div className="classic-title-en">{data.titleEn}</div>
              Highlighted characters appear in your saved words — tap any character for the full
              breakdown. Your reading position is remembered.
            </div>
            {data.couplets.map((cpl, i) => (
              <section
                className={`classic-couplet${i === bookmarkIndex ? " is-bookmark" : ""}`}
                data-idx={i}
                key={i}
              >
                <div className="classic-num">№ {i + 1}</div>
                <div className="classic-phrases">
                  {renderPhrase(cpl.a, `${i}a`)}
                  {renderPhrase(cpl.b, `${i}b`)}
                </div>
                <div className="classic-mod">{cpl.mod}</div>
                <div className="classic-giles">{cpl.en}</div>
              </section>
            ))}
            <div className="classic-source">{data.source}</div>
          </>
        )}
      </div>
    </div>
  );
}

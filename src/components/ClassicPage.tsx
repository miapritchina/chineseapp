import { useMemo } from "react";
import { PageHeader } from "./ui/PageHeader";
import { Entity } from "./Entity";
import { useSavedCtx } from "../state/contexts";
import type { ClassicData } from "../hooks/useSanzijing";

interface Props {
  data: ClassicData | null;
  error?: string | null;
  onOpenChar: (char: string) => void;
  onClose: () => void;
}

// 三字经 reading page. Every character is an <Entity size="sm"> card
// (pinyin + hanzi + first gloss from data-chars), grouped in couplets
// with Giles' translation underneath. Characters that appear anywhere
// in the user's saved words are highlighted; the header tracks
// coverage of the text's distinct characters.
export function ClassicPage({ data, error, onOpenChar, onClose }: Props) {
  const { savedList } = useSavedCtx();

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

  const renderLine = (line: string, key: string) => (
    <div className="classic-line" key={key}>
      {[...line].map((c, i) => (
        <Entity
          key={`${key}-${i}`}
          itemKey={c}
          size="sm"
          showStatus={false}
          className={knownSet.has(c) ? "classic-known" : "classic-unknown"}
          onTap={onOpenChar}
        />
      ))}
    </div>
  );

  return (
    <div className="review-root classic-root">
      <PageHeader
        onBack={onClose}
        tag="三字经"
        progress={coverage ? `know ${coverage.known} / ${coverage.total}` : ""}
      />
      <div className="classic-body">
        {error && <div className="empty-state">Could not load the text: {error}</div>}
        {!data && !error && <div className="empty-state">Loading the classic…</div>}
        {data && (
          <>
            <div className="classic-intro">
              <div className="classic-title-en">{data.titleEn}</div>
              Characters from your saved words are highlighted — tap any card for the full
              breakdown.
            </div>
            {data.couplets.map((cpl, i) => (
              <section className="classic-couplet" key={i}>
                {renderLine(cpl.a, `${i}a`)}
                {renderLine(cpl.b, `${i}b`)}
                <div className="classic-en">{cpl.en}</div>
              </section>
            ))}
            <div className="classic-source">{data.source}</div>
          </>
        )}
      </div>
    </div>
  );
}

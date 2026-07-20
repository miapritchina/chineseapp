import { useMemo, useState } from "react";
import type { PhoneticComponent } from "../hooks/usePhoneticComponents";
import { useCharsCtx, useDictCtx, useSavedCtx } from "../state/contexts";
import {
  buildComponentIndex,
  charToSavedWords,
  savedConnections,
  wordsSharingChar,
  wordsUsing,
} from "../lib/explore";
import { PageHeader } from "./ui/PageHeader";
import { EmptyState } from "./ui/EmptyState";
import { StatusButton } from "./StatusButton";
import { Entity } from "./Entity";

export interface ExploreFocus {
  kind: "word" | "char" | "component";
  key: string;
}

interface Props {
  components: PhoneticComponent[];
  componentsByChar?: Map<string, PhoneticComponent>;
  ready: boolean;
  // Optional starting focus ("Explore from here" in the EntitySheet).
  initialFocus?: ExploreFocus | null;
  onClose: () => void;
  // Open the EntitySheet for full detail (status, mnemonic, tree).
  onOpenSheet: (kind: "word" | "char", key: string) => void;
}

const SECTION_CAP = 12;

// The Explore surface (docs/product/explore-page.md): one browsing
// page replacing the Network, Components, and Phonetics pages. Focus
// stack + tappable breadcrumb; →N badges count connections within the
// SAVED set only ("is this direction worth walking for my words?"),
// `end` marks dead ends.
export function ExplorePage({
  components,
  componentsByChar,
  ready,
  initialFocus,
  onClose,
  onOpenSheet,
}: Props) {
  const { chars } = useCharsCtx();
  const { findWord } = useDictCtx();
  const { savedList, getStatus, setStatus } = useSavedCtx();
  const [tab, setTab] = useState<"components" | "words">("components");
  const [trail, setTrail] = useState<ExploreFocus[]>(() => (initialFocus ? [initialFocus] : []));

  const savedWords = useMemo(() => savedList.map((s) => s.word), [savedList]);
  const charWords = useMemo(() => charToSavedWords(savedWords), [savedWords]);
  const componentIndex = useMemo(() => buildComponentIndex(chars ?? {}), [chars]);

  const focus = trail[trail.length - 1] ?? null;
  const push = (f: ExploreFocus) =>
    setTrail((prev) => {
      const top = prev[prev.length - 1];
      if (top && top.kind === f.kind && top.key === f.key) return prev;
      return [...prev, f];
    });
  const jumpTo = (i: number) => setTrail((prev) => prev.slice(0, i + 1));
  const back = () => {
    if (trail.length === 0) onClose();
    else setTrail((prev) => prev.slice(0, -1));
  };

  const badge = (key: string, kind: ExploreFocus["kind"]) => {
    const n = savedConnections(key, kind, charWords, componentIndex);
    return (
      <span className={`explore-badge${n === 0 ? " is-end" : ""}`}>
        {n === 0 ? "end" : `→${n}`}
      </span>
    );
  };

  // A tappable related-item card: Entity + connection badge.
  const relCard = (key: string, kind: ExploreFocus["kind"], size: "sm" | "md" = "sm") => (
    <Entity
      key={key}
      itemKey={key}
      size={size}
      showStatus={false}
      className="explore-card"
      trailing={badge(key, kind)}
      onTap={() => push({ kind, key })}
    />
  );

  const section = (title: string, items: React.ReactNode[], emptyHint?: string) => (
    <div className="explore-section" key={title}>
      <div className="launch-section-title">{title}</div>
      {items.length > 0 ? (
        <div className="explore-cards">{items}</div>
      ) : (
        <div className="explore-empty">{emptyHint ?? "nothing here yet"}</div>
      )}
    </div>
  );

  // Long lists cap at SECTION_CAP with a show-all expander.
  const Capped = ({ title, all }: { title: string; all: React.ReactNode[] }) => {
    const [expanded, setExpanded] = useState(false);
    const shown = expanded ? all : all.slice(0, SECTION_CAP);
    return (
      <div className="explore-section">
        <div className="launch-section-title">{title}</div>
        <div className="explore-cards">{shown}</div>
        {all.length > SECTION_CAP && !expanded && (
          <button type="button" className="explore-more" onClick={() => setExpanded(true)}>
            show all {all.length}
          </button>
        )}
      </div>
    );
  };

  const renderFocus = (f: ExploreFocus) => {
    const isWord = f.kind === "word" && [...f.key].length > 1;
    const sections: React.ReactNode[] = [];

    if (isWord) {
      const uniq = [...new Set(f.key)];
      sections.push(
        section(
          "Characters in this word",
          uniq.map((c) => relCard(c, "char")),
        ),
      );
      const sharing = wordsSharingChar(f.key, savedWords);
      sections.push(
        <Capped
          key="sharing"
          title={`My words sharing a character (${sharing.length})`}
          all={sharing.map((w) => relCard(w, "word"))}
        />,
      );
    } else {
      // char / component focus. Owner's primary interest first: which
      // of MY words use it — directly or through a character built
      // with it.
      const mine = wordsUsing(f.key, charWords, componentIndex);
      sections.push(
        <Capped
          key="mine"
          title={`In my words (${mine.length})`}
          all={mine.map((w) => relCard(w, "word"))}
        />,
      );
      const family = componentsByChar?.get(f.key);
      if (family) {
        const members = family.family.filter((c) => c && c !== f.key && chars?.[c]);
        sections.push(
          <Capped
            key="family"
            title={`Sound family of ${f.key} (${members.length})`}
            all={members.map((c) => relCard(c, "char", "md"))}
          />,
        );
      }
      const builtWith = (componentIndex.get(f.key) ?? []).filter(
        (c) => !family || !family.family.includes(c),
      );
      if (builtWith.length > 0) {
        // My-words-relevant characters first, then the rest.
        const sorted = [...builtWith].sort(
          (a, b) =>
            savedConnections(b, "char", charWords, componentIndex) -
            savedConnections(a, "char", charWords, componentIndex),
        );
        sections.push(
          <Capped
            key="built"
            title={`Characters built with ${f.key} (${sorted.length})`}
            all={sorted.map((c) => relCard(c, "char"))}
          />,
        );
      }
      const pieces = (chars?.[f.key]?.components ?? []).filter((p) => p.char);
      if (pieces.length > 0) {
        sections.push(
          section(
            "Made of",
            pieces.map((p) => relCard(p.char, "char")),
          ),
        );
      }
    }

    const focusWord = isWord ? findWord(f.key) : null;
    const cd = chars?.[f.key];
    const pinyin = focusWord?.pinyin ?? cd?.pinyin ?? "";
    const gloss = (focusWord?.definitions ?? cd?.definitions ?? []).slice(0, 2).join("; ");

    return (
      <>
        <button
          type="button"
          className="explore-focus"
          onClick={() => onOpenSheet(isWord ? "word" : "char", f.key)}
          title="Open full details"
        >
          <span className="explore-focus-hanzi">{f.key}</span>
          <span className="explore-focus-meta">
            <span className="explore-focus-pinyin">{pinyin}</span>
            <span className="explore-focus-gloss">{gloss}</span>
          </span>
          <span className="explore-focus-status" onClick={(e) => e.stopPropagation()}>
            <StatusButton status={getStatus(f.key)} onChange={(next) => setStatus(f.key, next)} />
          </span>
        </button>
        {sections}
      </>
    );
  };

  return (
    <div className="phonetics-root explore-root">
      <PageHeader
        onBack={back}
        backLabel={trail.length > 0 ? "← Back" : "← Done"}
        tag="Explore"
        progress={trail.length === 0 ? components.length : ""}
      />
      {trail.length > 0 && (
        <div className="explore-trail">
          <button type="button" className="explore-crumb" onClick={() => setTrail([])}>
            Index
          </button>
          {trail.map((t, i) => (
            <button
              key={`${t.key}-${i}`}
              type="button"
              className={`explore-crumb${i === trail.length - 1 ? " is-current" : ""}`}
              onClick={() => jumpTo(i)}
            >
              {t.key}
            </button>
          ))}
        </div>
      )}
      <div className="explore-body">
        {focus ? (
          renderFocus(focus)
        ) : !ready ? (
          <EmptyState title="Loading…" />
        ) : (
          <>
            <div className="explore-tabs">
              <button
                type="button"
                className={`sort-pill${tab === "components" ? " is-active" : ""}`}
                onClick={() => setTab("components")}
              >
                Components
              </button>
              <button
                type="button"
                className={`sort-pill${tab === "words" ? " is-active" : ""}`}
                onClick={() => setTab("words")}
              >
                My words
              </button>
            </div>
            {tab === "components" ? (
              <div className="phonetics-list">
                {components.map((c) => {
                  const mine = savedConnections(c.char, "component", charWords, componentIndex);
                  return (
                    <div
                      key={c.char}
                      className="phonetics-row explore-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => push({ kind: "component", key: c.char })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          push({ kind: "component", key: c.char });
                        }
                      }}
                    >
                      <span className="phonetics-row-char">{c.char}</span>
                      <span className="phonetics-row-pinyin">{c.pinyinTones || c.pinyin}</span>
                      <span className="phonetics-row-count">
                        {mine > 0 ? `${mine} of mine · ` : ""}
                        {c.count} chars
                      </span>
                      <span className="phonetics-row-status" onClick={(e) => e.stopPropagation()}>
                        <StatusButton
                          status={getStatus(c.char)}
                          onChange={(next) => setStatus(c.char, next)}
                        />
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : savedWords.length === 0 ? (
              <EmptyState title="No saved words yet." hint="Save a word from search first." />
            ) : (
              <div className="explore-cards explore-index-words">
                {savedWords.map((w) => relCard(w, [...w].length > 1 ? "word" : "char"))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

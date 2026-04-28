import type { Char, TreeNode } from "../lib/types";
import { ROLE_LABEL, strokeRoleForIndex } from "../lib/tree";
import type { StrokeData } from "../hooks/useStrokeData";

interface Props {
  node: TreeNode;
  charData: Char | undefined;
  strokeData: StrokeData | null;
  cardW: number;
}

export function NodeCard({ node, charData, strokeData, cardW }: Props) {
  const role = node.role || "unknown";
  const isCharacterless = node.char === "◎";

  // Suppress placeholder pinyin "xx" for characterless components; otherwise
  // prefer pinyin from the tree node (word root) → from char data.
  const py = isCharacterless ? "" : node.pinyin || charData?.pinyin || "";

  // Gloss preference: explicit node gloss → component definition → char's
  // first dictionary def. For characterless components, the comp definition
  // is just "characterless component" — prefer the parent's hint instead.
  const gloss =
    node.gloss ||
    (isCharacterless && node.compHint
      ? node.compHint
      : node.compDef || charData?.definitions?.[0] || "");

  // Etymology shown on every card by default (line-clamped via CSS at small
  // zoom; full at zoom > 1.7×). For characterless components we don't have a
  // separate notes field — the hint already covers it via gloss above.
  const etymText = node.isWord
    ? ""
    : isCharacterless
      ? ""
      : charData?.notes?.trim() ||
        (charData?.originalMeaning && charData.originalMeaning !== "characterless component"
          ? `Originally: ${charData.originalMeaning}`
          : "");

  return (
    <div className={`node-card role-${role}${node.isWord ? " is-word" : ""}`}>
      {py && <div className="card-pinyin">{py}</div>}

      {node.isWord ? (
        <WordGlyph node={node} cardW={cardW} />
      ) : (
        <div className="card-glyph">
          {strokeData?.strokes?.length ? (
            <CharGlyph node={node} strokeData={strokeData} />
          ) : (
            <div
              className="card-glyph-fallback"
              style={{ color: `var(--role-${role})` }}
            >
              {node.char}
            </div>
          )}
        </div>
      )}

      {!node.isWord && role && (
        <div className={`card-role role-${role}`}>{ROLE_LABEL[role] || "Component"}</div>
      )}

      {gloss && (
        <div className="card-gloss">{gloss.length > 80 ? gloss.slice(0, 79) + "…" : gloss}</div>
      )}

      {etymText && <div className="card-etym">{etymText}</div>}
    </div>
  );
}

function WordGlyph({ node, cardW }: { node: TreeNode; cardW: number }) {
  const n = Math.max(2, node.char.length);
  const fontSize = Math.min(96, Math.floor((cardW - 32) / n) - 2);
  return (
    <div className="card-word" style={{ fontSize: `${fontSize}px` }}>
      {node.char}
    </div>
  );
}

function CharGlyph({ node, strokeData }: { node: TreeNode; strokeData: StrokeData }) {
  const total = strokeData.strokes.length;
  return (
    <svg className="card-glyph-svg" viewBox="0 0 1024 1024">
      <g transform="translate(0, 900) scale(1, -1)">
        {strokeData.strokes.map((d, i) => {
          const role = strokeRoleForIndex(node, i, total);
          return <path key={i} d={d} fill={`var(--role-${role})`} />;
        })}
      </g>
    </svg>
  );
}

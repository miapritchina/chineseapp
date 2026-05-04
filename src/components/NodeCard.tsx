import type { Char, TreeNode } from "../lib/types";
import { ROLE_LABEL, strokeRoleForIndex } from "../lib/tree";
import type { StrokeData } from "../hooks/useStrokeData";

interface Props {
  node: TreeNode;
  charData: Char | undefined;
  strokeData: StrokeData | null;
  cardW: number;
  // # of saved entries (length > 1) containing this char, excluding the char
  // itself. Renders a top-right counter so you can see at a glance how
  // recurring a component is across your saved words.
  usageCount: number;
}

export function NodeCard({ node, charData, strokeData, cardW, usageCount }: Props) {
  const role = node.role || "unknown";
  const isCharacterless = node.char === "◎";

  // Suppress placeholder pinyin "xx" for characterless components; otherwise
  // prefer pinyin from the tree node (word root) → from char data.
  const py = isCharacterless ? "" : node.pinyin || charData?.pinyin || "";

  // Gloss preference: explicit node gloss → component definition →
  // ALL char dictionary defs (semicolon-joined). For characterless components,
  // the comp definition is just "characterless component" — prefer the
  // parent's hint instead.
  const gloss = node.isWord
    ? node.gloss || ""
    : node.gloss ||
      (isCharacterless && node.compHint
        ? node.compHint
        : node.compDef ||
          (charData?.definitions?.length ? charData.definitions.join("; ") : ""));

  // Etymology shown on every card by default. For characterless components
  // we don't have a separate notes field — the hint already covers it via
  // gloss above.
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
      {!node.isWord && (role || usageCount > 0) && (
        <div className="card-top-row">
          {role ? (
            <span className={`card-role-badge role-${role}`}>
              {ROLE_LABEL[role] || "Component"}
            </span>
          ) : (
            <span />
          )}
          {usageCount > 0 && (
            <span
              className="card-usage"
              title={`In ${usageCount} of your saved word${usageCount === 1 ? "" : "s"}`}
            >
              <span className="card-usage-icon">★</span>
              <span className="card-usage-count">{usageCount}</span>
            </span>
          )}
        </div>
      )}

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

      {gloss && <div className="card-gloss">{gloss}</div>}

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

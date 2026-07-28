import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Char, TreeNode } from "../lib/types";
import { walkTree } from "../lib/tree";
import { useStrokeData } from "../hooks/useStrokeData";
import { NodeCard } from "./NodeCard";
import { cleanEtymologyNotes } from "../lib/etymology";

const CARD_W = 220;
// Per-card heights are computed from content (note + gloss length, role
// label, etc). CARD_BASE_H is the floor for the non-text chrome:
// pinyin + glyph slot + role label + paddings; gloss + etymology are added
// on top in estimateCardHeight().
const CARD_BASE_H = 220;
const CARD_MIN_H = 240;
const CARD_NOTE_LINE_H = 16; // px per wrapped note line
const CARD_NOTE_CHARS_PER_LINE = 28; // ~ at 11.5px font in 220px width
const Y_GAP = 28;
const X_GAP = 10;
const CHARACTERLESS = "◎";

interface Props {
  tree: TreeNode;
  chars: Record<string, Char>;
  saved: Set<string>;
  onNodeClick: (char: string) => void;
}

interface Placement {
  node: TreeNode;
  x: number;
  y: number; // vertical center of the card
  cardH: number; // this card's actual height
  parent: Placement | null;
  id: string;
}

interface Link {
  source: Placement;
  target: Placement;
  role: string;
}

// Estimate a card's pixel height from its content. We don't measure DOM here
// because d3 layout runs before the cards mount; an estimate is good enough
// to keep rows from overlapping. Slight under-estimate → minor overlap; we
// add a small safety pad to bias toward over-estimate.
function estimateCardHeight(node: TreeNode, charsData: Record<string, Char>): number {
  const c = charsData[node.char];
  const isCharacterless = node.char === CHARACTERLESS;

  // Gloss text — same source the NodeCard uses (joined defs for chars).
  const glossText = node.isWord
    ? node.gloss || ""
    : node.gloss ||
      (isCharacterless && node.compHint
        ? node.compHint
        : node.compDef || (c?.definitions?.length ? c.definitions.join("; ") : ""));

  // Etymology text — same source the NodeCard uses.
  const noteText = node.isWord
    ? ""
    : isCharacterless
      ? ""
      : cleanEtymologyNotes(c?.notes) ||
        (c?.originalMeaning && c.originalMeaning !== "characterless component"
          ? `Originally: ${c.originalMeaning}`
          : "");

  const glossLines = glossText
    ? Math.max(1, Math.ceil(glossText.length / CARD_NOTE_CHARS_PER_LINE))
    : 0;
  const noteLines = noteText
    ? Math.max(1, Math.ceil(noteText.length / CARD_NOTE_CHARS_PER_LINE))
    : 0;

  // Heights per text block.
  const glossH = glossLines * 18; // gloss is 14px font, line-height ~1.3
  const noteH = noteLines * CARD_NOTE_LINE_H + (noteText ? 12 /* margin-top */ : 0);

  return Math.max(CARD_MIN_H, CARD_BASE_H + glossH + noteH + 12 /* pad */);
}

export function DecompositionTree({ tree, chars, saved, onNodeClick }: Props) {
  // Per-char usage count: how many of the user's saved multi-char words
  // contain this char (excluding the char saved as itself). Memoized as
  // a single pass over the saved set so DecompositionTree's re-renders
  // don't replay the O(saved.size · word.length) walk per node.
  const usageByChar = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of saved) {
      if (k.length <= 1) continue;
      const seen = new Set<string>();
      for (const c of k) {
        if (c === k || seen.has(c)) continue;
        seen.add(c);
        m.set(c, (m.get(c) || 0) + 1);
      }
    }
    return m;
  }, [saved]);
  const usageOf = (char: string): number => usageByChar.get(char) || 0;
  const svgRef = useRef<SVGSVGElement>(null);
  // eslint-disable-next-line no-undef -- DOM lib type, not a global value
  const innerRef = useRef<SVGGElement>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [strokesReady, setStrokesReady] = useState(false);
  const stroke = useStrokeData();

  // Build layout when the tree (or chars data) changes.
  useEffect(() => {
    let cancelled = false;
    setStrokesReady(false);
    (async () => {
      const charsInTree = new Set<string>();
      walkTree(tree, (n) => charsInTree.add(n.char));
      await Promise.all([...charsInTree].map((c) => stroke.load(c)));
      if (cancelled) return;

      const root = d3.hierarchy<TreeNode>(tree, (d) => d.children);
      // Use d3.tree purely for X-axis spacing; we override Y per depth row to
      // accommodate variable-height cards.
      //
      // d3.tree's default separation is `(a.parent === b.parent ? 1 : 2)` —
      // non-sibling subtrees double the gap, which spread top-level chars
      // (e.g. 休 / 息 of 休息) far apart. 1.4 for non-siblings strikes a
      // balance: visible gap between independent subtrees, tighter than the
      // original 2×.
      const layout = d3
        .tree<TreeNode>()
        .nodeSize([CARD_W + X_GAP, 1])
        .separation((a, b) => (a.parent === b.parent ? 1 : 1.4));
      layout(root);

      // Per-node estimated heights + group by depth.
      const heightOf = new Map<d3.HierarchyPointNode<TreeNode>, number>();
      const byDepth: d3.HierarchyPointNode<TreeNode>[][] = [];
      root.each((d) => {
        const dd = d as d3.HierarchyPointNode<TreeNode>;
        heightOf.set(dd, estimateCardHeight(dd.data, chars));
        if (!byDepth[dd.depth]) byDepth[dd.depth] = [];
        byDepth[dd.depth].push(dd);
      });

      // Row height = max card height in that depth. Cumulative y centers per row.
      const rowH: number[] = byDepth.map((row) =>
        Math.max(...row.map((n) => heightOf.get(n) || CARD_MIN_H)),
      );
      const depthCenterY: number[] = [];
      for (let d = 0; d < byDepth.length; d++) {
        if (d === 0) depthCenterY[d] = rowH[d] / 2;
        else depthCenterY[d] = depthCenterY[d - 1] + rowH[d - 1] / 2 + Y_GAP + rowH[d] / 2;
      }

      const newPlacements: Placement[] = [];
      const newLinks: Link[] = [];
      const visit = (
        d: d3.HierarchyPointNode<TreeNode>,
        parentId: string,
        idx: number,
      ): Placement => {
        const id = parentId ? `${parentId}.${idx}` : "0";
        const p: Placement = {
          node: d.data,
          x: d.x,
          y: depthCenterY[d.depth],
          cardH: heightOf.get(d) || CARD_MIN_H,
          parent: null,
          id,
        };
        newPlacements.push(p);
        for (let i = 0; i < (d.children?.length ?? 0); i++) {
          const child = d.children![i];
          const cp = visit(child as d3.HierarchyPointNode<TreeNode>, id, i);
          cp.parent = p;
          newLinks.push({ source: p, target: cp, role: child.data.role || "unknown" });
        }
        return p;
      };
      visit(root as d3.HierarchyPointNode<TreeNode>, "", 0);

      // viewBox bounds.
      let minX = Infinity,
        maxX = -Infinity,
        maxBottom = 0;
      for (const p of newPlacements) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        const bottom = p.y + p.cardH / 2;
        if (bottom > maxBottom) maxBottom = bottom;
      }
      const padX = CARD_W / 2 + 12;
      const padTop = CARD_MIN_H / 2 + 12;
      const padBottom = 24;
      const svg = svgRef.current;
      if (!svg) return;
      svg.setAttribute(
        "viewBox",
        `${minX - padX} ${-padTop} ${maxX - minX + padX * 2} ${maxBottom + padTop + padBottom}`,
      );
      svg.setAttribute("preserveAspectRatio", "xMidYMin meet");

      setPlacements(newPlacements);
      setLinks(newLinks);
      setStrokesReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tree, stroke, chars]);

  // Pan/zoom — attached once.
  useEffect(() => {
    const svg = svgRef.current;
    const inner = innerRef.current;
    if (!svg || !inner) return;
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 6])
      .on("zoom", (e) => {
        inner.setAttribute("transform", e.transform.toString());
      });
    d3.select(svg).call(zoom);
    return () => {
      d3.select(svg).on(".zoom", null);
    };
  }, [strokesReady]);

  const linkPath = (l: Link) => {
    const sx = l.source.x,
      sy = l.source.y + l.source.cardH / 2;
    const tx = l.target.x,
      ty = l.target.y - l.target.cardH / 2;
    const my = (sy + ty) / 2;
    return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
  };

  return (
    <svg
      ref={svgRef}
      className="tree-svg"
      role="img"
      aria-label={`Decomposition tree for ${tree.char}`}
    >
      <g ref={innerRef}>
        <g>
          {links.map((l) => (
            <path
              key={`${l.source.id}->${l.target.id}`}
              className={`link role-${l.role}`}
              d={linkPath(l)}
            />
          ))}
        </g>
        <g>
          {placements.map((p) => {
            const clickable = !p.node.isWord && p.node.char !== CHARACTERLESS;
            const half = p.cardH / 2;
            return (
              <g
                key={p.id}
                className="node"
                style={{
                  transform: `translate(${p.x}px, ${p.y}px)`,
                  cursor: clickable ? "pointer" : "default",
                }}
                onClick={() => clickable && onNodeClick(p.node.char)}
              >
                <foreignObject
                  className="node-card-fo"
                  x={-CARD_W / 2}
                  y={-half}
                  width={CARD_W}
                  height={p.cardH}
                >
                  <NodeCard
                    node={p.node}
                    charData={chars[p.node.char]}
                    strokeData={stroke.get(p.node.char)}
                    cardW={CARD_W}
                    usageCount={p.node.isWord ? 0 : usageOf(p.node.char)}
                  />
                </foreignObject>
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
}

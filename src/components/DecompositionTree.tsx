import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { Char, TreeNode } from "../lib/types";
import { walkTree } from "../lib/tree";
import { useStrokeData } from "../hooks/useStrokeData";
import { NodeCard } from "./NodeCard";

const CARD_W = 220;
const CARD_H = 280;
const CARD_H_EXPANDED = 380;
const Y_GAP = 24;
const X_GAP = 10;
const CHARACTERLESS = "◎";
const ZOOM_EXPAND_AT = 1.7;

interface Props {
  tree: TreeNode;
  chars: Record<string, Char>;
  onNodeClick: (char: string) => void;
}

interface Placement {
  node: TreeNode;
  x: number;
  y: number;
  parent: Placement | null;
  id: string;
}

interface Link {
  source: Placement;
  target: Placement;
  role: string;
}

export function DecompositionTree({ tree, chars, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const innerRef = useRef<SVGGElement>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [strokesReady, setStrokesReady] = useState(false);
  // True once the user zooms past ZOOM_EXPAND_AT — drives both the per-card
  // height (etymology becomes visible) and the overall row spacing so cards
  // don't stomp on each other when they grow.
  const [expanded, setExpanded] = useState(false);
  const stroke = useStrokeData();

  const cardH = expanded ? CARD_H_EXPANDED : CARD_H;
  const cardHalf = cardH / 2;

  // Build layout when the tree (or expansion state) changes.
  // Stroke loading is idempotent — preloading on every layout pass is cheap
  // because useStrokeData caches per-char.
  useEffect(() => {
    let cancelled = false;
    setStrokesReady(false);
    (async () => {
      const charsInTree = new Set<string>();
      walkTree(tree, (n) => charsInTree.add(n.char));
      await Promise.all([...charsInTree].map((c) => stroke.load(c)));
      if (cancelled) return;

      const root = d3.hierarchy<TreeNode>(tree, (d) => d.children);
      const dx = CARD_W + X_GAP;
      const dy = cardH + Y_GAP;
      d3.tree<TreeNode>().nodeSize([dx, dy])(root);

      const newPlacements: Placement[] = [];
      const newLinks: Link[] = [];
      const visit = (
        d: d3.HierarchyPointNode<TreeNode>,
        parentId: string,
        idx: number,
      ): Placement => {
        const id = parentId ? `${parentId}.${idx}` : "0";
        const p: Placement = { node: d.data, x: d.x, y: d.y, parent: null, id };
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

      // viewBox: pad with the expanded card size so the box never has to grow
      // mid-interaction. d3-zoom transforms inside this box; if the viewBox
      // jumped on expansion, panning offsets would feel unstable.
      let minX = Infinity, maxX = -Infinity, maxY = 0;
      for (const p of newPlacements) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const padX = CARD_W / 2 + 12;
      const padTop = CARD_H_EXPANDED / 2 + 12;
      const padBottom = CARD_H_EXPANDED / 2 + 16;
      const svg = svgRef.current;
      if (!svg) return;
      svg.setAttribute(
        "viewBox",
        `${minX - padX} ${-padTop} ${maxX - minX + padX * 2} ${maxY + padTop + padBottom}`,
      );
      svg.setAttribute("preserveAspectRatio", "xMidYMin meet");

      setPlacements(newPlacements);
      setLinks(newLinks);
      setStrokesReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tree, stroke, cardH]);

  // Pan/zoom — attached once. Cross-the-threshold drives `expanded`.
  useEffect(() => {
    const svg = svgRef.current;
    const inner = innerRef.current;
    if (!svg || !inner) return;
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.4, 6])
      .on("zoom", (e) => {
        inner.setAttribute("transform", e.transform.toString());
        const k = e.transform.k;
        const next = k > ZOOM_EXPAND_AT;
        // Only flip state when the threshold is crossed; otherwise React
        // would re-run the layout effect on every zoom tick.
        setExpanded((prev) => (prev !== next ? next : prev));
        svg.classList.toggle("zoom-lg", next);
      });
    d3.select(svg).call(zoom);
    return () => {
      d3.select(svg).on(".zoom", null);
    };
  }, [strokesReady]);

  const linkPath = (l: Link) => {
    const sx = l.source.x, sy = l.source.y + cardHalf;
    const tx = l.target.x, ty = l.target.y - cardHalf;
    const my = (sy + ty) / 2;
    return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
  };

  return (
    <svg ref={svgRef} className="tree-svg" role="img" aria-label={`Decomposition tree for ${tree.char}`}>
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
            return (
              <g
                key={p.id}
                className="node"
                style={{
                  // SVG `transform` attribute doesn't animate via CSS; styling
                  // it does. Lets the .node CSS rule transition position
                  // smoothly when expanded toggles.
                  transform: `translate(${p.x}px, ${p.y}px)`,
                  cursor: clickable ? "pointer" : "default",
                }}
                onClick={() => clickable && onNodeClick(p.node.char)}
              >
                <foreignObject
                  className="node-card-fo"
                  x={-CARD_W / 2}
                  y={-cardHalf}
                  width={CARD_W}
                  height={cardH}
                >
                  <NodeCard
                    node={p.node}
                    charData={chars[p.node.char]}
                    strokeData={stroke.get(p.node.char)}
                    cardW={CARD_W}
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

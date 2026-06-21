"use client";

import { useMemo, useRef, useState } from "react";
import {
  sankey,
  sankeyLinkHorizontal,
  type SankeyGraph,
  type SankeyNode,
  type SankeyLink,
} from "d3-sankey";
import type { FlowsDoc } from "@/lib/flows";

/** 百万円の値を「X兆Y,YYY億円」に整形（unit=百万円 前提）。 */
export function formatYen(millionYen: number): string {
  const oku = millionYen / 100; // 億円
  const cho = Math.floor(oku / 10000);
  const rest = Math.round(oku % 10000);
  if (cho > 0) {
    return `${cho.toLocaleString("ja-JP")}兆${rest.toLocaleString("ja-JP")}億円`;
  }
  return `${Math.round(oku).toLocaleString("ja-JP")}億円`;
}

type NodeExtra = { id: string; name: string; side: string };
type LinkExtra = { ratio: number };
type SNode = SankeyNode<NodeExtra, LinkExtra>;
type SLink = SankeyLink<NodeExtra, LinkExtra>;

interface TipState {
  x: number;
  y: number;
  html: React.ReactNode;
}

export default function SankeyChart({ doc }: { doc: FlowsDoc }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const width = 980;
  const height = 560;

  const graph = useMemo<SankeyGraph<NodeExtra, LinkExtra>>(() => {
    const incomeTotal = doc.totals.income;
    const expenseTotal = doc.totals.expense;

    const nodes: NodeExtra[] = doc.nodes.map((n) => ({ ...n }));
    const idIndex = new Map(nodes.map((n, i) => [n.id, i]));
    const links: (LinkExtra & { source: number; target: number; value: number })[] =
      doc.links.map((l) => {
        const denom = l.source === "general_account" ? expenseTotal : incomeTotal;
        return {
          source: idIndex.get(l.source)!,
          target: idIndex.get(l.target)!,
          value: l.value,
          ratio: denom ? l.value / denom : 0,
        };
      });

    const layout = sankey<NodeExtra, LinkExtra>()
      .nodeWidth(18)
      .nodePadding(14)
      .extent([
        [8, 12],
        [width - 8, height - 12],
      ]);

    return layout({
      nodes: nodes.map((d) => ({ ...d })),
      links: links.map((d) => ({ ...d })),
    });
  }, [doc]);

  const linkPath = sankeyLinkHorizontal<NodeExtra, LinkExtra>();

  function colorFor(side: string, hi = false): string {
    if (side === "income") return hi ? "var(--income-hi)" : "var(--income)";
    if (side === "expense") return hi ? "var(--expense-hi)" : "var(--expense)";
    return "var(--hub)";
  }

  function showTip(e: React.MouseEvent, node: React.ReactNode) {
    setTip({ x: e.clientX, y: e.clientY, html: node });
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ minWidth: 720, display: "block" }}
        onMouseLeave={() => setTip(null)}
      >
        {/* links */}
        <g fill="none">
          {(graph.links as SLink[]).map((l, i) => {
            const src = l.source as SNode;
            const tgt = l.target as SNode;
            const flowSide = src.id === "general_account" ? "expense" : "income";
            return (
              <path
                key={i}
                d={linkPath(l) ?? undefined}
                stroke={colorFor(flowSide)}
                strokeOpacity={0.38}
                strokeWidth={Math.max(1, l.width ?? 1)}
                onMouseMove={(e) =>
                  showTip(
                    e,
                    <>
                      <div>
                        {src.name} → {tgt.name}
                      </div>
                      <div className="v">{formatYen(l.value as number)}</div>
                      <div style={{ color: "var(--muted)" }}>
                        構成比 {(l.ratio * 100).toFixed(1)}%
                      </div>
                    </>,
                  )
                }
                onMouseLeave={() => setTip(null)}
              />
            );
          })}
        </g>

        {/* nodes */}
        <g>
          {(graph.nodes as SNode[]).map((n, i) => {
            const x0 = n.x0 ?? 0;
            const x1 = n.x1 ?? 0;
            const y0 = n.y0 ?? 0;
            const y1 = n.y1 ?? 0;
            const isExpense = n.side === "expense";
            const isHub = n.side === "hub";
            const labelX = isExpense ? x0 - 6 : x1 + 6;
            const anchor = isExpense ? "end" : "start";
            const total =
              n.side === "income" ? doc.totals.income : doc.totals.expense;
            const ratio = total ? (n.value ?? 0) / total : 0;
            return (
              <g key={i}>
                <rect
                  x={x0}
                  y={y0}
                  width={Math.max(2, x1 - x0)}
                  height={Math.max(1, y1 - y0)}
                  fill={colorFor(n.side)}
                  rx={2}
                  onMouseMove={(e) =>
                    showTip(
                      e,
                      <>
                        <div>{n.name}</div>
                        <div className="v">{formatYen(n.value ?? 0)}</div>
                        {!isHub && (
                          <div style={{ color: "var(--muted)" }}>
                            {n.side === "income" ? "歳入" : "歳出"}構成比{" "}
                            {(ratio * 100).toFixed(1)}%
                          </div>
                        )}
                      </>,
                    )
                  }
                  onMouseLeave={() => setTip(null)}
                />
                {isHub ? (
                  <text
                    className="node-label"
                    x={(x0 + x1) / 2}
                    y={y0 - 6}
                    textAnchor="middle"
                    fontWeight={700}
                  >
                    {n.name}
                  </text>
                ) : (
                  <>
                    <text
                      className="node-label"
                      x={labelX}
                      y={(y0 + y1) / 2 - 1}
                      textAnchor={anchor}
                      dominantBaseline="middle"
                    >
                      {n.name}
                    </text>
                    <text
                      className="node-sub"
                      x={labelX}
                      y={(y0 + y1) / 2 + 12}
                      textAnchor={anchor}
                      dominantBaseline="middle"
                    >
                      {formatYen(n.value ?? 0)}・{(ratio * 100).toFixed(1)}%
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {tip && (
        <div
          className="sankey-tip"
          style={{ left: tip.x + 14, top: tip.y + 14 }}
        >
          {tip.html}
        </div>
      )}
    </div>
  );
}

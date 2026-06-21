"use client";

import type { FlowsDoc } from "@/lib/flows";
import { formatYen } from "@/components/SankeyChart";

/** 所管別（府省別）歳出を構成比バーで一覧（依頼書 §12-1）。 */
export default function MinistryPanel({ doc }: { doc: FlowsDoc }) {
  const rows = doc.nodes
    .filter((n) => n.side === "expense")
    .map((n) => ({
      id: n.id,
      name: n.name,
      value: doc.links.find((l) => l.target === n.id)?.value ?? 0,
    }))
    .sort((a, b) => b.value - a.value);

  const total = doc.totals.expense;
  const max = rows.length ? rows[0].value : 0;

  return (
    <div className="chart-card" style={{ marginTop: 16 }}>
      <div className="tax-head">
        <h2 style={{ fontSize: "1rem", margin: 0 }}>所管別（府省別）歳出</h2>
        <div className="tax-head-meta">
          歳出合計 <b>{formatYen(total)}</b>
        </div>
      </div>
      <div className="tax-rows">
        {rows.map((r) => {
          const share = total ? (r.value / total) * 100 : 0;
          return (
            <div key={r.id} className="tax-row">
              <div className="tax-name">{r.name}</div>
              <div className="tax-track">
                <div
                  className="tax-fill"
                  style={{
                    width: `${max ? (r.value / max) * 100 : 0}%`,
                    background: "var(--expense)",
                  }}
                />
              </div>
              <div className="tax-val">
                {formatYen(r.value)}
                <span className="tax-share">（{share.toFixed(1)}%）</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

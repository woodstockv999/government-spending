"use client";

import type { FlowsDoc } from "@/lib/flows";
import { formatYen } from "@/components/SankeyChart";

/** 複数年度の歳出総額と公債依存度を並べて比較表示（依頼書 §12-2）。 */
export default function TrendPanel({
  docs,
  currentYear,
}: {
  docs: FlowsDoc[];
  currentYear: string;
}) {
  if (docs.length < 2) return null;

  const sorted = [...docs].sort(
    (a, b) => Number(a.fiscalYear) - Number(b.fiscalYear),
  );
  const max = Math.max(...sorted.map((d) => d.totals.expense));
  const bond = (d: FlowsDoc) => {
    const k =
      d.links.find((l) => l.source === "income_kosaikin")?.value ?? 0;
    return d.totals.income ? (k / d.totals.income) * 100 : 0;
  };

  return (
    <div className="chart-card" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: "1rem", margin: "4px 0 12px" }}>
        年度トレンド（歳出総額と公債依存度）
      </h2>
      <div className="trend">
        {sorted.map((d) => {
          const h = max ? (d.totals.expense / max) * 160 : 0;
          const isCur = d.fiscalYear === currentYear;
          return (
            <div key={d.fiscalYear} className="trend-col">
              <div className="trend-bondval">{bond(d).toFixed(1)}%</div>
              <div className="trend-bar-area">
                <div
                  className="trend-bar"
                  style={{
                    height: `${h}px`,
                    background: isCur ? "var(--income-hi)" : "var(--income)",
                  }}
                  title={`${d.fiscalYear}年度 歳出 ${formatYen(d.totals.expense)}`}
                />
              </div>
              <div className="trend-total">{formatYen(d.totals.expense)}</div>
              <div className={`trend-year${isCur ? " cur" : ""}`}>
                {d.fiscalYear}年度
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: "8px 0 0" }}>
        棒=歳出総額、上段%=公債依存度（公債金/歳入）。選択中の年度を明色で表示。
      </p>
    </div>
  );
}

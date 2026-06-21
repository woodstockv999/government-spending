"use client";

import type { FlowsDoc } from "@/lib/flows";
import { formatYen } from "@/components/SankeyChart";

// 税収を構成する歳入ノード（公債金・その他収入＝非税収 は除く）。
const TAX_IDS = [
  "income_shotokuzei",
  "income_hojinzei",
  "income_shohizei",
  "income_other_tax",
];

/** 税収内訳と税収依存度を表示（依頼書 §12-4）。 */
export default function TaxBreakdownPanel({ doc }: { doc: FlowsDoc }) {
  const val = (id: string) =>
    doc.links.find((l) => l.source === id || l.target === id)?.value ?? 0;

  const taxes = TAX_IDS.map((id) => ({
    id,
    name: doc.nodes.find((n) => n.id === id)?.name ?? id,
    value: val(id),
  })).filter((t) => t.value > 0);

  const taxTotal = taxes.reduce((a, t) => a + t.value, 0);
  if (taxTotal === 0) return null;

  const taxDependency = doc.totals.income
    ? (taxTotal / doc.totals.income) * 100
    : 0;
  const max = Math.max(...taxes.map((t) => t.value));

  return (
    <div className="chart-card" style={{ marginTop: 16 }}>
      <div className="tax-head">
        <h2 style={{ fontSize: "1rem", margin: 0 }}>税収内訳</h2>
        <div className="tax-head-meta">
          税収合計 <b>{formatYen(taxTotal)}</b> ／ 税収依存度{" "}
          <b>{taxDependency.toFixed(1)}%</b>（税収÷歳入）
        </div>
      </div>
      <div className="tax-rows">
        {taxes.map((t) => {
          const share = taxTotal ? (t.value / taxTotal) * 100 : 0;
          return (
            <div key={t.id} className="tax-row">
              <div className="tax-name">{t.name}</div>
              <div className="tax-track">
                <div
                  className="tax-fill"
                  style={{ width: `${max ? (t.value / max) * 100 : 0}%` }}
                />
              </div>
              <div className="tax-val">
                {formatYen(t.value)}
                <span className="tax-share">（{share.toFixed(1)}%）</span>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: "8px 0 0" }}>
        %は税収合計に占める割合。公債金・その他収入（非税収）は含みません。
      </p>
    </div>
  );
}

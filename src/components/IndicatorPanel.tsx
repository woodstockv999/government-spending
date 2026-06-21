"use client";

import type { FlowsDoc } from "@/lib/flows";
import { formatYen } from "@/components/SankeyChart";

/** flows データから主要な財政指標を算出して表示（依頼書 §12-4）。 */
export default function IndicatorPanel({ doc }: { doc: FlowsDoc }) {
  const val = (id: string) =>
    doc.links.find((l) => l.source === id || l.target === id)?.value ?? 0;

  const incomeTotal = doc.totals.income;
  const expenseTotal = doc.totals.expense;
  const kosaikin = val("income_kosaikin"); // 公債金
  const kokusaihi = val("exp_kokusaihi"); // 国債費
  const shakaihosho = val("exp_shakaihosho"); // 社会保障関係費

  const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);

  // 基礎的財政収支（プライマリーバランス）の目安
  //   = (歳入 − 公債金) − (歳出 − 国債費)
  const pb = incomeTotal - kosaikin - (expenseTotal - kokusaihi);

  const cards: {
    label: string;
    value: string;
    sub: string;
    tone?: "income" | "expense";
  }[] = [
    {
      label: "公債依存度",
      value: `${pct(kosaikin, incomeTotal).toFixed(1)}%`,
      sub: `公債金 ${formatYen(kosaikin)} / 歳入`,
      tone: "expense",
    },
    {
      label: "国債費の割合",
      value: `${pct(kokusaihi, expenseTotal).toFixed(1)}%`,
      sub: `国債費 ${formatYen(kokusaihi)} / 歳出`,
    },
    {
      label: "社会保障関係費の割合",
      value: `${pct(shakaihosho, expenseTotal).toFixed(1)}%`,
      sub: `${formatYen(shakaihosho)} / 歳出`,
    },
    {
      label: "基礎的財政収支(目安)",
      value: (pb < 0 ? "▲" : "+") + formatYen(Math.abs(pb)),
      sub: pb < 0 ? "公債金で賄う赤字" : "黒字",
      tone: pb < 0 ? "expense" : "income",
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((c) => (
        <div key={c.label} className={`kpi ${c.tone ?? ""}`}>
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value">{c.value}</div>
          <div className="kpi-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

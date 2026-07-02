"use client";

import { useEffect, useMemo, useState } from "react";
import type { IntlDoc, IntlIndicatorId } from "@/lib/intl";

const BP = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** 他国の政府財政（対GDP比）との比較パネル。データ出典: IMF DataMapper API。 */
export default function IntlComparisonPanel() {
  const [doc, setDoc] = useState<IntlDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indicator, setIndicator] = useState<IntlIndicatorId>("exp");
  const [year, setYear] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BP}/api/intl`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("intl データの取得に失敗しました。"))))
      .then((d: IntlDoc) => {
        setDoc(d);
        setYear(d.defaultYear);
      })
      .catch((e) => setError(e.message));
  }, []);

  const rows = useMemo(() => {
    if (!doc || !year) return [];
    return doc.countries
      .map((c) => ({ code: c.code, name: c.name, value: c.values[indicator]?.[year] }))
      .filter((r): r is { code: string; name: string; value: number } => typeof r.value === "number")
      .sort((a, b) => b.value - a.value);
  }, [doc, year, indicator]);

  if (error) return <div className="admin-result err">{error}</div>;
  if (!doc || !year) return null;

  const max = Math.max(...rows.map((r) => r.value), 1);
  const info = doc.indicators[indicator];

  return (
    <div className="chart-card" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: "1rem", margin: "4px 0 12px" }}>
        他国の政府財政との比較（対GDP比）
      </h2>

      <div className="toolbar" style={{ marginBottom: 8 }}>
        <div className="seg">
          {(Object.keys(doc.indicators) as IntlIndicatorId[]).map((id) => (
            <button
              key={id}
              className={indicator === id ? "on" : ""}
              onClick={() => setIndicator(id)}
            >
              {doc.indicators[id].label}
            </button>
          ))}
        </div>
        {doc.years.length > 1 && (
          <>
            <label htmlFor="intl-year">年</label>
            <select id="intl-year" value={year} onChange={(e) => setYear(e.target.value)}>
              {doc.years.map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="intl-bars">
        {rows.map((r) => (
          <div key={r.code} className="intl-row">
            <div className={`intl-name${r.code === "JPN" ? " jp" : ""}`}>{r.name}</div>
            <div className="intl-bar-area">
              <div
                className={`intl-bar${r.code === "JPN" ? " jp" : ""}`}
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
            <div className="intl-value">{r.value.toFixed(1)}%</div>
          </div>
        ))}
      </div>

      <div className="notice" style={{ marginTop: 12 }}>
        {doc.caveat}
      </div>

      <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: "8px 0 0" }}>
        出典: {info.imfSource}（{doc.source}）。集計基準: {doc.basis}。
        データ取得日: {new Date(doc.retrievedAt).toLocaleDateString("ja-JP")}。
        {" "}
        <a href={doc.sourceUrl} target="_blank" rel="noreferrer">出典元を見る</a>
      </p>
    </div>
  );
}

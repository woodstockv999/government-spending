"use client";

import { useEffect, useState } from "react";
import SankeyChart, { formatYen } from "@/components/SankeyChart";
import IndicatorPanel from "@/components/IndicatorPanel";
import type { FlowsDoc, IndexDoc } from "@/lib/flows";

function downloadCsv(doc: FlowsDoc) {
  const lines = ["side,id,name,value_百万円,構成比_percent"];
  const incomeTotal = doc.totals.income;
  const expenseTotal = doc.totals.expense;
  for (const n of doc.nodes) {
    if (n.side === "hub") continue;
    const total = n.side === "income" ? incomeTotal : expenseTotal;
    const link = doc.links.find(
      (l) => l.source === n.id || l.target === n.id,
    );
    const v = link?.value ?? 0;
    const pct = total ? ((v / total) * 100).toFixed(2) : "0";
    lines.push(`${n.side},${n.id},${n.name},${v},${pct}`);
  }
  const blob = new Blob(["﻿" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ippan_kaikei_${doc.fiscalYear}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [index, setIndex] = useState<IndexDoc | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [doc, setDoc] = useState<FlowsDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/index.json")
      .then((r) => {
        if (!r.ok) throw new Error("index.json が見つかりません。npm run build:flows を実行してください。");
        return r.json();
      })
      .then((idx: IndexDoc) => {
        setIndex(idx);
        setYear(idx.default);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!year) return;
    fetch(`/data/flows.${year}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`flows.${year}.json の取得に失敗しました。`);
        return r.json();
      })
      .then(setDoc)
      .catch((e) => setError(e.message));
  }, [year]);

  return (
    <div className="wrap">
      <header className="site">
        <h1>国家予算まる見え</h1>
        <p className="lede">
          日本国の一般会計（歳入 → 一般会計 → 歳出）の流れをサンキー図で可視化します。
        </p>
      </header>

      {error && (
        <div className="admin-result err">{error}</div>
      )}

      {index && doc && (
        <>
          <div className="toolbar">
            <label htmlFor="year">年度</label>
            <select
              id="year"
              value={year ?? ""}
              onChange={(e) => setYear(e.target.value)}
            >
              {index.years.map((y) => (
                <option key={y} value={y}>
                  {y}年度
                </option>
              ))}
            </select>
            <button onClick={() => downloadCsv(doc)}>CSVダウンロード</button>
          </div>

          <div className="meta">
            <span>
              区分 <b>{doc.type}</b>（{doc.stage}）
            </span>
            <span>
              歳入合計 <b>{formatYen(doc.totals.income)}</b>
            </span>
            <span>
              歳出合計 <b>{formatYen(doc.totals.expense)}</b>
            </span>
            <span>
              単位 <b>{doc.unit}</b>
            </span>
          </div>

          <IndicatorPanel doc={doc} />

          <div className="chart-card">
            <SankeyChart doc={doc} />
          </div>

          <div className="notice">
            国の予算・決算は年次公表のため、本サイトの数値は日次では変わりません。
            「最新データ取込」は新年度データの取込用です。左が歳入、中央が一般会計、右が歳出です。
          </div>
        </>
      )}

      {!index && !error && <p style={{ color: "var(--muted)" }}>読み込み中…</p>}

      <footer className="site">
        <p>
          出典: {doc?.source ?? "財務省 / e-Stat"}（一般会計）。データ由来:{" "}
          {doc?.origin ?? "seed"}。
        </p>
        <p>
          更新日: {doc ? new Date(doc.updatedAt).toLocaleString("ja-JP") : "—"}。
          本データは {doc?.stage ?? "当初予算"} の区分です。
          <b>「決算（確定値）」と「予算（当初/補正）」「速報値」は区別</b>して扱ってください。
        </p>
        <p>
          ※ 初版の数値は概算の seed 値であり、財務省公表値・e-Stat による検証前です。
          明細（個別契約・支出先）レベルは初版スコープ外です。
        </p>
        <p>
          <a href="/admin">管理画面（最新データ取込）</a> ・ 思想参考:
          チームみらい「みらい まる見え政治資金」（コードは非流用）
        </p>
      </footer>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import SankeyChart, { formatYen } from "@/components/SankeyChart";
import IndicatorPanel from "@/components/IndicatorPanel";
import TaxBreakdownPanel from "@/components/TaxBreakdownPanel";
import TrendPanel from "@/components/TrendPanel";
import MinistryPanel from "@/components/MinistryPanel";
import type { FlowsDoc, IndexDoc } from "@/lib/flows";

type View = "keihi" | "shokan";

// サブパス配置時の接頭辞（未設定なら ""）。
const BP = process.env.NEXT_PUBLIC_BASE_PATH || "";

function downloadCsv(doc: FlowsDoc, suffix: string) {
  const lines = ["side,id,name,value_百万円,構成比_percent"];
  const incomeTotal = doc.totals.income;
  const expenseTotal = doc.totals.expense;
  for (const n of doc.nodes) {
    if (n.side === "hub") continue;
    const total = n.side === "income" ? incomeTotal : expenseTotal;
    const link = doc.links.find((l) => l.source === n.id || l.target === n.id);
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
  a.download = `${suffix}_${doc.fiscalYear}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [index, setIndex] = useState<IndexDoc | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [view, setView] = useState<View>("keihi");
  const [doc, setDoc] = useState<FlowsDoc | null>(null);
  const [ministryDoc, setMinistryDoc] = useState<FlowsDoc | null>(null);
  const [allDocs, setAllDocs] = useState<FlowsDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BP}/data/index.json`)
      .then((r) => {
        if (!r.ok)
          throw new Error(
            "index.json が見つかりません。npm run build:flows を実行してください。",
          );
        return r.json();
      })
      .then((idx: IndexDoc) => {
        setIndex(idx);
        setYear(idx.default);
        Promise.all(
          idx.years.map((y) =>
            fetch(`${BP}/data/flows.${y}.json`).then((r) => r.json()),
          ),
        )
          .then(setAllDocs)
          .catch(() => {
            /* トレンドは任意表示。失敗しても本体に影響させない */
          });
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!year) return;
    fetch(`${BP}/data/flows.${year}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`flows.${year}.json の取得に失敗しました。`);
        return r.json();
      })
      .then(setDoc)
      .catch((e) => setError(e.message));
  }, [year]);

  // 所管別ビューが利用可能な年度なら ministry.<年度>.json を取得。
  const ministryAvailable = !!(year && index?.ministryYears?.includes(year));
  useEffect(() => {
    if (!ministryAvailable) {
      setMinistryDoc(null);
      return;
    }
    fetch(`${BP}/data/ministry.${year}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMinistryDoc)
      .catch(() => setMinistryDoc(null));
  }, [year, ministryAvailable]);

  const isShokan = view === "shokan" && ministryAvailable && !!ministryDoc;
  const chartDoc = isShokan ? ministryDoc! : doc;

  return (
    <div className="wrap">
      <header className="site">
        <h1>国家予算まる見え</h1>
        <p className="lede">
          日本国の一般会計（歳入 → 一般会計 → 歳出）の流れをサンキー図で可視化します。
        </p>
      </header>

      {error && <div className="admin-result err">{error}</div>}

      {index && doc && chartDoc && (
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

            {ministryAvailable && (
              <div className="seg">
                <button
                  className={view === "keihi" ? "on" : ""}
                  onClick={() => setView("keihi")}
                >
                  主要経費別
                </button>
                <button
                  className={view === "shokan" ? "on" : ""}
                  onClick={() => setView("shokan")}
                >
                  所管別（府省別）
                </button>
              </div>
            )}

            <button
              onClick={() =>
                downloadCsv(chartDoc, isShokan ? "shokan" : "ippan_kaikei")
              }
            >
              CSVダウンロード
            </button>
          </div>

          <div className="meta">
            <span>
              区分 <b>{chartDoc.type}</b>（{chartDoc.stage}）
            </span>
            <span>
              歳入合計 <b>{formatYen(chartDoc.totals.income)}</b>
            </span>
            <span>
              歳出合計 <b>{formatYen(chartDoc.totals.expense)}</b>
            </span>
            <span>
              単位 <b>{chartDoc.unit}</b>
            </span>
          </div>

          {!isShokan && <IndicatorPanel doc={doc} />}

          {isShokan && (
            <div className="notice">
              所管別（府省別）の配分は<b>暫定の例示値（要検証）</b>です。財務省「予算書（所管別）」/
              e-Stat による確定値への差し替えが必要です。
            </div>
          )}

          <div className="chart-card">
            <SankeyChart doc={chartDoc} />
          </div>

          {isShokan ? (
            <MinistryPanel doc={chartDoc} />
          ) : (
            <>
              <TaxBreakdownPanel doc={doc} />
              <div className="notice">
                国の予算・決算は年次公表のため、本サイトの数値は日次では変わりません。
                「最新データ取込」は新年度データの取込用です。左が歳入、中央が一般会計、右が歳出です。
              </div>
              <TrendPanel docs={allDocs} currentYear={year ?? ""} />
            </>
          )}
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
          <a href={`${BP}/admin`}>管理画面（最新データ取込）</a> ・ 思想参考:
          チームみらい「みらい まる見え政治資金」（コードは非流用）
        </p>
      </footer>
    </div>
  );
}

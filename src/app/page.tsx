"use client";

import { useEffect, useState, useCallback } from "react";
import SankeyChart, { formatYen } from "@/components/SankeyChart";
import IndicatorPanel from "@/components/IndicatorPanel";
import TaxBreakdownPanel from "@/components/TaxBreakdownPanel";
import TrendPanel from "@/components/TrendPanel";
import MinistryPanel from "@/components/MinistryPanel";
import type { FlowsDoc, IndexDoc, ModesDoc, Ku23Index } from "@/lib/flows";

type View = "keihi" | "shokan";

const BP = process.env.NEXT_PUBLIC_BASE_PATH || "";

function indexUrl(modeId: string): string {
  if (modeId === "kokka") return `${BP}/data/index.json`;
  if (modeId === "tokyo") return `${BP}/data/index.tokyo.json`;
  return `${BP}/data/index.json`;
}

function flowsUrl(modeId: string, year: string): string {
  if (modeId === "kokka") return `${BP}/data/flows.${year}.json`;
  if (modeId === "tokyo") return `${BP}/data/flows.tokyo.${year}.json`;
  return `${BP}/data/flows.${year}.json`;
}

function downloadCsv(doc: FlowsDoc, label: string) {
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
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${label}_${doc.fiscalYear}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [modesDoc, setModesDoc] = useState<ModesDoc | null>(null);
  const [mode, setMode] = useState<string>("kokka");
  const [error, setError] = useState<string | null>(null);

  // kokka / tokyo 用
  const [index, setIndex] = useState<IndexDoc | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [view, setView] = useState<View>("keihi");
  const [doc, setDoc] = useState<FlowsDoc | null>(null);
  const [ministryDoc, setMinistryDoc] = useState<FlowsDoc | null>(null);
  const [allDocs, setAllDocs] = useState<FlowsDoc[]>([]);

  // ku23 用
  const [ku23Index, setKu23Index] = useState<Ku23Index | null>(null);
  const [wardId, setWardId] = useState<string | null>(null);
  const [wardYear, setWardYear] = useState<string | null>(null);
  const [wardDoc, setWardDoc] = useState<FlowsDoc | null>(null);

  // modes.json を初回ロード
  useEffect(() => {
    fetch(`${BP}/data/modes.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m: ModesDoc | null) => { if (m) setModesDoc(m); })
      .catch(() => {});
  }, []);

  // モード切替: 全状態リセット → 対象 index ロード
  useEffect(() => {
    setIndex(null); setYear(null); setDoc(null);
    setMinistryDoc(null); setAllDocs([]); setView("keihi");
    setKu23Index(null); setWardId(null); setWardYear(null); setWardDoc(null);
    setError(null);

    if (mode === "ku23") {
      fetch(`${BP}/data/index.ku23.json`)
        .then((r) => {
          if (!r.ok) throw new Error("index.ku23.json が見つかりません。npm run build:flows を実行してください。");
          return r.json();
        })
        .then((idx: Ku23Index) => {
          setKu23Index(idx);
          if (idx.wards.length > 0) setWardId(idx.wards[0].id);
        })
        .catch((e) => setError(e.message));
    } else {
      fetch(indexUrl(mode))
        .then((r) => {
          if (!r.ok) throw new Error("index.json が見つかりません。npm run build:flows を実行してください。");
          return r.json();
        })
        .then((idx: IndexDoc) => {
          setIndex(idx);
          setYear(idx.default);
          if (mode === "kokka") {
            Promise.all(idx.years.map((y) => fetch(flowsUrl(mode, y)).then((r) => r.json())))
              .then(setAllDocs)
              .catch(() => {});
          }
        })
        .catch((e) => setError(e.message));
    }
  }, [mode]);

  // kokka/tokyo: 年度変化 → flows ロード
  useEffect(() => {
    if (!year || mode === "ku23") return;
    fetch(flowsUrl(mode, year))
      .then((r) => {
        if (!r.ok) throw new Error(`flows の取得に失敗しました (${year})。`);
        return r.json();
      })
      .then(setDoc)
      .catch((e) => setError(e.message));
  }, [mode, year]);

  // ku23: 区 ID 変化 → 年度セット（デフォルト年度を設定）
  useEffect(() => {
    if (!wardId || !ku23Index) return;
    const info = ku23Index.wards.find((w) => w.id === wardId);
    setWardYear(info?.default ?? null);
    setWardDoc(null);
  }, [wardId, ku23Index]);

  // ku23: 区年度変化 → ward flows ロード
  useEffect(() => {
    if (!wardId || !wardYear) return;
    fetch(`${BP}/data/flows.ku.${wardId}.${wardYear}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`${wardId} (${wardYear}) のデータ取得に失敗しました。`);
        return r.json();
      })
      .then(setWardDoc)
      .catch((e) => setError(e.message));
  }, [wardId, wardYear]);

  // 所管別ビュー（kokka のみ）
  const ministryAvailable = mode === "kokka" && !!(year && index?.ministryYears?.includes(year));
  useEffect(() => {
    if (!ministryAvailable) { setMinistryDoc(null); return; }
    fetch(`${BP}/data/ministry.${year}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setMinistryDoc)
      .catch(() => setMinistryDoc(null));
  }, [year, ministryAvailable]);

  // ─── 表示用 derived state ─────────────────────────────
  const isKu23 = mode === "ku23";
  const isShokan = view === "shokan" && ministryAvailable && !!ministryDoc;
  const activeDoc = isKu23 ? wardDoc : doc;
  const chartDoc = isShokan ? ministryDoc! : activeDoc;

  const activeYears = isKu23
    ? (ku23Index?.wards.find((w) => w.id === wardId)?.years ?? [])
    : (index?.years ?? []);
  const activeYear = isKu23 ? wardYear : year;
  const setActiveYear = useCallback(
    (y: string) => { isKu23 ? setWardYear(y) : setYear(y); },
    [isKu23],
  );

  const currentWardInfo = ku23Index?.wards.find((w) => w.id === wardId);

  const isReady = !!chartDoc && !!activeDoc;
  const isLoading = !isReady && !error;

  return (
    <>
      <div className="crumb-bar">
        <a href="/" title="アプリ一覧へ戻る">🏠 ポータル</a>
        <span className="crumb-sep">›</span>
        <span className="crumb-current">🔍 LENS</span>
      </div>
      <div className="wrap">
      <header className="site">
        <h1>予算まる見え</h1>
        <p className="lede">日本の政府・自治体予算をサンキー図で可視化します。</p>
      </header>

      {/* モードタブ */}
      {modesDoc && modesDoc.modes.length > 1 && (
        <div className="mode-tabs">
          {modesDoc.modes.map((m) => (
            <button
              key={m.id}
              className={mode === m.id ? "on" : ""}
              onClick={() => setMode(m.id)}
              title={m.description}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* 23区 グリッドセレクター */}
      {isKu23 && ku23Index && (
        <div className="ward-grid">
          {ku23Index.wards.map((w) => (
            <button
              key={w.id}
              className={wardId === w.id ? "on" : ""}
              onClick={() => setWardId(w.id)}
              title={`${w.name}：${(w.totalBudget / 100).toLocaleString("ja-JP")}億円`}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}

      {error && <div className="admin-result err">{error}</div>}

      {isReady && (
        <>
          <div className="toolbar">
            {activeYears.length > 1 && (
              <>
                <label htmlFor="year">年度</label>
                <select
                  id="year"
                  value={activeYear ?? ""}
                  onChange={(e) => setActiveYear(e.target.value)}
                >
                  {activeYears.map((y) => (
                    <option key={y} value={y}>{y}年度</option>
                  ))}
                </select>
              </>
            )}

            {activeYears.length === 1 && (
              <span className="toolbar-year">{activeYear}年度</span>
            )}

            {ministryAvailable && (
              <div className="seg">
                <button className={view === "keihi" ? "on" : ""} onClick={() => setView("keihi")}>
                  主要経費別
                </button>
                <button className={view === "shokan" ? "on" : ""} onClick={() => setView("shokan")}>
                  所管別（府省別）
                </button>
              </div>
            )}

            <button onClick={() => downloadCsv(chartDoc!, isShokan ? "shokan" : isKu23 ? `${wardId}_ippan` : `${mode}_ippan`)}>
              CSVダウンロード
            </button>
          </div>

          <div className="meta">
            {isKu23 && currentWardInfo && (
              <span>
                総予算 <b>{formatYen(currentWardInfo.totalBudget)}</b>
              </span>
            )}
            <span>区分 <b>{chartDoc!.type}</b>（{chartDoc!.stage}）</span>
            <span>歳入合計 <b>{formatYen(chartDoc!.totals.income)}</b></span>
            <span>歳出合計 <b>{formatYen(chartDoc!.totals.expense)}</b></span>
            <span>単位 <b>{chartDoc!.unit}</b></span>
          </div>

          {mode === "kokka" && !isShokan && <IndicatorPanel doc={activeDoc!} />}

          {isShokan && (
            <div className="notice">
              所管別（府省別）の配分は<b>暫定の例示値（要検証）</b>です。
            </div>
          )}

          {(mode !== "kokka" || isKu23) && (
            <div className="notice">
              ※ 本データは概算の seed 値です。
              {isKu23 && currentWardInfo
                ? `${currentWardInfo.name}の`
                : mode === "tokyo" ? "東京都の" : ""}
              公式発表値による検証が必要です。
            </div>
          )}

          <div className="chart-card">
            <SankeyChart doc={chartDoc!} />
          </div>

          {isShokan ? (
            <MinistryPanel doc={chartDoc!} />
          ) : mode === "kokka" ? (
            <>
              <TaxBreakdownPanel doc={activeDoc!} />
              <div className="notice">
                国の予算・決算は年次公表のため日次では変わりません。左が歳入、中央が一般会計、右が歳出です。
              </div>
              <TrendPanel docs={allDocs} currentYear={year ?? ""} />
            </>
          ) : null}
        </>
      )}

      {isLoading && <p style={{ color: "var(--muted)" }}>読み込み中…</p>}

      <footer className="site">
        <p>
          出典: {activeDoc?.source ?? "各機関公表資料"}。データ由来: {activeDoc?.origin ?? "seed"}。
        </p>
        <p>
          更新日: {activeDoc ? new Date(activeDoc.updatedAt).toLocaleString("ja-JP") : "—"}。
          本データは {activeDoc?.stage ?? "当初予算"} の区分です。
          <b>「決算（確定値）」と「予算（当初/補正）」は区別</b>して扱ってください。
        </p>
        <p>※ 初版の数値は概算の seed 値であり、各機関公表値による検証前です。</p>
        <p>
          <a href={`${BP}/admin`}>管理画面（最新データ取込）</a> ・ 思想参考:
          チームみらい「みらい まる見え政治資金」（コードは非流用）
        </p>
      </footer>
      </div>
    </>
  );
}

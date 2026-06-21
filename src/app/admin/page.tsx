"use client";

import { useState } from "react";

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function refresh() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/refresh", {
        method: "POST",
        headers: { "x-admin-token": token },
      });
      const json = await res.json();
      if (json.ok) {
        const lines = (json.summaries ?? []).map(
          (s: any) =>
            `  ${s.fiscalYear}年度 [${s.type}/${s.stage}] 由来:${s.origin} ` +
            `歳入=${(s.totals.income / 100).toLocaleString("ja-JP")}億円 ` +
            `歳出=${(s.totals.expense / 100).toLocaleString("ja-JP")}億円`,
        );
        setResult({
          ok: true,
          text:
            `✅ ${json.message}\n年度: ${json.years.join(", ")}\n` +
            lines.join("\n") +
            (json.log ? `\n\n--- ログ ---\n${json.log}` : ""),
        });
      } else {
        setResult({
          ok: false,
          text: `❌ ${json.error}` + (json.log ? `\n\n--- ログ ---\n${json.log}` : ""),
        });
      }
    } catch (e: any) {
      setResult({ ok: false, text: `❌ 通信エラー: ${e?.message ?? e}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <header className="site">
        <h1>管理画面 — 最新データ取込</h1>
        <p className="lede">
          ボタンを押すと e-Stat 探索 → seed 補完 → 正規化・均衡チェック →{" "}
          <code>flows.&lt;年度&gt;.json</code> を再生成します。
        </p>
      </header>

      <div className="notice">
        国の予算・決算は年次公表のため、本ボタンは<b>新年度データの取込用</b>です。
        日次で数値は変わりません。
      </div>

      <div className="toolbar">
        <label htmlFor="tok">ADMIN_TOKEN</label>
        <input
          id="tok"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="x-admin-token"
          style={{ minWidth: 280 }}
        />
        <button onClick={refresh} disabled={busy || !token}>
          {busy ? "取込中…" : "最新データ取込"}
        </button>
      </div>

      {result && (
        <div className={`admin-result ${result.ok ? "ok" : "err"}`}>{result.text}</div>
      )}

      <footer className="site">
        <p>
          <a href="/">← サンキー図に戻る</a>
        </p>
      </footer>
    </div>
  );
}

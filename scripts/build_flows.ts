// データ生成パイプライン（依頼書 §4, §8-3, §9）。
//
//   1) e-Stat API から財政統計を探索・取得（appId があれば。現状は探索ログのみ）
//   2) 取れない/粒度不足は data/seed/*.csv で補完（seed 先行）
//   3) 歳入・歳出を主要経費別に正規化、歳入合計 = 歳出合計 を assert
//   4) public/data/flows.<年度>.json と index.json を書き出し
//
// 実行: npm run build:flows   （= tsx scripts/build_flows.ts）

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FlowsDoc, FlowLink, FlowNode, IndexDoc } from "../src/lib/flows";
import { HUB_ID, HUB_NAME } from "../src/lib/flows";
import { getAppId, searchStatsTables } from "../src/lib/estat";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SEED_DIR = join(ROOT, "data", "seed");
const OUT_DIR = join(ROOT, "public", "data");

interface SeedRow {
  side: "income" | "expense";
  id: string;
  name: string;
  value: number;
}

function parseSeedCsv(text: string): SeedRow[] {
  const rows: SeedRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.toLowerCase().startsWith("side,")) continue; // header
    const [side, id, name, value] = line.split(",").map((s) => s.trim());
    if (side !== "income" && side !== "expense") continue;
    const num = Number(value);
    if (!id || !name || !Number.isFinite(num)) {
      throw new Error(`不正な seed 行: ${line}`);
    }
    rows.push({ side, id, name, value: num });
  }
  return rows;
}

function buildDoc(fiscalYear: string, rows: SeedRow[], origin: FlowsDoc["origin"]): FlowsDoc {
  const incomeRows = rows.filter((r) => r.side === "income");
  const expenseRows = rows.filter((r) => r.side === "expense");

  const incomeTotal = incomeRows.reduce((a, r) => a + r.value, 0);
  const expenseTotal = expenseRows.reduce((a, r) => a + r.value, 0);

  // 均衡チェック（一般会計は歳入合計 = 歳出合計）。
  if (incomeTotal !== expenseTotal) {
    throw new Error(
      `[${fiscalYear}] 歳入合計(${incomeTotal}) ≠ 歳出合計(${expenseTotal})。` +
        ` 差分 ${incomeTotal - expenseTotal}（seed の其他で調整してください）。`,
    );
  }

  const nodes: FlowNode[] = [
    ...incomeRows.map((r) => ({ id: r.id, name: r.name, side: "income" as const })),
    { id: HUB_ID, name: HUB_NAME, side: "hub" as const },
    ...expenseRows.map((r) => ({ id: r.id, name: r.name, side: "expense" as const })),
  ];

  const links: FlowLink[] = [
    ...incomeRows.map((r) => ({ source: r.id, target: HUB_ID, value: r.value })),
    ...expenseRows.map((r) => ({ source: HUB_ID, target: r.id, value: r.value })),
  ];

  return {
    fiscalYear,
    unit: "百万円",
    source: "財務省 / e-Stat（一般会計 当初予算）",
    type: "予算",
    stage: "当初予算（seed・要検証）",
    updatedAt: new Date().toISOString(),
    origin,
    totals: { income: incomeTotal, expense: expenseTotal },
    nodes,
    links,
  };
}

async function probeEstat() {
  const appId = getAppId();
  if (!appId) {
    console.log("[e-Stat] ESTAT_APP_ID 未設定 → seed CSV のみで生成します。");
    return;
  }
  try {
    console.log("[e-Stat] 統計表を探索中: searchWord='一般会計 歳出 主要経費'");
    const hits = await searchStatsTables("一般会計 歳出 主要経費", appId);
    console.log(`[e-Stat] 候補 ${hits.length} 件:`);
    for (const h of hits.slice(0, 15)) {
      console.log(`  - ${h.id}  ${h.title}  (${h.govOrg ?? ""} ${h.surveyDate ?? ""})`);
    }
    console.log(
      "[e-Stat] ※ 該当表の特定と getStatsData 正規化は次段で実装。今回は seed を使用。",
    );
  } catch (e) {
    console.warn(`[e-Stat] 探索失敗（seed にフォールバック）: ${(e as Error).message}`);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  await probeEstat();

  const seedFiles = readdirSync(SEED_DIR).filter((f) => /^ippan_kaikei_\d{4}\.csv$/.test(f));
  if (seedFiles.length === 0) throw new Error(`seed CSV が見つかりません: ${SEED_DIR}`);

  const years: string[] = [];
  for (const file of seedFiles) {
    const fiscalYear = file.match(/(\d{4})/)![1];
    const rows = parseSeedCsv(readFileSync(join(SEED_DIR, file), "utf8"));
    const doc = buildDoc(fiscalYear, rows, "seed");
    writeFileSync(join(OUT_DIR, `flows.${fiscalYear}.json`), JSON.stringify(doc, null, 2));
    years.push(fiscalYear);
    const oku = (doc.totals.income / 100).toLocaleString("ja-JP", { maximumFractionDigits: 0 });
    console.log(`[build] flows.${fiscalYear}.json 生成 (歳入=歳出=${oku} 億円)`);
  }

  years.sort((a, b) => Number(b) - Number(a)); // 降順
  const index: IndexDoc = {
    years,
    default: years[0],
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2));
  console.log(`[build] index.json 生成 (年度: ${years.join(", ")})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

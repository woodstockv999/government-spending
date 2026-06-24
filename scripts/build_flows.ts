// データ生成パイプライン。
//
//   1) e-Stat API から財政統計を探索・取得（appId があれば。現状は探索ログのみ）
//   2) 取れない/粒度不足は data/seed/*.csv で補完（seed 先行）
//   3) 各モード（国・東京都・台東区等）の歳入・歳出を正規化し JSON を生成
//   4) public/data/ に flows.*.json / index.*.json / modes.json を書き出し
//
// 実行: npm run build:flows   （= tsx scripts/build_flows.ts）

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FlowsDoc, FlowLink, FlowNode, IndexDoc, ModesDoc, ModeInfo } from "../src/lib/flows";
import { HUB_ID } from "../src/lib/flows";
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

interface ModeConfig {
  id: string;
  label: string;
  description: string;
  hubName: string;
  /** seed ファイル名の正規表現。captures[1] = year */
  seedPattern: RegExp;
  /** 所管別ビューの seed ファイル名パターン（省略可） */
  shokanPattern?: RegExp;
  source: string;
  stage: string;
}

const MODES: ModeConfig[] = [
  {
    id: "kokka",
    label: "国（一般会計）",
    description: "日本国の一般会計",
    hubName: "一般会計",
    seedPattern: /^ippan_kaikei_(\d{4})\.csv$/,
    shokanPattern: /^shokan_(\d{4})\.csv$/,
    source: "財務省 / e-Stat（一般会計 当初予算）",
    stage: "当初予算（seed・要検証）",
  },
  {
    id: "tokyo",
    label: "東京都",
    description: "東京都の一般会計",
    hubName: "東京都一般会計",
    seedPattern: /^tokyo_(\d{4})\.csv$/,
    source: "東京都（一般会計 当初予算・概算）",
    stage: "当初予算（seed・要検証）",
  },
  {
    id: "taito",
    label: "台東区",
    description: "台東区（東京23区）の一般会計",
    hubName: "台東区一般会計",
    seedPattern: /^taito_(\d{4})\.csv$/,
    source: "台東区（一般会計 当初予算・概算）",
    stage: "当初予算（seed・要検証）",
  },
];

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

function buildDoc(
  fiscalYear: string,
  rows: SeedRow[],
  origin: FlowsDoc["origin"],
  hubName: string,
  meta?: Partial<Pick<FlowsDoc, "source" | "stage">>,
): FlowsDoc {
  const incomeRows = rows.filter((r) => r.side === "income");
  const expenseRows = rows.filter((r) => r.side === "expense");

  const incomeTotal = incomeRows.reduce((a, r) => a + r.value, 0);
  const expenseTotal = expenseRows.reduce((a, r) => a + r.value, 0);

  if (incomeTotal !== expenseTotal) {
    throw new Error(
      `[${fiscalYear}] 歳入合計(${incomeTotal}) ≠ 歳出合計(${expenseTotal})。` +
        ` 差分 ${incomeTotal - expenseTotal}（seed の其他で調整してください）。`,
    );
  }

  const nodes: FlowNode[] = [
    ...incomeRows.map((r) => ({ id: r.id, name: r.name, side: "income" as const })),
    { id: HUB_ID, name: hubName, side: "hub" as const },
    ...expenseRows.map((r) => ({ id: r.id, name: r.name, side: "expense" as const })),
  ];

  const links: FlowLink[] = [
    ...incomeRows.map((r) => ({ source: r.id, target: HUB_ID, value: r.value })),
    ...expenseRows.map((r) => ({ source: HUB_ID, target: r.id, value: r.value })),
  ];

  return {
    fiscalYear,
    unit: "百万円",
    source: meta?.source ?? "財務省 / e-Stat（一般会計 当初予算）",
    type: "予算",
    stage: meta?.stage ?? "当初予算（seed・要検証）",
    updatedAt: new Date().toISOString(),
    origin,
    totals: { income: incomeTotal, expense: expenseTotal },
    nodes,
    links,
  };
}

/** モードの index ファイル名（kokka は後方互換のため index.json）。 */
function indexFilename(modeId: string): string {
  return modeId === "kokka" ? "index.json" : `index.${modeId}.json`;
}

/** モードの flows ファイル名（kokka は後方互換のため flows.<year>.json）。 */
function flowsFilename(modeId: string, year: string): string {
  return modeId === "kokka" ? `flows.${year}.json` : `flows.${modeId}.${year}.json`;
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

async function buildMode(mode: ModeConfig): Promise<{ years: string[]; ministryYears: string[] }> {
  const seedFiles = readdirSync(SEED_DIR).filter((f) => mode.seedPattern.test(f));
  if (seedFiles.length === 0) {
    console.log(`[${mode.id}] seed CSV が見つかりません → スキップ`);
    return { years: [], ministryYears: [] };
  }

  const years: string[] = [];
  const ministryYears: string[] = [];

  for (const file of seedFiles) {
    const fiscalYear = file.match(mode.seedPattern)![1];
    const rows = parseSeedCsv(readFileSync(join(SEED_DIR, file), "utf8"));
    const doc = buildDoc(fiscalYear, rows, "seed", mode.hubName, {
      source: mode.source,
      stage: mode.stage,
    });

    const outFile = flowsFilename(mode.id, fiscalYear);
    writeFileSync(join(OUT_DIR, outFile), JSON.stringify(doc, null, 2));
    years.push(fiscalYear);
    const oku = (doc.totals.income / 100).toLocaleString("ja-JP", { maximumFractionDigits: 0 });
    console.log(`[${mode.id}] ${outFile} 生成 (歳入=歳出=${oku} 億円)`);

    // 所管別（kokka のみ）
    if (mode.shokanPattern) {
      const shokanPath = join(SEED_DIR, `shokan_${fiscalYear}.csv`);
      if (existsSync(shokanPath)) {
        const incomeRows = rows.filter((r) => r.side === "income");
        const ministryRows = parseSeedCsv(readFileSync(shokanPath, "utf8")).filter(
          (r) => r.side === "expense",
        );
        const mdoc = buildDoc(fiscalYear, [...incomeRows, ...ministryRows], "seed", mode.hubName, {
          source: "財務省（一般会計 所管別歳出・暫定の例示値）",
          stage: "当初予算（所管別・暫定の例示値・要検証）",
        });
        writeFileSync(join(OUT_DIR, `ministry.${fiscalYear}.json`), JSON.stringify(mdoc, null, 2));
        ministryYears.push(fiscalYear);
        console.log(`[${mode.id}] ministry.${fiscalYear}.json 生成 (所管 ${ministryRows.length} 件)`);
      }
    }
  }

  years.sort((a, b) => Number(b) - Number(a));
  ministryYears.sort((a, b) => Number(b) - Number(a));

  const index: IndexDoc = {
    years,
    default: years[0],
    ministryYears: ministryYears.length > 0 ? ministryYears : undefined,
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(join(OUT_DIR, indexFilename(mode.id)), JSON.stringify(index, null, 2));
  console.log(`[${mode.id}] ${indexFilename(mode.id)} 生成 (年度: ${years.join(", ")})`);

  return { years, ministryYears };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  await probeEstat();

  const activeModes: ModeInfo[] = [];

  for (const mode of MODES) {
    const { years } = await buildMode(mode);
    if (years.length > 0) {
      activeModes.push({ id: mode.id, label: mode.label, description: mode.description });
    }
  }

  const modesDoc: ModesDoc = {
    modes: activeModes,
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(join(OUT_DIR, "modes.json"), JSON.stringify(modesDoc, null, 2));
  console.log(`[build] modes.json 生成 (モード: ${activeModes.map((m) => m.id).join(", ")})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

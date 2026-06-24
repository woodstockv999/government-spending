// データ生成パイプライン。
//
//   1) e-Stat API から財政統計を探索・取得（appId があれば。現状は探索ログのみ）
//   2) 取れない/粒度不足は seed 定義で補完（seed 先行）
//   3) 各モード（国・東京都・東京23区）の歳入・歳出を正規化し JSON を生成
//   4) public/data/ に flows.*.json / index.*.json / modes.json を書き出し
//
// 実行: npm run build:flows   （= tsx scripts/build_flows.ts）

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  FlowsDoc, FlowLink, FlowNode, IndexDoc,
  ModesDoc, ModeInfo, WardInfo, Ku23Index,
} from "../src/lib/flows";
import { HUB_ID } from "../src/lib/flows";
import { getAppId, searchStatsTables } from "../src/lib/estat";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SEED_DIR = join(ROOT, "data", "seed");
const OUT_DIR = join(ROOT, "public", "data");

// ─── 共通型・関数 ──────────────────────────────────────────

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
    if (line.toLowerCase().startsWith("side,")) continue;
    const [side, id, name, value] = line.split(",").map((s) => s.trim());
    if (side !== "income" && side !== "expense") continue;
    const num = Number(value);
    if (!id || !name || !Number.isFinite(num)) throw new Error(`不正な seed 行: ${line}`);
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
        ` 差分 ${incomeTotal - expenseTotal}`,
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

// ─── 国（一般会計）モード ──────────────────────────────────

async function probeEstat() {
  const appId = getAppId();
  if (!appId) {
    console.log("[e-Stat] ESTAT_APP_ID 未設定 → seed で生成します。");
    return;
  }
  try {
    const hits = await searchStatsTables("一般会計 歳出 主要経費", appId);
    console.log(`[e-Stat] 候補 ${hits.length} 件:`);
    for (const h of hits.slice(0, 10)) {
      console.log(`  - ${h.id}  ${h.title}  (${h.govOrg ?? ""} ${h.surveyDate ?? ""})`);
    }
  } catch (e) {
    console.warn(`[e-Stat] 探索失敗: ${(e as Error).message}`);
  }
}

async function buildKokkaMode(): Promise<boolean> {
  const seedFiles = readdirSync(SEED_DIR).filter((f) => /^ippan_kaikei_\d{4}\.csv$/.test(f));
  if (seedFiles.length === 0) return false;

  const years: string[] = [];
  const ministryYears: string[] = [];

  for (const file of seedFiles) {
    const fiscalYear = file.match(/(\d{4})/)![1];
    const rows = parseSeedCsv(readFileSync(join(SEED_DIR, file), "utf8"));
    const doc = buildDoc(fiscalYear, rows, "seed", "一般会計", {
      source: "財務省 / e-Stat（一般会計 当初予算）",
      stage: "当初予算（seed・要検証）",
    });
    writeFileSync(join(OUT_DIR, `flows.${fiscalYear}.json`), JSON.stringify(doc, null, 2));
    years.push(fiscalYear);
    const oku = (doc.totals.income / 100).toLocaleString("ja-JP", { maximumFractionDigits: 0 });
    console.log(`[kokka] flows.${fiscalYear}.json 生成 (${oku}億円)`);

    const shokanPath = join(SEED_DIR, `shokan_${fiscalYear}.csv`);
    if (existsSync(shokanPath)) {
      const incomeRows = rows.filter((r) => r.side === "income");
      const ministryRows = parseSeedCsv(readFileSync(shokanPath, "utf8")).filter(
        (r) => r.side === "expense",
      );
      const mdoc = buildDoc(fiscalYear, [...incomeRows, ...ministryRows], "seed", "一般会計", {
        source: "財務省（一般会計 所管別歳出・暫定の例示値）",
        stage: "当初予算（所管別・暫定の例示値・要検証）",
      });
      writeFileSync(join(OUT_DIR, `ministry.${fiscalYear}.json`), JSON.stringify(mdoc, null, 2));
      ministryYears.push(fiscalYear);
      console.log(`[kokka] ministry.${fiscalYear}.json 生成 (所管 ${ministryRows.length} 件)`);
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
  writeFileSync(join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2));
  console.log(`[kokka] index.json 生成 (年度: ${years.join(", ")})`);
  return true;
}

// ─── 東京都モード ─────────────────────────────────────────

async function buildTokyoMode(): Promise<boolean> {
  const seedFiles = readdirSync(SEED_DIR).filter((f) => /^tokyo_\d{4}\.csv$/.test(f));
  if (seedFiles.length === 0) return false;

  const years: string[] = [];
  for (const file of seedFiles) {
    const fiscalYear = file.match(/(\d{4})/)![1];
    const rows = parseSeedCsv(readFileSync(join(SEED_DIR, file), "utf8"));
    const doc = buildDoc(fiscalYear, rows, "seed", "東京都一般会計", {
      source: "東京都（一般会計 当初予算・概算）",
      stage: "当初予算（seed・要検証）",
    });
    writeFileSync(join(OUT_DIR, `flows.tokyo.${fiscalYear}.json`), JSON.stringify(doc, null, 2));
    years.push(fiscalYear);
    const oku = (doc.totals.income / 100).toLocaleString("ja-JP", { maximumFractionDigits: 0 });
    console.log(`[tokyo] flows.tokyo.${fiscalYear}.json 生成 (${oku}億円)`);
  }
  years.sort((a, b) => Number(b) - Number(a));
  const index: IndexDoc = { years, default: years[0], generatedAt: new Date().toISOString() };
  writeFileSync(join(OUT_DIR, "index.tokyo.json"), JSON.stringify(index, null, 2));
  console.log(`[tokyo] index.tokyo.json 生成 (年度: ${years.join(", ")})`);
  return true;
}

// ─── 東京23区モード ──────────────────────────────────────

// 年度ごとの予算データ（歳出入比率は年度をまたいで同一とする）
interface WardYearData {
  total: number;  // 百万円
  taxRate: number; // 特別区税 / total
  adjRate: number; // 財政調整交付金 / total
}

interface WardProfile {
  id: string;
  name: string;
  // キーは会計年度（降順で記載すること → index の years も降順になる）
  yearData: Record<string, WardYearData>;
}

// 固定比率: 国庫支出金 17%, 都支出金 8%, 特別区債 4%, その他 = 残り
// 歳出固定: 民生費 50%, 教育費 14%, 土木費 10%, 総務費 10%, 衛生費 7%, 産業経済費 3%, その他 = 残り
const WARDS: WardProfile[] = [
  // 区コード順（特別区協議会 標準順序）
  { id: "chiyoda",    name: "千代田区",  yearData: { "2025": { total:  91000, taxRate: 0.30, adjRate: 0.28 }, "2024": { total:  85000, taxRate: 0.30, adjRate: 0.28 } } },
  { id: "chuo",       name: "中央区",    yearData: { "2025": { total: 113000, taxRate: 0.27, adjRate: 0.33 }, "2024": { total: 107000, taxRate: 0.27, adjRate: 0.33 } } },
  { id: "minato",     name: "港区",      yearData: { "2025": { total: 261000, taxRate: 0.39, adjRate: 0.18 }, "2024": { total: 247000, taxRate: 0.39, adjRate: 0.18 } } },
  { id: "shinjuku",   name: "新宿区",    yearData: { "2025": { total: 173000, taxRate: 0.25, adjRate: 0.37 }, "2024": { total: 167000, taxRate: 0.25, adjRate: 0.37 } } },
  { id: "bunkyo",     name: "文京区",    yearData: { "2025": { total: 117000, taxRate: 0.26, adjRate: 0.36 }, "2024": { total: 113000, taxRate: 0.26, adjRate: 0.36 } } },
  { id: "taito",      name: "台東区",    yearData: { "2025": { total: 139000, taxRate: 0.26, adjRate: 0.41 }, "2024": { total: 134000, taxRate: 0.26, adjRate: 0.41 } } },
  { id: "sumida",     name: "墨田区",    yearData: { "2025": { total: 135000, taxRate: 0.22, adjRate: 0.45 }, "2024": { total: 131000, taxRate: 0.22, adjRate: 0.45 } } },
  { id: "koto",       name: "江東区",    yearData: { "2025": { total: 226000, taxRate: 0.23, adjRate: 0.44 }, "2024": { total: 217000, taxRate: 0.23, adjRate: 0.44 } } },
  { id: "shinagawa",  name: "品川区",    yearData: { "2025": { total: 184000, taxRate: 0.27, adjRate: 0.35 }, "2024": { total: 177000, taxRate: 0.27, adjRate: 0.35 } } },
  { id: "meguro",     name: "目黒区",    yearData: { "2025": { total: 141000, taxRate: 0.28, adjRate: 0.33 }, "2024": { total: 137000, taxRate: 0.28, adjRate: 0.33 } } },
  { id: "ota",        name: "大田区",    yearData: { "2025": { total: 267000, taxRate: 0.24, adjRate: 0.43 }, "2024": { total: 258000, taxRate: 0.24, adjRate: 0.43 } } },
  { id: "setagaya",   name: "世田谷区",  yearData: { "2025": { total: 349000, taxRate: 0.25, adjRate: 0.40 }, "2024": { total: 337000, taxRate: 0.25, adjRate: 0.40 } } },
  { id: "shibuya",    name: "渋谷区",    yearData: { "2025": { total: 157000, taxRate: 0.33, adjRate: 0.27 }, "2024": { total: 150000, taxRate: 0.33, adjRate: 0.27 } } },
  { id: "nakano",     name: "中野区",    yearData: { "2025": { total: 141000, taxRate: 0.24, adjRate: 0.43 }, "2024": { total: 137000, taxRate: 0.24, adjRate: 0.43 } } },
  { id: "suginami",   name: "杉並区",    yearData: { "2025": { total: 204000, taxRate: 0.27, adjRate: 0.38 }, "2024": { total: 197000, taxRate: 0.27, adjRate: 0.38 } } },
  { id: "toshima",    name: "豊島区",    yearData: { "2025": { total: 129000, taxRate: 0.24, adjRate: 0.42 }, "2024": { total: 124000, taxRate: 0.24, adjRate: 0.42 } } },
  { id: "kita",       name: "北区",      yearData: { "2025": { total: 169000, taxRate: 0.21, adjRate: 0.46 }, "2024": { total: 164000, taxRate: 0.21, adjRate: 0.46 } } },
  { id: "arakawa",    name: "荒川区",    yearData: { "2025": { total:  97000, taxRate: 0.20, adjRate: 0.47 }, "2024": { total:  94000, taxRate: 0.20, adjRate: 0.47 } } },
  { id: "itabashi",   name: "板橋区",    yearData: { "2025": { total: 214000, taxRate: 0.21, adjRate: 0.46 }, "2024": { total: 207000, taxRate: 0.21, adjRate: 0.46 } } },
  { id: "nerima",     name: "練馬区",    yearData: { "2025": { total: 269000, taxRate: 0.22, adjRate: 0.44 }, "2024": { total: 260000, taxRate: 0.22, adjRate: 0.44 } } },
  { id: "adachi",     name: "足立区",    yearData: { "2025": { total: 298000, taxRate: 0.18, adjRate: 0.48 }, "2024": { total: 288000, taxRate: 0.18, adjRate: 0.48 } } },
  { id: "katsushika", name: "葛飾区",    yearData: { "2025": { total: 192000, taxRate: 0.19, adjRate: 0.48 }, "2024": { total: 185000, taxRate: 0.19, adjRate: 0.48 } } },
  { id: "edogawa",    name: "江戸川区",  yearData: { "2025": { total: 288000, taxRate: 0.19, adjRate: 0.47 }, "2024": { total: 278000, taxRate: 0.19, adjRate: 0.47 } } },
];

function buildWardDoc(
  id: string,
  name: string,
  data: WardYearData,
  fiscalYear: string,
): FlowsDoc {
  const { total, taxRate, adjRate } = data;
  const r = Math.round;

  // 歳入
  const kuzei    = r(total * taxRate);
  const fufu     = r(total * adjRate);
  const kokko    = r(total * 0.17);
  const toshibu  = r(total * 0.08);
  const saiken   = r(total * 0.04);
  const iother   = total - kuzei - fufu - kokko - toshibu - saiken;

  // 歳出
  const minsei   = r(total * 0.50);
  const kyoiku   = r(total * 0.14);
  const doboku   = r(total * 0.10);
  const somu     = r(total * 0.10);
  const eisei    = r(total * 0.07);
  const sangyo   = r(total * 0.03);
  const eother   = total - minsei - kyoiku - doboku - somu - eisei - sangyo;

  const era = fiscalYear === "2025" ? "令和7年度" : fiscalYear === "2024" ? "令和6年度" : `${fiscalYear}年度`;

  const rows: SeedRow[] = [
    { side: "income",  id: `${id}_kuzei`,   name: "特別区税",              value: kuzei   },
    { side: "income",  id: `${id}_fufu`,    name: "財政調整交付金",         value: fufu    },
    { side: "income",  id: `${id}_kokko`,   name: "国庫支出金",             value: kokko   },
    { side: "income",  id: `${id}_toshibu`, name: "都支出金",               value: toshibu },
    { side: "income",  id: `${id}_saiken`,  name: "特別区債",               value: saiken  },
    { side: "income",  id: `${id}_iother`,  name: "その他収入",             value: iother  },
    { side: "expense", id: `${id}_minsei`,  name: "民生費（福祉・生活保護）", value: minsei  },
    { side: "expense", id: `${id}_kyoiku`,  name: "教育費",                 value: kyoiku  },
    { side: "expense", id: `${id}_doboku`,  name: "土木費",                 value: doboku  },
    { side: "expense", id: `${id}_somu`,    name: "総務費",                 value: somu    },
    { side: "expense", id: `${id}_eisei`,   name: "衛生費",                 value: eisei   },
    { side: "expense", id: `${id}_sangyo`,  name: "産業経済費",             value: sangyo  },
    { side: "expense", id: `${id}_eother`,  name: "その他",                 value: eother  },
  ];

  return buildDoc(fiscalYear, rows, "seed", `${name}一般会計`, {
    source: `${name}「${era}当初予算」（概算・seed値）`,
    stage: "当初予算（seed・要検証）",
  });
}

function buildKu23Mode(): boolean {
  const wardInfos: WardInfo[] = [];

  for (const ward of WARDS) {
    const years = Object.keys(ward.yearData).sort((a, b) => Number(b) - Number(a)); // 降順
    for (const fiscalYear of years) {
      const data = ward.yearData[fiscalYear];
      const doc = buildWardDoc(ward.id, ward.name, data, fiscalYear);
      const outFile = `flows.ku.${ward.id}.${fiscalYear}.json`;
      writeFileSync(join(OUT_DIR, outFile), JSON.stringify(doc, null, 2));
      const oku = (data.total / 100).toLocaleString("ja-JP", { maximumFractionDigits: 0 });
      console.log(`[ku23] ${outFile} 生成 (${ward.name} ${fiscalYear}年度 ${oku}億円)`);
    }
    const defaultYear = years[0]; // 最新年度
    wardInfos.push({
      id: ward.id,
      name: ward.name,
      years,
      default: defaultYear,
      totalBudget: ward.yearData[defaultYear].total,
    });
  }

  const ku23Index: Ku23Index = { wards: wardInfos, generatedAt: new Date().toISOString() };
  writeFileSync(join(OUT_DIR, "index.ku23.json"), JSON.stringify(ku23Index, null, 2));
  console.log(`[ku23] index.ku23.json 生成 (${wardInfos.length}区)`);
  return true;
}

// ─── エントリポイント ─────────────────────────────────────

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  await probeEstat();

  const activeModes: ModeInfo[] = [];

  if (await buildKokkaMode()) {
    activeModes.push({ id: "kokka", label: "国（一般会計）", description: "日本国の一般会計" });
  }
  if (await buildTokyoMode()) {
    activeModes.push({ id: "tokyo", label: "東京都", description: "東京都の一般会計" });
  }
  if (buildKu23Mode()) {
    activeModes.push({ id: "ku23", label: "東京23区", description: "東京都特別区（23区）の一般会計" });
  }

  const modesDoc: ModesDoc = { modes: activeModes, generatedAt: new Date().toISOString() };
  writeFileSync(join(OUT_DIR, "modes.json"), JSON.stringify(modesDoc, null, 2));
  console.log(`[build] modes.json 生成 (モード: ${activeModes.map((m) => m.id).join(", ")})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

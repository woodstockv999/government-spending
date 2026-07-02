// 他国の政府財政（対GDP比）比較データの生成。
//
// data/seed/intl_gov_finance.json（IMF DataMapper API から取得した値をそのまま格納した
// seed。取得手順・出典・ライセンスは同ファイル内の source/sourceUrl/license 参照）を読み、
// generatedAt を付与して public/data/intl.json に書き出す。
//
// 実行: npm run build:flows （= build_flows.ts の後段で自動実行される）

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { IntlDoc } from "../src/lib/intl";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SEED_PATH = join(ROOT, "data", "seed", "intl_gov_finance.json");
const OUT_DIR = join(ROOT, "public", "data");

function main() {
  const seed: IntlDoc = JSON.parse(readFileSync(SEED_PATH, "utf8"));
  const doc: IntlDoc & { generatedAt: string } = {
    ...seed,
    generatedAt: new Date().toISOString(),
  };

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "intl.json"), JSON.stringify(doc, null, 2) + "\n");
  console.log(`[build_intl] public/data/intl.json を生成しました（${doc.countries.length}カ国）。`);
}

main();

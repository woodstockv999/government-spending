import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

// 他国の政府財政（対GDP比）比較データ。public/data/intl.json をそのまま返す。
// データ出典: IMF DataMapper API（詳細は intl.json 内の source/license を参照）。
export async function GET() {
  try {
    const raw = await readFile(
      join(process.cwd(), "public", "data", "intl.json"),
      "utf8",
    );
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      { error: "intl.json の読み込みに失敗しました。" },
      { status: 500 },
    );
  }
}

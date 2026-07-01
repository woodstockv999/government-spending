import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = process.cwd();

let refreshInProgress = false;

function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { cwd: ROOT, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) reject(Object.assign(err, { stdout, stderr }));
        else resolve({ stdout, stderr });
      },
    );
  });
}

export async function POST(req: Request) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "サーバに ADMIN_TOKEN が設定されていません（.env.local）。" },
      { status: 500 },
    );
  }
  const token = req.headers.get("x-admin-token");
  if (token !== expected) {
    return NextResponse.json({ ok: false, error: "認証に失敗しました。" }, { status: 401 });
  }

  if (refreshInProgress) {
    return NextResponse.json({ ok: false, error: "refresh already in progress" }, { status: 409 });
  }
  refreshInProgress = true;

  try {
    // e-Stat 探索 → seed 補完 → 正規化・均衡チェック → JSON 再生成。
    const { stdout, stderr } = await run("npm", ["run", "build:flows", "--silent"]);

    const idxRaw = await readFile(join(ROOT, "public", "data", "index.json"), "utf8");
    const index = JSON.parse(idxRaw);

    const summaries: any[] = [];
    for (const y of index.years as string[]) {
      const raw = await readFile(join(ROOT, "public", "data", `flows.${y}.json`), "utf8");
      const d = JSON.parse(raw);
      summaries.push({
        fiscalYear: d.fiscalYear,
        type: d.type,
        stage: d.stage,
        origin: d.origin,
        source: d.source,
        updatedAt: d.updatedAt,
        totals: d.totals,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "flows.json を再生成しました。",
      years: index.years,
      summaries,
      log: (stdout + (stderr ? "\n" + stderr : "")).trim(),
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message ?? "build:flows の実行に失敗しました。",
        log: ((e?.stdout ?? "") + "\n" + (e?.stderr ?? "")).trim(),
      },
      { status: 500 },
    );
  } finally {
    refreshInProgress = false;
  }
}

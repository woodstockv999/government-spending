// e-Stat API 3.0 クライアント（政府統計の総合窓口）。
//
// 方針（依頼書 §5.1）:
//  - statsDataId はハードコードしない。getStatsList を searchWord で叩いて
//    該当統計表IDを動的に探索・ログ出力してから getStatsData を呼ぶ。
//  - ESTAT_APP_ID が未設定なら null を返し、呼び出し側は seed CSV にフォール
//    バックする（seed 先行ビルドを成立させるため）。
//
// 現状: 探索ヘルパーまで実装。財政統計表の列構造は改定で変わり得るため、
// getStatsData の正規化は表を特定してから実装する段階構成とする。

const BASE = "https://api.e-stat.go.jp/rest/3.0/app/json";

export function getAppId(): string | null {
  const id = process.env.ESTAT_APP_ID?.trim();
  return id ? id : null;
}

export interface StatsTableHit {
  id: string;
  title: string;
  surveyDate?: string;
  govOrg?: string;
}

/** getStatsList を searchWord で叩いて統計表候補を返す（探索＋ログ用）。 */
export async function searchStatsTables(
  searchWord: string,
  appId = getAppId(),
): Promise<StatsTableHit[]> {
  if (!appId) return [];
  const url =
    `${BASE}/getStatsList?appId=${encodeURIComponent(appId)}` +
    `&searchWord=${encodeURIComponent(searchWord)}&limit=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`e-Stat getStatsList HTTP ${res.status}`);
  const json: any = await res.json();
  const result = json?.GET_STATS_LIST?.RESULT;
  if (result && result.STATUS !== 0) {
    throw new Error(`e-Stat error ${result.STATUS}: ${result.ERROR_MSG}`);
  }
  const tables = json?.GET_STATS_LIST?.DATALIST_INF?.TABLE_INF ?? [];
  const arr = Array.isArray(tables) ? tables : [tables];
  return arr.filter(Boolean).map((t: any) => ({
    id: String(t["@id"]),
    title:
      typeof t.TITLE === "object" ? t.TITLE?.$ ?? "" : String(t.TITLE ?? ""),
    surveyDate: t.SURVEY_DATE ? String(t.SURVEY_DATE) : undefined,
    govOrg:
      typeof t.GOV_ORG === "object"
        ? t.GOV_ORG?.$ ?? ""
        : t.GOV_ORG
          ? String(t.GOV_ORG)
          : undefined,
  }));
}

/** getStatsData の生レスポンスを取得（正規化は表特定後に実装）。 */
export async function getStatsData(
  statsDataId: string,
  appId = getAppId(),
): Promise<any | null> {
  if (!appId) return null;
  const url =
    `${BASE}/getStatsData?appId=${encodeURIComponent(appId)}` +
    `&statsDataId=${encodeURIComponent(statsDataId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`e-Stat getStatsData HTTP ${res.status}`);
  return res.json();
}

# government-spending — 国家予算まる見え (marumie-jp)

日本国の**一般会計（歳入 → 一般会計 → 歳出）**の流れをサンキー図で可視化する軽量 Web アプリ。
チームみらい「みらい まる見え政治資金」の見せ方の思想のみを参考にした**独自実装**です
（[team-mirai-volunteer/marumie](https://github.com/team-mirai-volunteer/marumie) は AGPL v3。**コードは非流用**）。

- **DBなし**・静的JSON・**軽量**（Next.js 15 App Router + TypeScript）
- データ源：**e-Stat API**（主）＋ **財務省公表値の seed CSV**（副・フォールバック）
- 管理画面の**「最新データ取込」ボタン**で再取得 → `flows.json` 再生成

## クイックスタート
```bash
npm install
cp .env.example .env.local   # ADMIN_TOKEN を設定（openssl rand -hex 32）
npm run build:flows          # seed/e-Stat → public/data/flows.<年度>.json
npm run build && npm start    # http://localhost:3001
```

## データの流れ
```
data/seed/ippan_kaikei_<年度>.csv ──┐
                                    ├─ scripts/build_flows.ts ─→ public/data/flows.<年度>.json + index.json
e-Stat API（ESTAT_APP_ID があれば）─┘            （歳入合計 = 歳出合計 を assert）
```
- 表示用 JSON は git 管理外。常に seed / e-Stat から再生成する。
- e-Stat は `getStatsList` で統計表IDを**動的探索**してから `getStatsData`（ID直書き禁止）。

## 環境変数（`.env.local`／git管理外）
| 変数 | 用途 |
|------|------|
| `ESTAT_APP_ID` | e-Stat アプリID（未設定なら seed のみ） |
| `ADMIN_TOKEN` | `POST /api/admin/refresh` の保護シークレット |
| `PORT` | 既定 3001（briefing-bot 3000 と非衝突） |

## データの注意（重要）
- 初版 seed の数値は**概算・要検証**。財務省公表値 / e-Stat で確定すること。
- `type`（予算/決算）と `stage`（当初/補正/速報/確定）を**区別**。混同しない。
- 単位は `unit`（百万円）。表示時に億・兆へ整形。
- 明細（個別契約・支出先）レベルは初版スコープ外。
- 予算・決算は**年次公表**。「最新データ取込」は新年度データ取込用（リアルタイム更新ではない）。

## デプロイ（PM2）
```bash
pm2 start ecosystem.config.js && pm2 save
```
詳細・運用メモは [CLAUDE.md](CLAUDE.md) を参照。

## ライセンス / 出典
- 出典：財務省「毎年度の予算・決算」「日本の財政関係資料」、e-Stat（政府統計の総合窓口）
- 思想参考：チームみらい marumie（コード非流用）

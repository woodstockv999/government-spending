# marumie-jp — 国家予算まる見え

日本国の**一般会計（歳入 → 一般会計 → 歳出）**をサンキー図で可視化する軽量 Web アプリ。
チームみらい「みらい まる見え政治資金」の見せ方の思想のみを参考にした**独自実装**
（AGPL コードは非流用）。DB なし・静的 JSON・PM2 常駐。

## 稼働構成（このサーバ）
- 配置: `/home/w00dst0ck/marumie-jp`（root 権限が無いため `/opt` ではなくホーム）
- ポート: **3001**（briefing-bot=3000 と非衝突）
- 公開URL: http://210.131.212.62:3001/ （管理画面: `/admin`）
- プロセス: ユーザ `w00dst0ck` の PM2、プロセス名 `marumie-jp`（`pm2 save` 済み）

## データの流れ
```
data/seed/ippan_kaikei_<年度>.csv  ──┐
                                     ├─ scripts/build_flows.ts ─→ public/data/flows.<年度>.json + index.json
e-Stat API（ESTAT_APP_ID があれば）──┘            （歳入合計 = 歳出合計 を assert）
```
- 表示用 JSON は git 管理外（`.gitignore`）。常に seed/e-Stat から再生成する。
- e-Stat は `getStatsList` で統計表IDを**動的探索**してから `getStatsData`（ID 直書き禁止）。
  現状は探索ログまで実装し、数値は seed CSV を使用（seed 先行）。

## よく使うコマンド
```bash
npm run build:flows   # seed/e-Stat → flows.<年度>.json 再生成
npm run build         # 本番ビルド
pm2 restart marumie-jp
pm2 logs marumie-jp
```

## 「ボタン一つ更新」
- 管理画面 `/admin` で ADMIN_TOKEN を入力 →「最新データ取込」。
- `POST /api/admin/refresh`（ヘッダ `x-admin-token`）が `npm run build:flows` を実行し JSON 再生成。
- 国の予算・決算は**年次公表**。本ボタンは新年度データ取込用（リアルタイム更新ではない）。

## 環境変数（.env.local / git 管理外）
- `ESTAT_APP_ID` … e-Stat アプリID（未設定なら seed のみ）
- `ADMIN_TOKEN` … refresh API 保護用シークレット
- `PORT=3001`

## データの注意（重要）
- 初版 seed の数値は**概算・要検証**。財務省公表値 / e-Stat で確定すること。
- `type`（予算/決算）と `stage`（当初/補正/速報/確定）を区別。混同しない。
- 単位は `unit`（百万円）。表示時に億・兆へ整形。
- 明細（個別契約・支出先）は初版スコープ外。

## まだ root が必要な残作業
- `/opt/marumie-jp` への移設、nginx リバースプロキシ（サブパス/サブドメイン）
- 再起動後の自動復帰: `sudo env PATH=$PATH pm2 startup systemd -u w00dst0ck --hp /home/w00dst0ck` → `pm2 save`

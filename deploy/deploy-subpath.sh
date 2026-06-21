#!/usr/bin/env bash
# marumie-jp を /marumie/ サブパス用に再ビルドして PM2 を更新する。
# このスクリプトは marumie-jp の所有ユーザ（w00dst0ck）で実行可能（root不要）。
# nginx の切替・briefing-bot の再ビルドは別途 root で行う（deploy/README.md 参照）。
set -euo pipefail
cd "$(dirname "$0")/.."

export NEXT_BASE_PATH=/marumie
echo "[1/3] flows データ生成"
npm run build:flows
echo "[2/3] 本番ビルド (basePath=$NEXT_BASE_PATH)"
npm run build
echo "[3/3] PM2 再起動 (NEXT_BASE_PATH を反映)"
# ecosystem に env を入れている場合はそちらが優先。--update-env で現在の環境を反映。
NEXT_BASE_PATH=/marumie pm2 restart marumie-jp --update-env
pm2 save
echo "完了: nginx 切替後 http://210.131.212.62/marumie/ で表示されます。"

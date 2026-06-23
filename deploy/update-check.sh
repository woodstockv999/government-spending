#!/usr/bin/env bash
# main に新しいコミットがあれば自動デプロイするスクリプト
# cron から呼び出される（5分ごと）

APP_DIR="$HOME/marumie-jp"
BRANCH="main"
LOCK_FILE="/tmp/marumie-update.lock"
LOG_FILE="$HOME/logs/marumie-update.log"
NOTIFY_EMAIL="jsbseven170@gmail.com"

send_mail() {
  local subject="$1"
  local body="$2"
  printf "Subject: %s\nFrom: %s\nTo: %s\nContent-Type: text/plain; charset=UTF-8\n\n%s\n" \
    "$subject" "$NOTIFY_EMAIL" "$NOTIFY_EMAIL" "$body" \
    | msmtp "$NOTIFY_EMAIL" 2>>"$LOG_FILE" || true
}

# 多重実行防止
if [ -f "$LOCK_FILE" ]; then
  echo "[$(date '+%F %T')] 既に実行中のため終了" >> "$LOG_FILE"
  exit 0
fi
touch "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

cd "$APP_DIR" || { echo "[$(date '+%F %T')] ERROR: $APP_DIR が見つかりません" >> "$LOG_FILE"; exit 1; }

# リモートの最新コミットを取得
if ! git fetch origin "$BRANCH" --quiet 2>>"$LOG_FILE"; then
  echo "[$(date '+%F %T')] ERROR: git fetch 失敗" >> "$LOG_FILE"
  exit 1
fi

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "[$(date '+%F %T')] 新しいコミット検出: ${LOCAL:0:7} -> ${REMOTE:0:7}" >> "$LOG_FILE"
echo "[$(date '+%F %T')] デプロイ開始..." >> "$LOG_FILE"

{
  git fetch origin "$BRANCH" && git reset --hard "origin/$BRANCH" && \
  npm ci && \
  npm run build:flows && \
  NEXT_BASE_PATH=/marumie npm run build && \
  pm2 restart marumie-jp --update-env && \
  pm2 save
} >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
  echo "[$(date '+%F %T')] デプロイ完了" >> "$LOG_FILE"
  send_mail "[marumie-jp] デプロイ完了 ✅" "$(printf '%s -> %s がデプロイされました。\n\n時刻: %s\nURL: http://210.131.212.62/marumie' "${LOCAL:0:7}" "${REMOTE:0:7}" "$(date '+%F %T')")"
else
  echo "[$(date '+%F %T')] ERROR: デプロイ失敗（ログを確認してください）" >> "$LOG_FILE"
  send_mail "[marumie-jp] デプロイ失敗 ❌" "$(printf '%s -> %s のデプロイに失敗しました。\n\n時刻: %s\nログ: %s' "${LOCAL:0:7}" "${REMOTE:0:7}" "$(date '+%F %T')" "$LOG_FILE")"
  exit 1
fi

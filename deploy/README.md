# サブパス相乗りデプロイ手順（210.131.212.62 配下にアプリ配置）

目標のURL構成:

| パス | アプリ | バックエンド |
|------|--------|--------------|
| `http://210.131.212.62/` | ランディング（リンク集） | nginx 静的応答 |
| `http://210.131.212.62/marumie/` | 国家予算まる見え | 127.0.0.1:3001 |
| `http://210.131.212.62/briefing/` | 業界ブリーフィング Bot | 127.0.0.1:3000 |

現状は nginx が `/ → :3000`（briefing-bot）を占有。これをパス分割に置き換える。

## 手順

### A. marumie-jp を /marumie 用に再ビルド（root 不要・w00dst0ck で実行）
```bash
cd /home/w00dst0ck/marumie-jp
bash deploy/deploy-subpath.sh
```

### B. briefing-bot を /briefing 用に再ビルド（root または briefing-bot 所有者）
briefing-bot は `NEXT_BASE_PATH` に対応済み。
```bash
cd /opt/briefing-bot
NEXT_BASE_PATH=/briefing npm run build
# ecosystem に env: { NEXT_BASE_PATH: "/briefing" } を追加するか、↓で反映
NEXT_BASE_PATH=/briefing pm2 restart briefing-bot --update-env
pm2 save
```

### C. nginx をパス分割に切替（root）
```bash
cp /home/w00dst0ck/marumie-jp/deploy/nginx-apps.conf /etc/nginx/sites-available/apps
rm -f /etc/nginx/sites-enabled/briefing-bot
ln -sf /etc/nginx/sites-available/apps /etc/nginx/sites-enabled/apps
nginx -t && systemctl reload nginx
```

### D. 確認
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://210.131.212.62/
curl -s -o /dev/null -w "%{http_code}\n" http://210.131.212.62/marumie/
curl -s -o /dev/null -w "%{http_code}\n" http://210.131.212.62/briefing/
```

## 切り戻し（ロールバック）
```bash
# nginx を元に戻す
rm -f /etc/nginx/sites-enabled/apps
ln -sf /etc/nginx/sites-available/briefing-bot /etc/nginx/sites-enabled/briefing-bot
nginx -t && systemctl reload nginx
# 各アプリを basePath 無しに戻す（NEXT_BASE_PATH を空で再ビルド→restart）
```

## 注意
- A と B（basePath 化）を済ませてから C（nginx 切替）を行うこと。順序を誤ると一時的に 404 になる。
- basePath を有効にすると、ポート直アクセス（:3001/ など）はルートでは表示されず `:3001/marumie/` になる。公開は nginx 経由に統一する。
- 独自ドメイン＋HTTPS化（certbot）は将来対応。現状は IP 直 + http。

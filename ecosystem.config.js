// PM2 設定（依頼書 §6, §8-7）。briefing-bot(3000)・onepiece(3001) と衝突しないよう 3002 を使用。
// 起動: pm2 start ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: "marumie-jp",
      cwd: "/home/w00dst0ck/apps/marumie-jp",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3002",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: "3002",
        // briefing-bot/onepiece と同じ方式: nginx の proxy_pass はプレフィックスを
        // 剥がさず( http://127.0.0.1:3002; 末尾スラッシュなし )/marumie/... をそのまま
        // 転送するので、アプリ側は basePath="/marumie" を持つ必要がある。
        // ビルド時にも同じ値が要る（NEXT_BASE_PATH=/marumie npm run build）。
        NEXT_BASE_PATH: "/marumie",
      },
    },
  ],
};

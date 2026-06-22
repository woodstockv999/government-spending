// PM2 設定（依頼書 §6, §8-7）。briefing-bot(3000) と衝突しないよう 3001 を使用。
// 起動: pm2 start ecosystem.config.js && pm2 save
module.exports = {
  apps: [
    {
      name: "marumie-jp",
      cwd: "/home/w00dst0ck/marumie-jp",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3001",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        // 本番は nginx の /marumie/ 配下に相乗り。サブパス配置のため basePath を固定。
        // ※ ビルドも同じ値で行うこと: NEXT_BASE_PATH=/marumie npm run build
        //   ルート(/)で動かしたい場合はこの行を削除して再ビルド。
        NEXT_BASE_PATH: "/marumie",
      },
    },
  ],
};

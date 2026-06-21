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
      },
    },
  ],
};

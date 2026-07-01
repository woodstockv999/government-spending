/** @type {import('next').NextConfig} */
// briefing-bot/onepiece と同じ方式。nginx の location /marumie/ は
// proxy_pass http://127.0.0.1:3002; (末尾スラッシュなし) でプレフィックスを
// 剥がさずそのまま転送するので、basePath="/marumie" をビルド時・起動時の
// 両方で一致させる必要がある（ecosystem.config.js の NEXT_BASE_PATH と同じ値）。
const basePath = process.env.NEXT_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  // NOTE: output:"standalone" was removed — it requires running
  // `node .next/standalone/server.js` (not `next start`, which pm2/ecosystem.config.js
  // actually uses here) plus manually copying public/ and .next/static into
  // .next/standalone/ on every build. That copy step wasn't part of any build
  // script, so standalone mode was silently serving stale/broken output.
  // Plain `next start` needs no such step and matches how this app is actually run.
  basePath: basePath || undefined,
  // クライアントからの fetch / リンクで参照する接頭辞。
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;

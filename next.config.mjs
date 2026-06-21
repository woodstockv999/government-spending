/** @type {import('next').NextConfig} */
// サブパス配置に対応（例: NEXT_BASE_PATH=/marumie で nginx の /marumie/ 配下に置く）。
// 未設定なら "" となり、これまで通りルート(:3001/)で動作する（無害）。
const basePath = process.env.NEXT_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  // Keep the footprint small on the 2GB VPS.
  output: "standalone",
  basePath: basePath || undefined,
  // クライアントからの fetch / リンクで参照する接頭辞。
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;

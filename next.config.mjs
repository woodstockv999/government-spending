/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the footprint small on the 2GB VPS.
  output: "standalone",
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // สำหรับ Cloudflare Pages + next-on-pages
  output: "export",

  // ปิด ESLint ตอน build (กันพังบน Cloudflare)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ผ่อน TypeScript strict ตอน build
  typescript: {
    ignoreBuildErrors: true,
  },

  // กัน node-only modules หลุดเข้า Edge
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;

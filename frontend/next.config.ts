import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // E2E sinovlari alohida papkaga yig‘adi (ishlab chiqish serveri bilan to‘qnashmasligi uchun)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // Faqat ishlab chiqishda: brauzer /api/* ni shu saytga yuboradi, sayt esa uni lokal backend'ga uzatadi.
  // Shuning uchun tunnel (ngrok, Cloudflare...) orqali ochilganda ham bitta tunnel yetadi va CORS kerak emas.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const target = (process.env.API_PROXY_TARGET || "http://localhost:4000").replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
  async headers() {
    return [
      {
        // Service worker har doim yangilanib turishi kerak (keshlanmaydi).
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

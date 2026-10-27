import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Origami visitor proxy: first-party path, handled by app/api/ov/[path]/route.ts.
  async rewrites() {
    return [{ source: "/_ov/:path", destination: "/api/ov/:path" }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    // Re-enable the client-side router cache (Next 15+ defaults dynamic to 0s),
    // so revisiting a recently-viewed route is served from memory instead of
    // re-fetching the RSC payload on every navigation.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;

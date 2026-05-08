import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',

  // Router cache (RSC payload kept in browser memory).
  //
  // The heavy lifting happens server-side via tag-based invalidation in
  // lib/cache/dashboard-cache.ts — that cache lives until cron jobs or
  // mutations actually change the underlying data, regardless of clock time.
  //
  // The client router cache is here as a small comfort layer: 60s lets
  // back/forward navigation feel instant without showing data older than the
  // server cache itself would.
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 180,
    },
  },
};

export default nextConfig;

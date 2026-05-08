import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',

  // Router cache (RSC payload kept in browser memory across navigations).
  //
  // Default in Next.js 15+: dynamic = 0, static = 180. Dynamic routes refetch
  // on every navigation — back/forward feels like a fresh page load even
  // though the data hasn't changed. With these values, navigating back to a
  // recently visited page reuses the cached RSC payload and is instant.
  //
  //   dynamic: 30 — cache RSC for dynamic pages (auth, db queries) for 30s.
  //                 Marketing dashboards refresh from cron at 23:30 daily,
  //                 30s of staleness is invisible.
  //   static:  180 — keep static-generated routes (login page, etc.) for 3min.
  //
  // Mutations (POST/DELETE handlers + router.refresh()) bypass this cache,
  // so add/delete actions still update the UI immediately.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;

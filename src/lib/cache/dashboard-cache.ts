// Tag-based cache wrappers around dashboard queries.
//
// Why this pattern (not staleTimes / unstable_cache duration):
//   The user complaint was "cache should reset at 23:30, not 24h from fetch".
//   Duration-based caches treat every fetch independently — N visitors at
//   different times = N expiry windows. Tag-based caches expire ONLY when
//   the data source actually changes (cron job runs, user submits a form),
//   regardless of when the cache was warmed.
//
// Workflow:
//   1. Server Components call get*() — first hit goes to DB, subsequent hits
//      return cached value with no DB roundtrip.
//   2. Cron jobs and mutation handlers call invalidateDashboard() after
//      writing — next get*() call refetches from DB.
//   3. revalidate: false means "never auto-expire" — invalidation is the
//      ONLY way the cache empties.

import { unstable_cache, revalidateTag } from 'next/cache';
import { fetchKpiData } from '@/lib/queries/dashboard-kpi';
import { fetchTrendData } from '@/lib/queries/dashboard-trend';
import { fetchRecentRevenue } from '@/lib/queries/revenue';

/** Single shared tag — all dashboard data invalidates together. KISS first;
 *  split into per-source tags (lead, revenue, fb-metrics) only if the perf
 *  win from finer granularity proves measurable. */
export const DASHBOARD_TAG = 'dashboard';

export const getKpiData = unstable_cache(
  async (days: number) => fetchKpiData(days),
  ['kpi-data-v1'],
  { tags: [DASHBOARD_TAG], revalidate: false }
);

export const getTrendData = unstable_cache(
  async (days: number) => fetchTrendData(days),
  ['trend-data-v1'],
  { tags: [DASHBOARD_TAG], revalidate: false }
);

export const getRecentRevenue = unstable_cache(
  async (limit: number) => fetchRecentRevenue(limit),
  ['recent-revenue-v1'],
  { tags: [DASHBOARD_TAG], revalidate: false }
);

/**
 * Drop every cached dashboard entry. Call this after any write that affects
 * what the dashboard displays:
 *   - Cron job D (Ladipage sync) finishes
 *   - Cron job A (page insights) finishes
 *   - Cron job B (posts ingestion) finishes
 *   - Manual /api/sync/fetch-now finishes
 *   - User submits / deletes a revenue entry
 *
 * Cheap to call — it's a no-op when nothing's cached.
 */
export function invalidateDashboard(): void {
  // 'max' profile = clear the tag immediately. Required positional arg in
  // Next.js 16; the single-arg signature was deprecated.
  revalidateTag(DASHBOARD_TAG, 'max');
}

// Tag-based cache wrappers around dashboard queries.
//
// Caching strategy:
//   - revalidate: 300s  → cache auto-expires after 5 minutes. This handles the
//     cron-job case: cron writes new rows to DB, can't call revalidateTag
//     (no request context in Next.js 16 instrumentation runtime), but the TTL
//     guarantees dashboard data refreshes at worst 5 min after cron run.
//   - tags: [DASHBOARD_TAG] → user-triggered mutations (revenue submit, manual
//     sync click) still call invalidateDashboard() for IMMEDIATE refresh.
//     Those callers run inside Route Handlers, so revalidateTag works there.
//
// Why not revalidate: false?
//   In Next.js 16, revalidateTag() requires a request store and throws
//   "Invariant: static generation store missing" when called from cron jobs.
//   TTL is the simplest fallback: cron writes data, cache auto-expires,
//   dashboard refreshes on next visit. KISS.
//
// Workflow:
//   1. Server Components call get*() — first hit goes to DB, subsequent hits
//      return cached value (up to 5 min old).
//   2. Mutation handlers (Route Handlers / Server Actions) call
//      invalidateDashboard() for immediate refresh — bypasses TTL.

import { unstable_cache, revalidateTag } from 'next/cache';
import { fetchKpiData } from '@/lib/queries/dashboard-kpi';
import { fetchTrendData } from '@/lib/queries/dashboard-trend';
import { fetchRecentRevenue } from '@/lib/queries/revenue';

/** Single shared tag — all dashboard data invalidates together. KISS first;
 *  split into per-source tags (lead, revenue, fb-metrics) only if the perf
 *  win from finer granularity proves measurable. */
export const DASHBOARD_TAG = 'dashboard';

/** 5 minutes — long enough to absorb burst traffic, short enough that cron
 *  writes (which can't invalidate) show up within one coffee break. */
const CACHE_TTL_SECONDS = 100;

export const getKpiData = unstable_cache(
  async (days: number) => fetchKpiData(days),
  ['kpi-data-v1'],
  { tags: [DASHBOARD_TAG], revalidate: CACHE_TTL_SECONDS }
);

export const getTrendData = unstable_cache(
  async (days: number) => fetchTrendData(days),
  ['trend-data-v1'],
  { tags: [DASHBOARD_TAG], revalidate: CACHE_TTL_SECONDS }
);

export const getRecentRevenue = unstable_cache(
  async (limit: number) => fetchRecentRevenue(limit),
  ['recent-revenue-v1'],
  { tags: [DASHBOARD_TAG], revalidate: CACHE_TTL_SECONDS }
);

/**
 * Force-refresh dashboard cache immediately. Only call from Route Handlers
 * or Server Actions — these have the request context revalidateTag requires.
 * Cron jobs MUST NOT call this; they rely on the TTL to auto-expire instead.
 *
 * Use for:
 *   - User submits / deletes a revenue entry (revenue routes)
 *   - Manual /api/sync/fetch-now finishes
 */
export function invalidateDashboard(): void {
  // 'max' profile = stale-while-revalidate. Required positional arg in
  // Next.js 16; the single-arg signature was deprecated.
  revalidateTag(DASHBOARD_TAG, 'max');
}

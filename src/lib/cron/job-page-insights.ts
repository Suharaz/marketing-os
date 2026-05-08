// Job A — Page Insights ingestion (runs 3×/day at 02:00, 10:00, 18:00).
// For each active account: fetches 2-day window of page-level insights from FB,
// parses into account_metric_daily rows, UPSERTs to DB.
// Per-account errors are isolated — one failure does not abort the batch.

import { db } from '@/lib/db';
import { fetchPageInsights } from '@/lib/fb/api-client';
import { decryptToken } from '@/lib/fb/token-encryption';
import { parseInsights } from '@/lib/fb/parse-insights';
import { getTodayUntilUtcSec } from '@/lib/fb/pt-date';
import { startSyncLog, finishSyncLog } from '@/lib/cron/sync-log';
import { upsertAccountMetricDaily } from '@/lib/cron/upsert-helpers';
import { handleAccountError } from '@/lib/cron/account-error-handler';
import { invalidateDashboard } from '@/lib/cache/dashboard-cache';
import type { AccountMetricDailyRow } from '@/lib/cron/upsert-helpers';

interface ActiveAccount {
  id: string;
  external_id: string;
  access_token_encrypted: Buffer;
}

/** Unix timestamp (seconds) for N days ago from now. */
function unixDaysAgo(n: number): number {
  return Math.floor((Date.now() - n * 24 * 60 * 60 * 1000) / 1000);
}

/** Fetch all active accounts that have an encrypted token. */
async function loadActiveAccounts(): Promise<ActiveAccount[]> {
  const result = await db.query<ActiveAccount>(
    `SELECT id, external_id, access_token_encrypted
     FROM social_account
     WHERE status = 'active' AND access_token_encrypted IS NOT NULL`
  );
  return result.rows;
}

/** Map ParsedDayInsight array to AccountMetricDailyRow array for one account. */
function toMetricRows(
  accountId: string,
  parsed: ReturnType<typeof parseInsights>
): AccountMetricDailyRow[] {
  return parsed.map((day) => ({
    account_id: accountId,
    date: day.date,
    followers: day.followers,
    follower_growth: day.follower_growth,
    posts_count: 0, // page_insights does not provide post count — kept from prior row via UPSERT
    total_reach: day.total_reach,
    total_reach_unique: day.total_reach_unique,
    total_engagement: day.total_engagement,
    total_actions: day.total_actions,
    page_views: day.page_views,
    post_reactions_total: day.post_reactions_total,
  }));
}

/**
 * Run the page insights ingestion job.
 * Exported for use in cron/init.ts and the run-job-once CLI script.
 */
export async function runPageInsightsJob(): Promise<void> {
  const logId = await startSyncLog('page_insights');
  let totalRecords = 0;
  let jobError: string | null = null;

  try {
    const accounts = await loadActiveAccounts();
    console.log(`[job-page-insights] Processing ${accounts.length} active accounts`);

    for (const acc of accounts) {
      try {
        const token = await decryptToken(acc.access_token_encrypted);
        const since = unixDaysAgo(2);
        // until = todayT08:00:00+0000 — đảm bảo FB include row finalised gần
        // nhất, không cắt mất ngày cuối nếu cron chạy trước PT-midnight rollover.
        const until = getTodayUntilUtcSec();

        // Single /insights call covers all 8 metrics (incl. page_follows for followers count)
        const rawInsights = await fetchPageInsights(
          token,
          acc.external_id,
          since,
          until
        );
        const parsed = parseInsights(rawInsights);
        const rows = toMetricRows(acc.id, parsed);

        const upserted = await upsertAccountMetricDaily(rows);
        totalRecords += upserted;

        // Update last_synced_at on success
        await db.query(
          `UPDATE social_account SET last_synced_at = NOW() WHERE id = $1`,
          [acc.id]
        );

        console.log(`[job-page-insights] Account ${acc.id}: upserted ${upserted} rows`);
      } catch (err) {
        await handleAccountError(acc.id, err);
      }
    }
  } catch (err) {
    jobError = err instanceof Error ? err.message : String(err);
    console.error('[job-page-insights] Fatal job error:', err);
  }

  await finishSyncLog(
    logId,
    jobError ? 'failed' : 'success',
    totalRecords,
    jobError
  );

  if (totalRecords > 0) invalidateDashboard();

  console.log(`[job-page-insights] Done — ${totalRecords} rows upserted`);
}

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
import { callContext, type CallEntry } from '@/lib/sync/call-context';
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
  // posts_count: KHÔNG ghi — query đọc bằng COUNT từ social_post (xem
  // channel-detail.ts, dashboard-trend.ts). Column DB tự fill DEFAULT 0.
  return parsed.map((day) => ({
    account_id: accountId,
    date: day.date,
    followers: day.followers,
    follower_growth: day.follower_growth,
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
 *
 * Logging: ghi 1 row api_sync_log per account để trang chi tiết kênh
 * (`fetchSyncLog` filter theo account_id) thấy được lịch sử cron.
 * Nếu fatal trước vòng lặp (load accounts fail) → ghi 1 batch row
 * account_id=NULL để không mất visibility.
 */
export async function runPageInsightsJob(): Promise<void> {
  let totalRecords = 0;

  let accounts: ActiveAccount[];
  try {
    accounts = await loadActiveAccounts();
  } catch (err) {
    // Fatal trước khi có account nào — ghi batch log fallback (account_id=NULL)
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[job-page-insights] Fatal: load accounts failed:', err);
    const fallbackLogId = await startSyncLog('page_insights');
    await finishSyncLog(fallbackLogId, 'failed', 0, errMsg);
    return;
  }

  console.log(`[job-page-insights] Processing ${accounts.length} active accounts`);

  for (const acc of accounts) {
    // Mỗi account = 1 log row riêng → channel detail page query được
    const logId = await startSyncLog('page_insights', acc.id);
    // callContext.run wraps the fetch + parse so every fb() call gets pushed
    // to `calls` — we persist it as api_sync_log.details for UI inspection.
    const calls: CallEntry[] = [];
    try {
      const upserted = await callContext.run(calls, async () => {
        const token = await decryptToken(acc.access_token_encrypted);
        const since = unixDaysAgo(2);
        // until = todayT08:00:00+0000 — đảm bảo FB include row finalised gần
        // nhất, không cắt mất ngày cuối nếu cron chạy trước PT-midnight rollover.
        const until = getTodayUntilUtcSec();

        const rawInsights = await fetchPageInsights(
          token,
          acc.external_id,
          since,
          until
        );
        const parsed = parseInsights(rawInsights);
        const rows = toMetricRows(acc.id, parsed);
        return upsertAccountMetricDaily(rows);
      });
      totalRecords += upserted;

      // Update last_synced_at on success
      await db.query(
        `UPDATE social_account SET last_synced_at = NOW() WHERE id = $1`,
        [acc.id]
      );

      await finishSyncLog(logId, 'success', upserted, null, calls);
      console.log(`[job-page-insights] Account ${acc.id}: upserted ${upserted} rows`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await finishSyncLog(logId, 'failed', 0, errMsg, calls);
      await handleAccountError(acc.id, err);
    }
  }

  // Cache TTL (5 min) handles refresh — cron can't call revalidateTag in
  // Next.js 16 (no request context). See lib/cache/dashboard-cache.ts.
  console.log(`[job-page-insights] Done — ${totalRecords} rows upserted`);
}

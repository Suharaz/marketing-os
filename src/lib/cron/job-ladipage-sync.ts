// Job D — Ladipage conversion sync (runs daily at 23:30 Asia/Ho_Chi_Minh).
// For each active Facebook account: fetches conversion count from n8n webhook
// and UPSERTs into landing_page_conversion. Per-account fetch+upsert lives in
// lib/ladipage/sync-account.ts so the same helper powers manual sync clicks.

import { db } from '@/lib/db';
import { syncLadipageForAccount, todayInVn } from '@/lib/ladipage/sync-account';
import { startSyncLog, finishSyncLog } from '@/lib/cron/sync-log';
import { invalidateDashboard } from '@/lib/cache/dashboard-cache';

interface ActiveFbAccount {
  id: string;
  external_id: string;
  name: string;
}

const DELAY_BETWEEN_CALLS_MS = 200;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function loadActiveFbAccounts(): Promise<ActiveFbAccount[]> {
  const result = await db.query<ActiveFbAccount>(
    `SELECT id, external_id, name
     FROM social_account
     WHERE platform = 'facebook' AND status = 'active'`
  );
  return result.rows;
}

/**
 * Run the Ladipage sync job. Safe to call manually for backfill or testing.
 * Exported for use in cron/init.ts and any future run-once CLI script.
 *
 * Logging: ghi 1 row api_sync_log per account. Status mapping:
 *   - upserted → success, records=count
 *   - no_data  → success, records=0 (đã chạy, không có data — không phải lỗi)
 *   - failed   → failed, errorMessage=reason
 */
export async function runLadipageSyncJob(): Promise<void> {
  const occurredDate = todayInVn();
  let upserted = 0;
  let skipped = 0;
  let failed = 0;

  let accounts: ActiveFbAccount[];
  try {
    accounts = await loadActiveFbAccounts();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[job-ladipage] Fatal: load accounts failed:', err);
    const fallbackLogId = await startSyncLog('ladipage');
    await finishSyncLog(fallbackLogId, 'failed', 0, errMsg);
    return;
  }

  console.log(
    `[job-ladipage] Starting batch — ${accounts.length} accounts, occurred_date=${occurredDate}`
  );

  for (const account of accounts) {
    const logId = await startSyncLog('ladipage', account.id);

    // syncLadipageForAccount KHÔNG throw — luôn trả LadipageSyncResult,
    // nên không cần try/catch ở đây. Vẫn wrap để đề phòng lỗi DB ngoài kế hoạch.
    try {
      const result = await syncLadipageForAccount(
        account.id,
        account.external_id,
        occurredDate
      );

      if (result.status === 'upserted') {
        upserted++;
        await finishSyncLog(logId, 'success', result.count ?? 0);
        console.log(
          `[job-ladipage] OK ${account.name} (${account.external_id}): count=${result.count}`
        );
      } else if (result.status === 'no_data') {
        skipped++;
        await finishSyncLog(logId, 'success', 0);
        console.warn(
          `[job-ladipage] SKIP ${account.name} (${account.external_id}): no Ladipage data yet`
        );
      } else {
        failed++;
        await finishSyncLog(logId, 'failed', 0, result.reason ?? 'unknown');
        console.error(
          `[job-ladipage] FAIL ${account.name} (${account.external_id}): ${result.reason ?? 'unknown'}`
        );
      }
    } catch (err) {
      failed++;
      const errMsg = err instanceof Error ? err.message : String(err);
      await finishSyncLog(logId, 'failed', 0, errMsg);
      console.error(
        `[job-ladipage] EXCEPTION ${account.name} (${account.external_id}): ${errMsg}`
      );
    }

    // Throttle between calls to avoid hammering the n8n webhook
    await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  // Drop dashboard cache so the new lead numbers show on the next page load.
  // Always called even when upserted=0 — schema-level changes (e.g. backfill)
  // could still warrant a refresh, and revalidateTag is cheap on a cold cache.
  if (upserted > 0) invalidateDashboard();

  console.log(
    `[job-ladipage] Done — upserted=${upserted} skipped=${skipped} failed=${failed}`
  );
}

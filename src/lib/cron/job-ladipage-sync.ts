// Job D — Ladipage conversion sync (runs daily at 23:30 Asia/Ho_Chi_Minh).
// For each active Facebook account: fetches conversion count from n8n webhook
// and UPSERTs into landing_page_conversion. Per-account fetch+upsert lives in
// lib/ladipage/sync-account.ts so the same helper powers manual sync clicks.

import { db } from '@/lib/db';
import { syncLadipageForAccount, todayInVn } from '@/lib/ladipage/sync-account';
import { startSyncLog, finishSyncLog } from '@/lib/cron/sync-log';

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
 */
export async function runLadipageSyncJob(): Promise<void> {
  const occurredDate = todayInVn();
  const logId = await startSyncLog('ladipage');
  let upserted = 0;
  let skipped = 0;
  let failed = 0;
  let jobError: string | null = null;

  try {
    const accounts = await loadActiveFbAccounts();
    console.log(
      `[job-ladipage] Starting batch — ${accounts.length} accounts, occurred_date=${occurredDate}`
    );

    for (const account of accounts) {
      const result = await syncLadipageForAccount(
        account.id,
        account.external_id,
        occurredDate
      );

      if (result.status === 'upserted') {
        upserted++;
        console.log(
          `[job-ladipage] OK ${account.name} (${account.external_id}): count=${result.count}`
        );
      } else if (result.status === 'no_data') {
        skipped++;
        console.warn(
          `[job-ladipage] SKIP ${account.name} (${account.external_id}): no Ladipage data yet`
        );
      } else {
        failed++;
        console.error(
          `[job-ladipage] FAIL ${account.name} (${account.external_id}): ${result.reason ?? 'unknown'}`
        );
      }

      // Throttle between calls to avoid hammering the n8n webhook
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }
  } catch (err) {
    jobError = err instanceof Error ? err.message : String(err);
    console.error('[job-ladipage] Fatal job error:', err);
  }

  await finishSyncLog(
    logId,
    jobError ? 'failed' : 'success',
    upserted,
    jobError
  );

  console.log(
    `[job-ladipage] Done — upserted=${upserted} skipped=${skipped} failed=${failed}`
  );
}

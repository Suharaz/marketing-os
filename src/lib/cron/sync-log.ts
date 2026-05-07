// Cron-specific sync log helpers.
// Two-phase logging: startSyncLog() opens a 'running' row at job start,
// finishSyncLog() closes it with final status once job completes.
// This gives visibility into long-running jobs (distinct from logSync() in lib/sync).

import { db } from '@/lib/db';
import type { SyncTypeT, SyncStatusT } from '@/lib/db-types';

/**
 * Insert a new api_sync_log row with status='running' and started_at=NOW().
 * Returns the UUID of the created row for later finishSyncLog() call.
 */
export async function startSyncLog(
  syncType: SyncTypeT,
  accountId?: string | null
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO api_sync_log (sync_type, account_id, started_at, status, records_upserted)
     VALUES ($1, $2, NOW(), 'running', 0)
     RETURNING id`,
    [syncType, accountId ?? null]
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error(`startSyncLog: INSERT returned no id for sync_type=${syncType}`);
  return id;
}

/**
 * Update an existing api_sync_log row to finalize it.
 * Sets finished_at=NOW(), status, records_upserted, and optional error_message.
 * Swallows errors — log failures must never mask real errors.
 */
export async function finishSyncLog(
  logId: string,
  status: SyncStatusT,
  recordsUpserted: number,
  errorMsg?: string | null
): Promise<void> {
  try {
    await db.query(
      `UPDATE api_sync_log
       SET finished_at = NOW(),
           status = $2,
           records_upserted = $3,
           error_message = $4
       WHERE id = $1`,
      [logId, status, recordsUpserted, errorMsg ?? null]
    );
  } catch (err) {
    console.error('[cron/sync-log] Failed to finalize sync log row:', err);
  }
}

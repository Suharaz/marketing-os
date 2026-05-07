// Writes a completed sync operation record to api_sync_log.
// Used by both manual fetch (/api/sync/fetch-now) and cron jobs (Phase 05).

import { db } from '@/lib/db';
import type { SyncStatusT, SyncTypeT } from '@/lib/db-types';

export interface LogSyncParams {
  syncType: SyncTypeT;
  accountId: string | null;
  startedAt: Date;
  status: SyncStatusT;
  recordsUpserted: number;
  errorMessage?: string | null;
  details?: unknown; // jsonb — array of CallEntry from call-context, or null for cron jobs
}

/**
 * Insert a completed api_sync_log row.
 * finished_at is always set to now() at the time of the call.
 * Does not throw — log failures are swallowed and printed to stderr
 * so they never mask the original sync error.
 */
export async function logSync(params: LogSyncParams): Promise<void> {
  const {
    syncType,
    accountId,
    startedAt,
    status,
    recordsUpserted,
    errorMessage,
    details,
  } = params;

  try {
    await db.query(
      `INSERT INTO api_sync_log
         (sync_type, account_id, started_at, finished_at, status, records_upserted, error_message, details)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7::jsonb)`,
      [
        syncType,
        accountId,
        startedAt,
        status,
        recordsUpserted,
        errorMessage ?? null,
        details === undefined ? null : JSON.stringify(details),
      ]
    );
  } catch (err) {
    // Log failures must never surface to callers — they would mask real errors
    console.error('[logSync] Failed to write api_sync_log:', err);
  }
}

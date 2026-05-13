// Cron run history queries — đọc api_sync_log để hiển thị trên UI admin.
// Mỗi job + mỗi account ghi 1 row riêng (granularity per commit 00f7b3f).

import { db } from '@/lib/db';
import type { SyncTypeT, SyncStatusT } from '@/lib/db-types';

export interface CronHistoryRow {
  id: string;
  syncType: SyncTypeT;
  status: SyncStatusT;
  startedAt: string;
  finishedAt: string | null;
  /** null khi vẫn đang running */
  durationMs: number | null;
  recordsUpserted: number;
  errorMessage: string | null;
  accountId: string | null;
  /** null cho job batch (vd: ladipage) hoặc khi account đã bị xoá */
  accountName: string | null;
}

export interface CronHistoryFilter {
  status?: SyncStatusT;
  syncType?: SyncTypeT;
  limit?: number;
}

export interface CronStats {
  last24h: {
    success: number;
    failed: number;
    running: number;
  };
  lastRunAt: string | null;
  lastSuccessAt: string | null;
}

/** Lấy lịch sử cron mới nhất, có thể filter theo status/syncType. */
export async function fetchCronHistory(
  filter: CronHistoryFilter = {}
): Promise<CronHistoryRow[]> {
  const conds: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (filter.status) {
    conds.push(`l.status = $${i++}`);
    params.push(filter.status);
  }
  if (filter.syncType) {
    conds.push(`l.sync_type = $${i++}`);
    params.push(filter.syncType);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const limit = filter.limit ?? 100;
  params.push(limit);

  const res = await db.query<{
    id: string;
    sync_type: SyncTypeT;
    status: SyncStatusT;
    started_at: Date;
    finished_at: Date | null;
    records_upserted: string;
    error_message: string | null;
    account_id: string | null;
    account_name: string | null;
  }>(
    `SELECT
       l.id, l.sync_type, l.status,
       l.started_at, l.finished_at,
       l.records_upserted, l.error_message,
       l.account_id, a.name AS account_name
     FROM api_sync_log l
     LEFT JOIN social_account a ON a.id = l.account_id
     ${where}
     ORDER BY l.started_at DESC
     LIMIT $${i}`,
    params
  );

  return res.rows.map((r) => ({
    id: r.id,
    syncType: r.sync_type,
    status: r.status,
    startedAt: r.started_at.toISOString(),
    finishedAt: r.finished_at?.toISOString() ?? null,
    durationMs: r.finished_at
      ? r.finished_at.getTime() - r.started_at.getTime()
      : null,
    recordsUpserted: Number(r.records_upserted),
    errorMessage: r.error_message,
    accountId: r.account_id,
    accountName: r.account_name,
  }));
}

/** Stats tổng quan: thành công/thất bại 24h + thời điểm chạy gần nhất. */
export async function fetchCronStats(): Promise<CronStats> {
  const res = await db.query<{
    success: string;
    failed: string;
    running: string;
    last_run: Date | null;
    last_success: Date | null;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status='success' AND started_at > NOW() - INTERVAL '24 hours') AS success,
       COUNT(*) FILTER (WHERE status='failed'  AND started_at > NOW() - INTERVAL '24 hours') AS failed,
       COUNT(*) FILTER (WHERE status='running') AS running,
       MAX(started_at) AS last_run,
       MAX(started_at) FILTER (WHERE status='success') AS last_success
     FROM api_sync_log`
  );
  const row = res.rows[0];
  return {
    last24h: {
      success: Number(row?.success ?? 0),
      failed: Number(row?.failed ?? 0),
      running: Number(row?.running ?? 0),
    },
    lastRunAt: row?.last_run ? row.last_run.toISOString() : null,
    lastSuccessAt: row?.last_success ? row.last_success.toISOString() : null,
  };
}
